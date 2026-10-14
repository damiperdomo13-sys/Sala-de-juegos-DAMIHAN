import { UserProfile, RewardTask, RedeemVoucher, Transaction, RouletteSector, LevelTierInfo } from '../types';

export const STORE_NAME = 'Sala de Juegos Damihan';

/**
 * Generates a unique, deterministic daily store check-in code based on the system calendar date.
 * Automatically changes every day at 00:00 midnight.
 * Format: SJD-DDMM-ALFA (e.g. SJD-1210-XKP)
 */
export const getDynamicDailyStoreCode = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');

  // Deterministic 3-letter daily code based on calendar date
  const dateVal = y * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const c1 = chars[(dateVal * 7 + 5) % chars.length];
  const c2 = chars[(dateVal * 13 + 11) % chars.length];
  const c3 = chars[(dateVal * 19 + 17) % chars.length];

  return `SJD-${d}${m}-${c1}${c2}${c3}`;
};

export const LEVEL_TIERS: LevelTierInfo[] = [
  {
    tier: 1,
    name: 'Nivel 1 · Gamer Novato',
    badge: 'Novato',
    minMinutes: 0,
    targetMinutes: 100,
    benefit: 'Giro en ruleta diaria y acumulación base',
  },
  {
    tier: 2,
    name: 'Nivel 2 · Jugador Habitual',
    badge: 'Bronce',
    minMinutes: 100,
    targetMinutes: 200,
    benefit: '+5% bonificación en canjes y eventos',
  },
  {
    tier: 3,
    name: 'Nivel 3 · Cyber VIP',
    badge: 'Plata',
    minMinutes: 200,
    targetMinutes: 350,
    benefit: '+10% bonificación y acceso prioritario',
  },
  {
    tier: 4,
    name: 'Nivel 4 · Maestro de Sala',
    badge: 'Oro',
    minMinutes: 350,
    targetMinutes: 500,
    benefit: 'Canjes sin restricciones y sorpresas en sala',
  },
  {
    tier: 5,
    name: 'Nivel 5 · Leyenda',
    badge: 'Diamante',
    minMinutes: 500,
    targetMinutes: 750,
    benefit: 'Membresía legendaria VIP permanente',
  },
];

/**
 * Dynamically resolves user level from total accumulated minutes
 */
export const calculateUserLevel = (totalEarned: number) => {
  let currentTier = LEVEL_TIERS[0];
  for (const t of LEVEL_TIERS) {
    if (totalEarned >= t.minMinutes) {
      currentTier = t;
    }
  }

  const nextTier = LEVEL_TIERS.find((t) => t.tier === currentTier.tier + 1);
  const targetMinutes = nextTier ? nextTier.minMinutes : currentTier.targetMinutes;

  let progressPercent = 100;
  if (nextTier) {
    const range = nextTier.minMinutes - currentTier.minMinutes;
    const earnedInCurrentTier = Math.max(0, totalEarned - currentTier.minMinutes);
    progressPercent = Math.min(100, Math.max(0, Math.round((earnedInCurrentTier / range) * 100)));
  }

  return {
    currentTier,
    nextTier,
    targetMinutes,
    progressPercent,
  };
};

/**
 * Calculates calendar day difference between two dates (d2 - d1 in whole calendar days)
 * d2 is usually today/current date, d1 is previous date
 */
export const getCalendarDayDifference = (d1: Date, d2: Date = new Date()): number => {
  const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((utc2 - utc1) / msPerDay);
};

/**
 * Checks if two timestamps fall on the same calendar day in device's local timezone.
 * Resets precisely at 00:00 midnight!
 */
