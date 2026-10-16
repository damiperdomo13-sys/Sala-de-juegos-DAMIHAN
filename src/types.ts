export interface UserProfile {
  id: string;
  name: string;
  email: string;
  minutesBalance: number;
  totalEarnedAllTime: number;
  level: string;
  levelTier: number; // 1: Novato, 2: Bronce, 3: Cyber VIP, 4: Maestro de Sala, 5: Leyenda
  nextLevelTarget: number;
  avatarSeed: string;
  streakDays: number; // Current consecutive calendar days streak
  lastCheckinTimestamp?: number; // Calendar timestamp of last physical check-in
}

export interface LevelTierInfo {
  tier: number;
  name: string;
  badge: string;
  minMinutes: number; // minimum total earned to qualify
  targetMinutes: number; // next goal
  benefit: string;
}

export interface RouletteSector {
  id: string;
  minutes: number;
  label: string;
  color: string;
  textColor: string;
  weight: number; // probability weight
}

export interface RewardTask {
  id: string;
  title: string;
  description: string;
  minutes: number;
  iconType: 'instagram' | 'profile' | 'video' | 'review' | 'referral' | 'checkin';
  completed: boolean;
  claimable: boolean;
  category: string;
}

export interface RedeemVoucher {
  id: string;
  code: string; // e.g. SJD-8942-X
  userId: string;
  userKey?: string; // normalized username or id for database lookup
  userName: string;
  minutes: number;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'redeemed' | 'expired' | 'cancelled';
  redeemedAt?: number;
  adminNotes?: string;
}

export type TransactionType = 'roulette' | 'task' | 'redeem' | 'bonus' | 'admin_adjustment';

export interface Transaction {
  id: string;
  type: TransactionType;
  title: string;
  subtitle: string;
  minutes: number; // positive or negative
  timestamp: number;
  voucherCode?: string;
  status: 'completed' | 'pending' | 'cancelled';
  username?: string;
  userName?: string;
}

export interface UserAccount {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string;
  createdAt: number;
  profile: UserProfile;
  tasks: RewardTask[];
  transactions: Transaction[];
  lastSpinTimestamp: number;
  lastSpinDate?: string;
  lastCheckinTimestamp: number;
  referredBy?: string;
  referralBonusAwarded?: boolean;
}
