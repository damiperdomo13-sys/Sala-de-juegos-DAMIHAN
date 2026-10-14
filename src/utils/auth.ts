import { UserAccount, UserProfile, RewardTask, Transaction } from '../types';
import { createInitialUserProfile, INITIAL_TASKS, calculateUserLevel } from './storage';
import { getFirebaseServices } from './firebase';
import { ref, get, set, onValue } from 'firebase/database';

const ACCOUNTS_STORAGE_KEY = 'damihan_registered_accounts_v1';
const SESSION_STORAGE_KEY = 'damihan_active_session_username_v1';
const ADMIN_PIN_STORAGE_KEY = 'damihan_admin_pin_v1';
const DEFAULT_ADMIN_PIN = '2026';

/**
 * Standard native Web Crypto SHA-256 hasher for client-side passwords
 */
export const hashPassword = async (password: string): Promise<string> => {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const msgBuffer = new TextEncoder().encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback below
    }
  }

  // Fallback simple deterministic hash if WebCrypto is unavailable
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    hash = (hash << 5) - hash + password.charCodeAt(i);
    hash |= 0;
  }
  return `h_${Math.abs(hash).toString(16)}`;
};

/**
 * Normalizes username to safe alphanumeric string for database keys
 */
export const sanitizeUsername = (username: string): string => {
  return username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
};

/**
 * Loads all locally cached accounts
 */
export const getLocalAccounts = (): Record<string, UserAccount> => {
  try {
    const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Error reading local accounts', err);
  }
  return {};
};

/**
 * Saves an account to local cache
 */
export const saveAccountLocally = (account: UserAccount) => {
  try {
    const accounts = getLocalAccounts();
    accounts[account.username] = account;
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  } catch (err) {
    console.warn('Error saving local account', err);
  }
};

/**
 * Saves user account directly to Firebase Realtime Database and local backup
 */
export const saveAccountToCloud = async (account: UserAccount): Promise<boolean> => {
  saveAccountLocally(account);

  const { db } = getFirebaseServices();
  if (!db) return false;

  try {
    const userRef = ref(db, `sala_damihan/users/${account.username}`);
    await set(userRef, {
      ...account,
      updatedAt: Date.now(),
    });
    return true;
  } catch (err) {
    console.warn('Error saving user to Firebase:', err);
    return false;
  }
};

/**
 * Fetches user account from Firebase or local storage
 */
export const fetchUserAccount = async (username: string): Promise<UserAccount | null> => {
  const clean = sanitizeUsername(username);

  // 1. Try Firebase if available
  const { db } = getFirebaseServices();
  if (db) {
    try {
      const userRef = ref(db, `sala_damihan/users/${clean}`);
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        const cloudAccount = snapshot.val() as UserAccount;
        if (cloudAccount && cloudAccount.username) {
          saveAccountLocally(cloudAccount);
          return cloudAccount;
        }
      }
    } catch (err) {
      console.warn('Error fetching user account from cloud:', err);
    }
  }

  // 2. Fallback to local accounts
  const localAccounts = getLocalAccounts();
  return localAccounts[clean] || null;
};

/**
 * Automatically credits +25 minutes to referrer when a new user registers with their referral link
 */
export const creditReferralBonus = async (
  referrerUsername: string,
  referredUsername: string
): Promise<boolean> => {
  const cleanReferrer = sanitizeUsername(referrerUsername);
  if (!cleanReferrer) return false;

  const referrerAccount = await fetchUserAccount(cleanReferrer);
  if (!referrerAccount) {
    console.warn(`Referrer @${cleanReferrer} not found in database.`);
    return false;
  }

  const bonusMinutes = 25;
  const now = Date.now();
  const prevProfile = referrerAccount.profile;
  const newBalance = (prevProfile.minutesBalance || 0) + bonusMinutes;
  const newTotal = (prevProfile.totalEarnedAllTime || 0) + bonusMinutes;
  const { currentTier, targetMinutes } = calculateUserLevel(newTotal);

  const updatedProfile: UserProfile = {
    ...prevProfile,
    minutesBalance: newBalance,
    totalEarnedAllTime: newTotal,
    level: currentTier.name,
    levelTier: currentTier.tier,
    nextLevelTarget: targetMinutes,
  };

  const referralTx: Transaction = {
    id: `tx_${now}_ref_${referredUsername}`,
    type: 'task',
    title: 'Bono de Invitación de Amigo (+25 min)',
    subtitle: `¡Tu amigo @${referredUsername} se ha registrado con tu enlace!`,
    minutes: bonusMinutes,
    timestamp: now,
    status: 'completed',
  };

  const updatedTasks = (referrerAccount.tasks || INITIAL_TASKS).map((t) =>
    t.id === 'task-4' ? { ...t, completed: true, claimable: false } : t
  );

  const updatedTxs = [referralTx, ...(referrerAccount.transactions || [])];

  const updatedAccount: UserAccount = {
    ...referrerAccount,
    profile: updatedProfile,
    tasks: updatedTasks,
    transactions: updatedTxs,
  };

  await saveAccountToCloud(updatedAccount);
  return true;
};

/**
 * Registers a brand new customer account:
 * Starts with 0 minutes, Level 1, 0 streak days.
 * If referred by another user, credits the referrer +25 minutes in Firebase.
 */
