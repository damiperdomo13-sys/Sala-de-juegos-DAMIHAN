import { initializeApp, getApps, getApp, deleteApp, FirebaseApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, get, Database } from 'firebase/database';
import { UserProfile, RewardTask, RedeemVoucher, Transaction } from '../types';

export interface FirebaseConfig {
  apiKey: string;
  authDomain?: string;
  databaseURL?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

export interface RemoteStoreState {
  user: UserProfile;
  tasks: RewardTask[];
  transactions: Transaction[];
  vouchers: RedeemVoucher[];
  lastSpinTimestamp: number;
  lastSpinDate?: string;
  lastCheckinTimestamp: number;
  updatedAt: number;
  updatedBy?: string;
  lastAction?: string;
}

const FIREBASE_CONFIG_STORAGE_KEY = 'damihan_custom_firebase_config_v1';
const BROADCAST_CHANNEL_NAME = 'damihan_local_realtime_channel';

// Read config from environment variables or custom localStorage
export const getActiveFirebaseConfig = (): FirebaseConfig | null => {
  // 1. Check custom configured in UI via localStorage
  try {
    const custom = localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY);
    if (custom) {
      const parsed = JSON.parse(custom);
      if (parsed.apiKey && parsed.projectId) {
        return parsed;
      }
    }
  } catch {
    // Ignore JSON error
  }

  // 2. Check import.meta.env
  const env = import.meta.env;
  if (
    env.VITE_FIREBASE_API_KEY &&
    env.VITE_FIREBASE_PROJECT_ID &&
    !env.VITE_FIREBASE_API_KEY.includes('AIzaSy...')
  ) {
    return {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || `${env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
      databaseURL:
        env.VITE_FIREBASE_DATABASE_URL ||
        `https://${env.VITE_FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || `${env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: env.VITE_FIREBASE_APP_ID || '',
    };
  }

  return null;
};

export const isFirebaseConfigured = (): boolean => {
  const cfg = getActiveFirebaseConfig();
  return !!(cfg && cfg.apiKey && cfg.projectId);
};

let appInstance: FirebaseApp | null = null;
let dbInstance: Database | null = null;

export const resetFirebaseServices = async () => {
  try {
    if (appInstance) {
      await deleteApp(appInstance);
    }
  } catch {
    // Ignore cleanup error
  }
  appInstance = null;
  dbInstance = null;
};

export const saveCustomFirebaseConfig = async (config: FirebaseConfig | null) => {
  await resetFirebaseServices();
  if (config) {
    localStorage.setItem(FIREBASE_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } else {
    localStorage.removeItem(FIREBASE_CONFIG_STORAGE_KEY);
  }
};

export const getFirebaseServices = () => {
  const config = getActiveFirebaseConfig();
  if (!config) return { app: null, db: null };

  try {
    if (!appInstance) {
      const existingApps = getApps();
      if (existingApps.length === 0) {
        appInstance = initializeApp(config);
      } else {
        appInstance = existingApps[0];
      }
    }

    if (!dbInstance && appInstance) {
      const dbUrl =
        config.databaseURL || `https://${config.projectId}-default-rtdb.firebaseio.com`;
      dbInstance = getDatabase(appInstance, dbUrl);
    }

    return { app: appInstance, db: dbInstance };
  } catch (err) {
    console.warn('Error initializing Firebase services:', err);
    return { app: null, db: null };
  }
};

// Test connection by writing and reading a quick heartbeat
export const testFirebaseConnection = async (
  configToTest: FirebaseConfig
): Promise<{ success: boolean; message: string }> => {
  try {
    const testAppName = `test_${Date.now()}`;
    const testApp = initializeApp(configToTest, testAppName);
    const dbUrl =
      configToTest.databaseURL || `https://${configToTest.projectId}-default-rtdb.firebaseio.com`;
    const testDb = getDatabase(testApp, dbUrl);

    const testRef = ref(testDb, 'sala_damihan/_connection_test');
    await set(testRef, {
      ping: Date.now(),
      client: 'Sala de Juegos Damihan tester',
    });

    // Clean up test app
    await deleteApp(testApp);

    return {
      success: true,
      message: '¡Conexión a Firebase Realtime Database exitosa y verificada!',
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (errorMessage.includes('PERMISSION_DENIED')) {
      return {
        success: false,
        message:
          'Error de permisos: Las reglas de Realtime Database bloquean la escritura. Asegúrate de configurar ".read": true y ".write": true en la pestaña Reglas de Firebase Console.',
      };
    }
    return {
      success: false,
      message: `Error al conectar: ${errorMessage}`,
    };
  }
};

// Cross-tab broadcast channel for instant local real-time sync when on same browser
let localChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    localChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  }
} catch {
  // BroadcastChannel not available
}

/**
 * Pushes updated application state to Firebase Realtime Database.
 * Also emits to BroadcastChannel as fallback for tabs/windows.
 */