export const isSameCalendarDay = (timestamp1: number, timestamp2: number): boolean => {
  if (!timestamp1 || !timestamp2) return false;
  const d1 = new Date(timestamp1);
  const d2 = new Date(timestamp2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

/**
 * Returns local calendar date string in YYYY-MM-DD format (e.g. 2026-10-12)
 */
export const getTodayDateString = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * Converts timestamp to YYYY-MM-DD local calendar date string
 */
export const getDateStringFromTimestamp = (ts: number): string => {
  if (!ts || ts <= 0) return '';
  return getTodayDateString(new Date(ts));
};

/**
 * Returns exact milliseconds remaining until system midnight (00:00:00 of tomorrow)
 */
export const getMsUntilMidnight = (now: Date = new Date()): number => {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return Math.max(0, tomorrow.getTime() - now.getTime());
};

/**
 * Checks if roulette was already spun on today's calendar date
 */
export const hasSpunRouletteToday = (lastSpinTs: number, lastSpinDate?: string): boolean => {
  const today = getTodayDateString();
  if (lastSpinDate && lastSpinDate === today) return true;
  if (lastSpinTs && lastSpinTs > 0) {
    return getDateStringFromTimestamp(lastSpinTs) === today;
  }
  return false;
};

/**
 * Evaluates visit streak against current calendar date.
 * If user missed a full calendar day (diffDays > 1), streak automatically resets to 0.
 */
export const evaluateUserStreak = (user: UserProfile, lastCheckinTimestamp: number): UserProfile => {
  if (!lastCheckinTimestamp || lastCheckinTimestamp === 0) {
    return user;
  }

  const lastDate = new Date(lastCheckinTimestamp);
  const now = new Date();
  const diffDays = getCalendarDayDifference(lastDate, now);

  // If more than 1 whole calendar day passed without checkin, streak is broken!
  if (diffDays > 1 && user.streakDays > 0) {
    return {
      ...user,
      streakDays: 0,
    };
  }

  return user;
};

// Seed: Yesterday's date so initial demo has 5-day streak waiting for today's checkin
const getYesterdayTimestamp = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(18, 30, 0, 0);
  return d.getTime();
};

export const DEFAULT_USER: UserProfile = {
  id: 'usr_nuevo_jugador',
  name: 'Nuevo Jugador',
  email: 'jugador@damihan.club',
  minutesBalance: 0,
  totalEarnedAllTime: 0,
  level: 'Nivel 1 · Gamer Novato',
  levelTier: 1,
  nextLevelTarget: 100,
  avatarSeed: 'gamer',
  streakDays: 0,
  lastCheckinTimestamp: 0,
};

export const createInitialUserProfile = (username: string, displayName?: string): UserProfile => ({
  id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
  name: displayName?.trim() || username.trim(),
  email: `${username.toLowerCase().trim()}@damihan.club`,
  minutesBalance: 0,
  totalEarnedAllTime: 0,
  level: 'Nivel 1 · Gamer Novato',
  levelTier: 1,
  nextLevelTarget: 100,
  avatarSeed: username.toLowerCase().trim(),
  streakDays: 0,
  lastCheckinTimestamp: 0,
});

export const ROULETTE_SECTORS: RouletteSector[] = [
  { id: 'sec-1', minutes: 0, label: 'Vuelve a intentar', color: '#334155', textColor: '#f8fafc', weight: 20 },
  { id: 'sec-2', minutes: 0, label: 'Vuelve a intentar', color: '#1e293b', textColor: '#cbd5e1', weight: 20 },
  { id: 'sec-3', minutes: 5, label: '+5 Minutos', color: '#065f46', textColor: '#a7f3d0', weight: 20 },
  { id: 'sec-4', minutes: 10, label: '+10 Minutos', color: '#0284c7', textColor: '#ffffff', weight: 15 },
  { id: 'sec-5', minutes: 15, label: '+15 Minutos', color: '#0d9488', textColor: '#ccfbf1', weight: 12 },
  { id: 'sec-6', minutes: 20, label: '+20 Minutos', color: '#10b981', textColor: '#ffffff', weight: 8 },
  { id: 'sec-7', minutes: 30, label: '+30 Minutos', color: '#6366f1', textColor: '#e0e7ff', weight: 4 },
  { id: 'sec-8', minutes: 100, label: '+100 Minutos', color: '#f59e0b', textColor: '#0f172a', weight: 1 },
];

// Cleaned tasks: Only valid tasks (Visita Diaria con Código del Cartel, Perfil, Amigos)
export const INITIAL_TASKS: RewardTask[] = [
  {
    id: 'task-checkin',
    title: 'Visita Diaria al Local',
    description: 'Introduce el código diario o escanea el QR del cartel físico de Sala de Juegos Damihan.',
    minutes: 5,
    iconType: 'checkin',
    completed: false,
    claimable: true,
    category: 'Presencial',
  },
  {
    id: 'task-2',
    title: 'Completar perfil de jugador',
    description: 'Añade tu teléfono de contacto y fecha de cumpleaños para regalos en sala.',
    minutes: 5,
    iconType: 'profile',
    completed: false,
    claimable: true,
    category: 'Fidelización',
  },
  {
    id: 'task-4',
    title: 'Invitar a un amigo a jugar',
    description: 'Comparte tu código de recluta con amigos de la sala para ganar minutos.',
    minutes: 25,
    iconType: 'referral',
    completed: false,
    claimable: true,
    category: 'Comunidad',
  },
];

export const INITIAL_TRANSACTIONS: Transaction[] = [];

export const INITIAL_VOUCHERS: RedeemVoucher[] = [];

const STORAGE_KEYS = {
  USER: 'damihan_user_profile_v3',
  TASKS: 'damihan_tasks_v3',
  TRANSACTIONS: 'damihan_transactions_v3',
  VOUCHERS: 'damihan_vouchers_v3',
  LAST_SPIN: 'damihan_last_spin_time_v3',
  LAST_SPIN_DATE: 'damihan_last_spin_date_v3',
  LAST_CHECKIN: 'damihan_last_checkin_calendar_v3',
  STORE_DAILY_CODE: 'damihan_store_daily_code_v3',
};

export const loadStoredUser = (): UserProfile => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER);
    if (raw) {
      const parsed = JSON.parse(raw);
      const lastCheckin = parsed.lastCheckinTimestamp || loadLastCheckinTimestamp();
      const { currentTier, targetMinutes } = calculateUserLevel(parsed.totalEarnedAllTime || 0);
      
      const userObj: UserProfile = {
        ...parsed,
        level: currentTier.name,
        levelTier: currentTier.tier,
        nextLevelTarget: targetMinutes,
        streakDays: parsed.streakDays !== undefined ? parsed.streakDays : DEFAULT_USER.streakDays,
        lastCheckinTimestamp: lastCheckin,
      };

      // Check if streak was broken due to inactivity
      return evaluateUserStreak(userObj, lastCheckin);
    }
  } catch (e) {
    console.error('Error loading user from localStorage', e);
  }
  return DEFAULT_USER;
};