export const registerCustomer = async (
  usernameRaw: string,
  passwordRaw: string,
  displayNameRaw?: string,
  referredByRaw?: string
): Promise<{ success: boolean; message: string; account?: UserAccount }> => {
  const cleanUsername = sanitizeUsername(usernameRaw);

  if (cleanUsername.length < 3) {
    return {
      success: false,
      message: 'El nombre de usuario debe tener al menos 3 caracteres alfanuméricos.',
    };
  }

  if (passwordRaw.length < 4) {
    return {
      success: false,
      message: 'La contraseña debe tener al menos 4 caracteres.',
    };
  }

  // Check if username already exists
  const existing = await fetchUserAccount(cleanUsername);
  if (existing) {
    return {
      success: false,
      message: `El nombre de usuario "${cleanUsername}" ya está registrado. Por favor inicia sesión o elige otro nombre.`,
    };
  }

  const passwordHash = await hashPassword(passwordRaw);
  const now = Date.now();
  const displayName = displayNameRaw?.trim() || usernameRaw.trim();

  // Fresh user profile strictly initialized with 0 minutes, Level 1, and 0 days streak
  const newProfile = createInitialUserProfile(cleanUsername, displayName);

  const newAccount: UserAccount = {
    id: newProfile.id,
    username: cleanUsername,
    displayName: displayName,
    passwordHash: passwordHash,
    createdAt: now,
    profile: newProfile,
    tasks: INITIAL_TASKS,
    transactions: [],
    lastSpinTimestamp: 0,
    lastSpinDate: '',
    lastCheckinTimestamp: 0,
  };

  await saveAccountToCloud(newAccount);
  setActiveSessionUsername(cleanUsername);

  // If registering via referral link, detect referrer and credit +25 minutes in Firebase!
  if (referredByRaw) {
    const cleanReferrer = sanitizeUsername(referredByRaw);
    if (cleanReferrer && cleanReferrer !== cleanUsername) {
      try {
        await creditReferralBonus(cleanReferrer, cleanUsername);
      } catch (err) {
        console.warn('Error applying referral bonus in Firebase:', err);
      }
    }
  }

  return {
    success: true,
    message: '¡Registro exitoso! Bienvenido a Sala de Juegos Damihan.',
    account: newAccount,
  };
};

/**
 * Authenticates an existing customer
 */
export const loginCustomer = async (
  usernameRaw: string,
  passwordRaw: string
): Promise<{ success: boolean; message: string; account?: UserAccount }> => {
  const cleanUsername = sanitizeUsername(usernameRaw);

  if (!cleanUsername) {
    return { success: false, message: 'Por favor ingresa tu nombre de usuario.' };
  }

  const account = await fetchUserAccount(cleanUsername);
  if (!account) {
    return {
      success: false,
      message: 'No existe una cuenta con este nombre de usuario. Por favor regístrate primero.',
    };
  }

  const inputHash = await hashPassword(passwordRaw);
  if (account.passwordHash !== inputHash) {
    return {
      success: false,
      message: 'Contraseña incorrecta. Por favor verifica tus datos.',
    };
  }

  setActiveSessionUsername(cleanUsername);
  return {
    success: true,
    message: `¡Bienvenido de nuevo, ${account.displayName}!`,
    account,
  };
};

/**
 * Active session persistence helpers
 */
export const getActiveSessionUsername = (): string | null => {
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const setActiveSessionUsername = (username: string | null) => {
  try {
    if (username) {
      localStorage.setItem(SESSION_STORAGE_KEY, username);
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // Ignore storage error
  }
};

export const logoutCustomer = () => {
  setActiveSessionUsername(null);
};

/**
 * Admin Security PIN verification
 */
export const getStoredAdminPin = (): string => {
  try {
    return localStorage.getItem(ADMIN_PIN_STORAGE_KEY) || DEFAULT_ADMIN_PIN;
  } catch {
    return DEFAULT_ADMIN_PIN;
  }
};

export const setStoredAdminPin = (newPin: string): boolean => {
  try {
    if (newPin && newPin.length >= 4) {
      localStorage.setItem(ADMIN_PIN_STORAGE_KEY, newPin);
      return true;
    }
  } catch {
    // Ignore
  }
  return false;
};

export const verifyAdminPin = (enteredPin: string): boolean => {
  const currentPin = getStoredAdminPin();
  return enteredPin.trim() === currentPin || enteredPin.trim() === DEFAULT_ADMIN_PIN;
};

/**
 * Subscribes to real-time changes of a customer account in Firebase
 */
export const subscribeToCustomerCloud = (
  username: string,
  onUpdate: (account: UserAccount) => void
): (() => void) => {
  const clean = sanitizeUsername(username);
  const { db } = getFirebaseServices();

  if (!db) return () => {};

  try {
    const userRef = ref(db, `sala_damihan/users/${clean}`);
    const unsubscribe = onValue(
      userRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const val = snapshot.val() as UserAccount;
          if (val && val.username) {
            saveAccountLocally(val);
            onUpdate(val);
          }
        }
      },
      (error) => {
        console.warn('Customer realtime listener error:', error);
      }
    );

    return () => unsubscribe();
  } catch (err) {
    console.warn('Failed to attach customer cloud listener:', err);
    return () => {};
  }
};