export const syncStateToCloud = async (state: RemoteStoreState): Promise<boolean> => {
  // Always notify local broadcast channel
  try {
    localChannel?.postMessage({
      type: 'SYNC_STATE',
      state,
      timestamp: Date.now(),
    });
  } catch {
    // Ignore
  }

  // Push to Firebase Realtime Database if configured
  const { db } = getFirebaseServices();
  if (db) {
    try {
      const stateRef = ref(db, 'sala_damihan/live_state');
      await set(stateRef, {
        ...state,
        updatedAt: Date.now(),
      });
      return true;
    } catch (err) {
      console.warn('Firebase sync failed, retaining local state:', err);
      return false;
    }
  }

  return false;
};

/**
 * Subscribes to Realtime Database changes.
 * Fallback to BroadcastChannel and window storage events if Firebase is not active.
 */
export const subscribeToCloudState = (
  onStateUpdate: (remoteState: RemoteStoreState) => void,
  onConnectionChange?: (connected: boolean) => void
): (() => void) => {
  const unsubscribers: Array<() => void> = [];

  // 1. Firebase Realtime Database listener
  const { db } = getFirebaseServices();
  if (db) {
    try {
      // Listen to database connection status
      const connectedRef = ref(db, '.info/connected');
      const unsubConnected = onValue(connectedRef, (snap) => {
        const isConnected = snap.val() === true;
        onConnectionChange?.(isConnected);
      });
      unsubscribers.push(() => unsubConnected());

      // Listen to live state
      const stateRef = ref(db, 'sala_damihan/live_state');
      const unsubscribeFirebase = onValue(
        stateRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const val = snapshot.val() as RemoteStoreState;
            if (val && val.user) {
              onStateUpdate(val);
            }
          }
        },
        (error) => {
          console.warn('Firebase Realtime listener error:', error);
          onConnectionChange?.(false);
        }
      );
      unsubscribers.push(() => unsubscribeFirebase());
    } catch (err) {
      console.warn('Failed to attach Firebase listener:', err);
      onConnectionChange?.(false);
    }
  } else {
    onConnectionChange?.(false);
  }

  // 2. Local BroadcastChannel listener (works between windows/tabs instantly)
  if (localChannel) {
    const handleBroadcast = (event: MessageEvent) => {
      if (event.data && event.data.type === 'SYNC_STATE' && event.data.state) {
        onStateUpdate(event.data.state as RemoteStoreState);
      }
    };
    localChannel.addEventListener('message', handleBroadcast);
    unsubscribers.push(() => {
      localChannel?.removeEventListener('message', handleBroadcast);
    });
  }

  return () => {
    unsubscribers.forEach((fn) => fn());
  };
};

/**
 * Fetch initial cloud state once
 */
export const fetchCloudStateOnce = async (): Promise<RemoteStoreState | null> => {
  const { db } = getFirebaseServices();
  if (!db) return null;

  try {
    const stateRef = ref(db, 'sala_damihan/live_state');
    const snapshot = await get(stateRef);
    if (snapshot.exists()) {
      return snapshot.val() as RemoteStoreState;
    }
  } catch (err) {
    console.warn('Error fetching cloud state once:', err);
  }
  return null;
};

/**
 * Sync individual voucher to central Firebase vouchers collection
 */
export const syncVoucherToCloud = async (voucher: RedeemVoucher): Promise<boolean> => {
  const { db } = getFirebaseServices();
  if (!db) return false;

  try {
    const voucherRef = ref(db, `sala_damihan/vouchers/${voucher.code}`);
    await set(voucherRef, voucher);
    return true;
  } catch (err) {
    console.warn('Error syncing voucher to cloud:', err);
    return false;
  }
};

/**
 * Subscribe to all central vouchers in Firebase Realtime Database
 */
export const subscribeToCloudVouchers = (
  onVouchersUpdate: (vouchers: RedeemVoucher[]) => void
): (() => void) => {
  const { db } = getFirebaseServices();
  if (!db) return () => {};

  try {
    const vouchersRef = ref(db, 'sala_damihan/vouchers');
    const unsubscribe = onValue(
      vouchersRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const val = snapshot.val();
          if (val && typeof val === 'object') {
            const list = Object.values(val) as RedeemVoucher[];
            onVouchersUpdate(list);
          }
        } else {
          onVouchersUpdate([]);
        }
      },
      (err) => {
        console.warn('Error listening to cloud vouchers:', err);
      }
    );

    return () => unsubscribe();
  } catch (err) {
    console.warn('Failed to subscribe to cloud vouchers:', err);
    return () => {};
  }
};

/**
 * Mark voucher as redeemed centrally in Firebase
 */
export const confirmCloudVoucher = async (
  voucher: RedeemVoucher
): Promise<boolean> => {
  const { db } = getFirebaseServices();
  if (!db) return false;

  try {
    const now = Date.now();
    const updatedVoucher = {
      ...voucher,
      status: 'redeemed' as const,
      redeemedAt: now,
    };

    const voucherRef = ref(db, `sala_damihan/vouchers/${voucher.code}`);
    await set(voucherRef, updatedVoucher);
    return true;
  } catch (err) {
    console.warn('Error confirming voucher in cloud:', err);
    return false;
  }
};