export const saveStoredUser = (user: UserProfile) => {
  try {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  } catch (e) {
    console.error('Error saving user to localStorage', e);
  }
};

export const loadStoredTasks = (): RewardTask[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
    if (raw) {
      const parsed: RewardTask[] = JSON.parse(raw);
      const valid = parsed.filter((t) => !['task-1', 'task-3', 'task-5'].includes(t.id));
      if (valid.length > 0) return valid;
    }
  } catch (e) {
    console.error('Error loading tasks', e);
  }
  return INITIAL_TASKS;
};

export const saveStoredTasks = (tasks: RewardTask[]) => {
  try {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  } catch (e) {
    console.error('Error saving tasks', e);
  }
};

export const loadStoredTransactions = (): Transaction[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading transactions', e);
  }
  return INITIAL_TRANSACTIONS;
};

export const saveStoredTransactions = (transactions: Transaction[]) => {
  try {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  } catch (e) {
    console.error('Error saving transactions', e);
  }
};

export const loadStoredVouchers = (): RedeemVoucher[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VOUCHERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Error loading vouchers', e);
  }
  return INITIAL_VOUCHERS;
};

export const saveStoredVouchers = (vouchers: RedeemVoucher[]) => {
  try {
    localStorage.setItem(STORAGE_KEYS.VOUCHERS, JSON.stringify(vouchers));
  } catch (e) {
    console.error('Error saving vouchers', e);
  }
};

export const loadLastSpinTimestamp = (): number => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LAST_SPIN);
    if (raw) return parseInt(raw, 10);
  } catch (e) {
    console.error('Error loading spin timestamp', e);
  }
  return 0;
};

export const saveLastSpinTimestamp = (timestamp: number) => {
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_SPIN, timestamp.toString());
  } catch (e) {
    console.error('Error saving spin timestamp', e);
  }
};

export const loadLastSpinDate = (): string => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LAST_SPIN_DATE);
    if (raw) return raw;
    const ts = loadLastSpinTimestamp();
    if (ts > 0) return getDateStringFromTimestamp(ts);
  } catch (e) {
    console.error('Error loading spin date', e);
  }
  return '';
};

export const saveLastSpinDate = (dateStr: string) => {
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_SPIN_DATE, dateStr);
  } catch (e) {
    console.error('Error saving spin date', e);
  }
};

export const loadLastCheckinTimestamp = (): number => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LAST_CHECKIN);
    if (raw) return parseInt(raw, 10);
  } catch (e) {
    console.error('Error loading checkin timestamp', e);
  }
  return getYesterdayTimestamp();
};

export const saveLastCheckinTimestamp = (timestamp: number) => {
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_CHECKIN, timestamp.toString());
  } catch (e) {
    console.error('Error saving checkin timestamp', e);
  }
};

export const resetAllDemoData = () => {
  localStorage.removeItem(STORAGE_KEYS.USER);
  localStorage.removeItem(STORAGE_KEYS.TASKS);
  localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
  localStorage.removeItem(STORAGE_KEYS.VOUCHERS);
  localStorage.removeItem(STORAGE_KEYS.LAST_SPIN);
  localStorage.removeItem(STORAGE_KEYS.LAST_SPIN_DATE);
  localStorage.removeItem(STORAGE_KEYS.LAST_CHECKIN);
  localStorage.removeItem(STORAGE_KEYS.STORE_DAILY_CODE);
};

export const generateVoucherCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const suffix = chars.charAt(Math.floor(Math.random() * chars.length));
  return `SJD-${rand}-${suffix}`;
};
