import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  UserProfile,
  RewardTask,
  RedeemVoucher,
  Transaction,
  UserAccount,
} from './types';
import {
  loadStoredUser,
  saveStoredUser,
  loadStoredTasks,
  saveStoredTasks,
  loadStoredTransactions,
  saveStoredTransactions,
  loadStoredVouchers,
  saveStoredVouchers,
  loadLastSpinTimestamp,
  saveLastSpinTimestamp,
  loadLastSpinDate,
  saveLastSpinDate,
  getTodayDateString,
  loadLastCheckinTimestamp,
  saveLastCheckinTimestamp,
  calculateUserLevel,
  getDynamicDailyStoreCode,
  getCalendarDayDifference,
  evaluateUserStreak,
  DEFAULT_USER,
  INITIAL_TASKS,
  STORE_NAME,
} from './utils/storage';
import { soundEffects } from './utils/audio';
import {
  getActiveFirebaseConfig,
  subscribeToCloudState,
  syncStateToCloud,
  RemoteStoreState,
  fetchCloudStateOnce,
  syncVoucherToCloud,
  subscribeToCloudVouchers,
  confirmCloudVoucher,
} from './utils/firebase';
import {
  getActiveSessionUsername,
  logoutCustomer,
  fetchUserAccount,
  saveAccountToCloud,
  subscribeToCustomerCloud,
} from './utils/auth';
import { Navbar } from './components/Navbar';
import { ClientView } from './components/ClientView';
import { AdminView } from './components/AdminView';
import { AuthModal } from './components/AuthModal';
import { AdminPinModal } from './components/AdminPinModal';
import { Zap, X, ShieldAlert } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState<'client' | 'admin'>('client');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [isAdminPinModalOpen, setIsAdminPinModalOpen] = useState<boolean>(false);

  // Authentication State
  const [currentUserAccount, setCurrentUserAccount] = useState<UserAccount | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Application User Data (Starts with clean defaults or loaded user)
  const [user, setUser] = useState<UserProfile>(loadStoredUser);
  const [tasks, setTasks] = useState<RewardTask[]>(loadStoredTasks);
  const [transactions, setTransactions] = useState<Transaction[]>(loadStoredTransactions);
  const [vouchers, setVouchers] = useState<RedeemVoucher[]>(loadStoredVouchers);
  const [lastSpinTimestamp, setLastSpinTimestamp] = useState<number>(loadLastSpinTimestamp);
  const [lastSpinDate, setLastSpinDate] = useState<string>(loadLastSpinDate);
  const [lastCheckinTimestamp, setLastCheckinTimestamp] = useState<number>(loadLastCheckinTimestamp);

  // Cloud Notification Toast
  const [cloudToast, setCloudToast] = useState<{
    message: string;
    type: 'success' | 'info';
  } | null>(null);

  // Dynamic daily store code based on calendar date (updates automatically every day at 00:00)
  const [dailyStoreCode] = useState<string>(() => getDynamicDailyStoreCode(new Date()));
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Ref to hold current state snapshot for cloud sync
  const stateRef = useRef({
    user,
    tasks,
    transactions,
    vouchers,
    lastSpinTimestamp,
    lastSpinDate,
    lastCheckinTimestamp,
    currentUserAccount,
  });

  useEffect(() => {
    stateRef.current = {
      user,
      tasks,
      transactions,
      vouchers,
      lastSpinTimestamp,
      lastSpinDate,
      lastCheckinTimestamp,
      currentUserAccount,
    };
  }, [user, tasks, transactions, vouchers, lastSpinTimestamp, lastSpinDate, lastCheckinTimestamp, currentUserAccount]);

  // Load existing user session or prompt AuthModal on startup
  useEffect(() => {
    const savedUsername = getActiveSessionUsername();
    if (savedUsername) {
      fetchUserAccount(savedUsername).then((account) => {
        if (account && account.profile) {
          applyUserAccount(account);
        } else {
          setIsAuthModalOpen(true);
        }
      });
    } else {
      // No active session: show clean Login/Register modal for clients
      setIsAuthModalOpen(true);
    }

    // Check if URL attempted direct access to ?view=admin
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'admin') {
        // Intercept: prompt PIN instead of showing admin directly
        setIsAdminPinModalOpen(true);
      }
    }
  }, []);

  // Subscribe to real-time changes of the logged-in customer's account in Firebase
  useEffect(() => {
    if (!currentUserAccount) return;

    const unsubscribe = subscribeToCustomerCloud(currentUserAccount.username, (updatedAccount) => {
      if (updatedAccount && updatedAccount.profile) {
        const prevBal = stateRef.current.user.minutesBalance;
        const newBal = updatedAccount.profile.minutesBalance;

        if (prevBal !== newBal && newBal < prevBal) {
          const diff = prevBal - newBal;
          setCloudToast({
            message: `¡Canje confirmado en caja! Se descontaron ${diff} min. Saldo actual: ${newBal}m`,
            type: 'success',
          });
          soundEffects.playWin();
        }

        applyUserAccount(updatedAccount, false);
      }
    });

    return () => unsubscribe();
  }, [currentUserAccount?.username]);

  // Subscribe to global vouchers in Firebase
  useEffect(() => {
    const unsubscribeVouchers = subscribeToCloudVouchers((cloudVouchers) => {
      if (cloudVouchers && cloudVouchers.length > 0) {
        setVouchers(cloudVouchers);
        saveStoredVouchers(cloudVouchers);
      }
    });

    return () => unsubscribeVouchers();
  }, []);

  // Helper to apply user account data to local state
  const applyUserAccount = (account: UserAccount, persistSession = true) => {
    setCurrentUserAccount(account);

    const checkinTs = account.lastCheckinTimestamp || 0;
    const evaluatedUser = evaluateUserStreak(account.profile, checkinTs);

    setUser(evaluatedUser);
    setTasks(account.tasks || INITIAL_TASKS);
    setTransactions(account.transactions || []);
    setLastSpinTimestamp(account.lastSpinTimestamp || 0);
    setLastSpinDate(account.lastSpinDate || '');
    setLastCheckinTimestamp(checkinTs);

    saveStoredUser(evaluatedUser);
    if (account.tasks) saveStoredTasks(account.tasks);
    if (account.transactions) saveStoredTransactions(account.transactions);
    if (account.lastSpinTimestamp !== undefined) saveLastSpinTimestamp(account.lastSpinTimestamp);
    if (account.lastSpinDate !== undefined) saveLastSpinDate(account.lastSpinDate);
    if (account.lastCheckinTimestamp !== undefined) saveLastCheckinTimestamp(account.lastCheckinTimestamp);

    if (persistSession) {
      setIsAuthModalOpen(false);
    }
  };

  // Helper to sync latest customer state to Firebase & LocalStorage
  const syncAccountChanges = useCallback(
    async (overrides: {
      profile?: UserProfile;
      tasks?: RewardTask[];
      transactions?: Transaction[];
      lastSpinTimestamp?: number;
      lastSpinDate?: string;
      lastCheckinTimestamp?: number;
    }) => {
      const cur = stateRef.current;
      const updatedProfile = overrides.profile || cur.user;
      const updatedTasks = overrides.tasks || cur.tasks;
      const updatedTxs = overrides.transactions || cur.transactions;
      const updatedSpinTs =
        overrides.lastSpinTimestamp !== undefined
          ? overrides.lastSpinTimestamp
          : cur.lastSpinTimestamp;
      const updatedSpinDate =
        overrides.lastSpinDate !== undefined ? overrides.lastSpinDate : cur.lastSpinDate;
      const updatedCheckinTs =
        overrides.lastCheckinTimestamp !== undefined
          ? overrides.lastCheckinTimestamp
          : cur.lastCheckinTimestamp;

      // Update local storage
      saveStoredUser(updatedProfile);
      saveStoredTasks(updatedTasks);
      saveStoredTransactions(updatedTxs);
      saveLastSpinTimestamp(updatedSpinTs);
      saveLastSpinDate(updatedSpinDate);
      saveLastCheckinTimestamp(updatedCheckinTs);

      // If user is authenticated, persist to their individual Firebase document
      if (cur.currentUserAccount) {
        const updatedAccount: UserAccount = {
          ...cur.currentUserAccount,
          profile: updatedProfile,
          tasks: updatedTasks,
          transactions: updatedTxs,
          lastSpinTimestamp: updatedSpinTs,
          lastSpinDate: updatedSpinDate,
          lastCheckinTimestamp: updatedCheckinTs,
        };
        setCurrentUserAccount(updatedAccount);
        await saveAccountToCloud(updatedAccount);
      }

      // Also sync to general cloud state
      syncStateToCloud({
        user: updatedProfile,
        tasks: updatedTasks,
        transactions: updatedTxs,
        vouchers: cur.vouchers,
        lastSpinTimestamp: updatedSpinTs,
        lastSpinDate: updatedSpinDate,
        lastCheckinTimestamp: updatedCheckinTs,
        updatedAt: Date.now(),
        updatedBy: currentView,
      });
    },
    [currentView]
  );

  // Audio mute toggle
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundEffects.enabled = next;
    if (next) soundEffects.playTick(1.2);
  };

  // Admin view access control: Protected with PIN
  const handleOpenAdminAccess = () => {
    if (isAdminAuthenticated) {
      setCurrentView('admin');
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('view', 'admin');
        window.history.replaceState({}, '', url.toString());
      }
    } else {
      setIsAdminPinModalOpen(true);
    }
  };

  const handleAdminPinSuccess = () => {
    setIsAdminAuthenticated(true);
    setIsAdminPinModalOpen(false);
    setCurrentView('admin');
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('view', 'admin');
      window.history.replaceState({}, '', url.toString());
    }
  };

  const handleExitAdminView = () => {
    setIsAdminAuthenticated(false);
    setCurrentView('client');
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('view', 'client');
      window.history.replaceState({}, '', url.toString());
    }
  };

  // Client user logout
  const handleCustomerLogout = () => {
    logoutCustomer();
    setCurrentUserAccount(null);
    setUser(DEFAULT_USER);
    setTasks(INITIAL_TASKS);
    setTransactions([]);
    setLastSpinTimestamp(0);
    setLastSpinDate('');
    setLastCheckinTimestamp(0);
    setIsAuthModalOpen(true);
  };

  // Grant minutes to user and advance levels
  const creditUserMinutes = (minutesAdded: number) => {
    const prev = stateRef.current.user;
    const newTotalEarned = prev.totalEarnedAllTime + minutesAdded;
    const { currentTier, targetMinutes } = calculateUserLevel(newTotalEarned);

    if (currentTier.tier > prev.levelTier) {
      soundEffects.playWin();
      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.5 },
        });
      } catch {
        // Ignore
      }
      setCloudToast({
        message: `🎉 ¡Subiste de Rango! Ahora eres ${currentTier.name}`,
        type: 'success',
      });
    }

    const updatedUser: UserProfile = {
      ...prev,
      minutesBalance: prev.minutesBalance + minutesAdded,
      totalEarnedAllTime: newTotalEarned,
      level: currentTier.name,
      levelTier: currentTier.tier,
      nextLevelTarget: targetMinutes,
    };

    setUser(updatedUser);
    return updatedUser;
  };

  // Roulette spin win handler
  const handleSpinWin = (minutesWon: number) => {
    const now = Date.now();
    const todayStr = getTodayDateString(new Date(now));
    setLastSpinTimestamp(now);
    setLastSpinDate(todayStr);

    let updatedUser = stateRef.current.user;
    let newTx: Transaction;

    if (minutesWon > 0) {
      updatedUser = creditUserMinutes(minutesWon);
      newTx = {
        id: `tx_${now}`,
        type: 'roulette',
        title: 'Ruleta Diaria de la Suerte',
        subtitle: `Premio obtenido: +${minutesWon} min`,
        minutes: minutesWon,
        timestamp: now,
        status: 'completed',
      };
    } else {
      newTx = {
        id: `tx_${now}`,
        type: 'roulette',
        title: 'Ruleta Diaria - Vuelve a intentar',
        subtitle: 'Tirada sin premio adicional',
        minutes: 0,
        timestamp: now,
        status: 'completed',
      };
    }

    const updatedTxs = [newTx, ...stateRef.current.transactions];
    setTransactions(updatedTxs);

    syncAccountChanges({
      profile: updatedUser,
      transactions: updatedTxs,
      lastSpinTimestamp: now,
      lastSpinDate: todayStr,
    });
  };

  // Task claim handler
  const handleClaimTask = (taskId: string, minutes: number, taskTitle: string) => {
    const now = Date.now();
    let updatedUser = stateRef.current.user;
    let updatedTasks = stateRef.current.tasks;
    let updatedCheckinTime = stateRef.current.lastCheckinTimestamp;

    if (taskId === 'task-checkin') {
      const curStreak = updatedUser.streakDays || 0;
      let newStreak = curStreak + 1;
      const prevCheckin = updatedUser.lastCheckinTimestamp || 0;

      if (prevCheckin > 0) {
        const diff = getCalendarDayDifference(new Date(prevCheckin), new Date(now));
        if (diff > 1) {
          newStreak = 1;
        } else if (diff === 0) {
          newStreak = Math.max(1, curStreak);
        }
      }

      updatedCheckinTime = now;
      setLastCheckinTimestamp(now);

      updatedTasks = updatedTasks.map((t) =>
        t.id === 'task-checkin' ? { ...t, completed: true, claimable: false } : t
      );
      setTasks(updatedTasks);

      const newTotalEarned = updatedUser.totalEarnedAllTime + minutes;
      const { currentTier, targetMinutes } = calculateUserLevel(newTotalEarned);

      updatedUser = {
        ...updatedUser,
        minutesBalance: updatedUser.minutesBalance + minutes,
        totalEarnedAllTime: newTotalEarned,
        level: currentTier.name,
        levelTier: currentTier.tier,
        nextLevelTarget: targetMinutes,
        streakDays: newStreak,
        lastCheckinTimestamp: now,
      };
      setUser(updatedUser);

      setCloudToast({
        message: `🔥 ¡Visita presencial registrada! Racha de visitas: ${newStreak} ${newStreak === 1 ? 'día' : 'días'} (+5 min)`,
        type: 'success',
      });
    } else {
      updatedTasks = updatedTasks.map((t) =>
        t.id === taskId ? { ...t, completed: true, claimable: false } : t
      );
      setTasks(updatedTasks);
      updatedUser = creditUserMinutes(minutes);
    }

    const newTx: Transaction = {
      id: `tx_${now}`,
      type: 'task',
      title: taskTitle,
      subtitle:
        taskId === 'task-checkin'
          ? `Visita presencial verificada en ${STORE_NAME} (Racha: ${updatedUser.streakDays}d)`
          : `Misión completada (+${minutes}m)`,
      minutes: minutes,
      timestamp: now,
      status: 'completed',
    };

    const updatedTxs = [newTx, ...stateRef.current.transactions];
    setTransactions(updatedTxs);

    syncAccountChanges({
      profile: updatedUser,
      tasks: updatedTasks,
      transactions: updatedTxs,
      lastCheckinTimestamp: updatedCheckinTime,
    });
  };

  // Create voucher from client - syncs to Firebase
  const handleCreateVoucher = (voucher: RedeemVoucher) => {
    const enrichedVoucher: RedeemVoucher = {
      ...voucher,
      userKey: currentUserAccount?.username || voucher.userName,
    };

    setVouchers((prev) => {
      const updated = [
        enrichedVoucher,
        ...prev.filter((v) => v.id !== voucher.id && v.code !== voucher.code),
      ];
      saveStoredVouchers(updated);
      syncVoucherToCloud(enrichedVoucher);
      return updated;
    });
  };

  // Confirm redemption and deduct minutes in Admin view
  const handleConfirmRedemption = async (voucher: RedeemVoucher) => {
    const now = Date.now();
    const curUser = stateRef.current.user;

    // Deduct from balance
    const updatedUser: UserProfile = {
      ...curUser,
      minutesBalance: Math.max(0, curUser.minutesBalance - voucher.minutes),
    };
    setUser(updatedUser);

    // Update voucher status across memory and storage
    const updatedVouchers = stateRef.current.vouchers.map((v) =>
      v.id === voucher.id || v.code === voucher.code
        ? { ...v, status: 'redeemed' as const, redeemedAt: now }
        : v
    );
    setVouchers(updatedVouchers);
    saveStoredVouchers(updatedVouchers);

    // Record transaction
    const newTx: Transaction = {
      id: `tx_${now}`,
      type: 'redeem',
      title: `Canje de Minutos en ${STORE_NAME}`,
      subtitle: `Voucher: ${voucher.code} · ${voucher.userName}`,
      minutes: -voucher.minutes,
      timestamp: now,
      voucherCode: voucher.code,
      status: 'completed',
    };
    const updatedTxs = [newTx, ...stateRef.current.transactions];
    setTransactions(updatedTxs);

    // Confirm centrally in Firebase
    await confirmCloudVoucher(voucher);

    syncAccountChanges({
      profile: updatedUser,
      transactions: updatedTxs,
    });
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Navbar */}
      <Navbar
        currentView={currentView}
        userName={currentUserAccount?.displayName || user.name}
        clientMinutes={user.minutesBalance}
        soundEnabled={soundEnabled}
        isLoggedIn={!!currentUserAccount}
        onToggleSound={toggleSound}
        onOpenAdminAccess={handleOpenAdminAccess}
        onExitAdminView={handleExitAdminView}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onLogout={handleCustomerLogout}
      />

      {/* Real-time Notification Banner */}
      {cloudToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-md w-11/12 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-emerald-950/95 border border-emerald-500/60 text-emerald-200 px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between gap-3 backdrop-blur-md">
            <div className="flex items-center gap-2.5 text-xs font-medium">
              <Zap className="w-4 h-4 text-emerald-400 shrink-0 fill-emerald-400" />
              <span>{cloudToast.message}</span>
            </div>
            <button
              onClick={() => setCloudToast(null)}
              className="text-emerald-400 hover:text-white p-1 rounded-lg cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        {currentView === 'client' ? (
          <ClientView
            user={user}
            tasks={tasks}
            vouchers={vouchers}
            lastSpinTimestamp={lastSpinTimestamp}
            lastSpinDate={lastSpinDate}
            lastCheckinTimestamp={lastCheckinTimestamp}
            dailyStoreCode={dailyStoreCode}
            onSpinWin={handleSpinWin}
            onClaimTask={handleClaimTask}
            onCreateVoucher={handleCreateVoucher}
            onOpenAdminAccess={handleOpenAdminAccess}
          />
        ) : (
          <AdminView
            user={user}
            vouchers={vouchers}
            transactions={transactions}
            dailyStoreCode={dailyStoreCode}
            onConfirmRedemption={handleConfirmRedemption}
            onSwitchToClientView={handleExitAdminView}
          />
        )}
      </main>

      {/* Client Registration & Login Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        canDismiss={!!currentUserAccount}
        onAuthSuccess={(account) => applyUserAccount(account)}
      />

      {/* Cashier / Admin Protected PIN Access Modal */}
      <AdminPinModal
        isOpen={isAdminPinModalOpen}
        onClose={() => setIsAdminPinModalOpen(false)}
        onSuccess={handleAdminPinSuccess}
      />
    </div>
  );
}
