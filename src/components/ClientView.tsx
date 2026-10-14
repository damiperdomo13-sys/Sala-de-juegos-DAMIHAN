import React, { useState } from 'react';
import {
  Sparkles,
  Trophy,
  Zap,
  ArrowUpRight,
  Clock,
  ShieldCheck,
  Flame,
  Award,
  ChevronRight,
  Gamepad2,
  Lock,
} from 'lucide-react';
import { UserProfile, RewardTask, RedeemVoucher } from '../types';
import { calculateUserLevel } from '../utils/storage';
import { Roulette } from './Roulette';
import { TasksList } from './TasksList';
import { RedeemSection } from './RedeemSection';
import { soundEffects } from '../utils/audio';

interface ClientViewProps {
  user: UserProfile;
  tasks: RewardTask[];
  vouchers?: RedeemVoucher[];
  lastSpinTimestamp: number;
  lastSpinDate?: string;
  lastCheckinTimestamp: number;
  dailyStoreCode: string;
  onSpinWin: (minutes: number) => void;
  onClaimTask: (taskId: string, minutes: number, taskTitle: string) => void;
  onCreateVoucher: (voucher: RedeemVoucher) => void;
  onOpenAdminAccess?: () => void;
}

export const ClientView: React.FC<ClientViewProps> = ({
  user,
  tasks,
  vouchers = [],
  lastSpinTimestamp,
  lastSpinDate,
  lastCheckinTimestamp,
  dailyStoreCode,
  onSpinWin,
  onClaimTask,
  onCreateVoucher,
  onOpenAdminAccess,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'roulette' | 'tasks' | 'redeem'>('all');

  // Convert minutes into hours + minutes string
  const formatEquivalence = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} minutos de juego en sala`;
    if (mins === 0) return `${hours} horas de juego continuo`;
    return `${hours}h ${mins}m de juego en consolas y arcades`;
  };

  // Dynamic Level calculation based on all-time accumulated minutes
  const { currentTier, nextTier, targetMinutes, progressPercent } = calculateUserLevel(
    user.totalEarnedAllTime
  );

  return (
    <div className="space-y-6">
      {/* User Greeting & Level Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0b101b] p-4 rounded-2xl border border-slate-800/80 shadow-md">
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center text-slate-950 font-black text-lg shadow-md shadow-emerald-500/20">
              <Gamepad2 className="w-6 h-6 text-slate-950" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-950 border-2 border-emerald-400 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-2.5 h-2.5" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-white">
                ¡Hola, {user.name}!
              </h2>
              <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-md">
                {currentTier.badge}
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span className="text-slate-200 font-medium">{currentTier.name}</span>
              <span>·</span>
              <span className="text-cyan-400 font-mono font-medium">
                {user.totalEarnedAllTime}m acumulados en total
              </span>
            </p>
          </div>
        </div>

        {/* Dynamic Level Progression Indicator */}
        <div className="sm:text-right bg-slate-900/60 sm:bg-transparent p-2.5 sm:p-0 rounded-xl border border-slate-800 sm:border-none">
          <div className="flex items-center sm:justify-end gap-2 text-xs font-semibold text-slate-300">
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {nextTier
                ? `${nextTier.name} (Meta: ${nextTier.minMinutes}m)`
                : '¡Rango Máximo Alcanzado!'}
            </span>
          </div>
          <div className="w-full sm:w-44 bg-slate-800 h-2 rounded-full overflow-hidden mt-1.5 ml-auto">
            <div
              className="bg-gradient-to-r from-emerald-400 to-cyan-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
            {progressPercent}% hacia el siguiente rango VIP
          </span>
        </div>
      </div>

      {/* Hero Card: Saldo Actual de Minutos (Tarjeta Holográfica Neón) */}
      <div className="relative rounded-3xl p-6 md:p-8 bg-gradient-to-br from-[#0c1424] via-[#09101d] to-[#040810] border border-emerald-500/30 shadow-2xl overflow-hidden glow-neon-combo">
        {/* Ambient neon glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-400 font-mono">
                Billetera Digital · Sala de Juegos Damihan
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-300 font-mono tracking-tight drop-shadow-sm">
                {user.minutesBalance}
              </h1>
              <span className="text-2xl md:text-3xl font-extrabold text-emerald-400 font-sans tracking-wide">
                MINUTOS
              </span>
            </div>

            <p className="text-xs md:text-sm text-slate-300 flex items-center gap-1.5 font-medium">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>Equivale a: </span>
              <strong className="text-cyan-300 font-bold">
                {formatEquivalence(user.minutesBalance)}
              </strong>
            </p>
          </div>

          {/* Quick Action Buttons on Hero */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0">
            <button
              onClick={() => {
                soundEffects.playTick(1.1);
                const el = document.getElementById('seccion-canje');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="py-3 px-5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 text-slate-950 font-black text-xs md:text-sm tracking-wide shadow-lg shadow-emerald-500/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Zap className="w-4 h-4 text-slate-950 fill-slate-950" />
              <span>CANJEAR MINUTOS EN CAJA</span>
              <ArrowUpRight className="w-4 h-4 text-slate-950" />
            </button>

            <button
              onClick={() => {
                soundEffects.playTick(1.1);
                const el = document.getElementById('seccion-ruleta');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="py-2.5 px-4 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>Girar Ruleta Diaria</span>
            </button>
          </div>
        </div>

        {/* Card Footer Bar */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
          <span className="flex items-center gap-1.5">
            <Flame
              className={`w-4 h-4 ${
                user.streakDays > 0
                  ? 'text-amber-400 fill-amber-400 animate-pulse'
                  : 'text-slate-500'
              }`}
            />
            <span>Racha de visitas a la sala:</span>
            <strong
              className={`font-bold ${
                user.streakDays > 0 ? 'text-emerald-400 font-mono text-xs' : 'text-slate-400 font-mono text-xs'
              }`}
            >
              {user.streakDays || 0} {user.streakDays === 1 ? 'día consecutivo' : 'días consecutivos'}
            </strong>
            {user.streakDays === 0 && (
              <span className="text-[10px] text-amber-400/90 bg-amber-950/60 border border-amber-800/50 px-1.5 py-0.5 rounded-md">
                Inactividad · ¡Visita hoy para iniciar racha!
              </span>
            )}
          </span>
          <span className="font-mono text-slate-500">ID Gamer: {user.id}</span>
        </div>
      </div>

      {/* Tab Navigation for sections */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'all'
              ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Ver Todo
        </button>
        <button
          onClick={() => setActiveTab('roulette')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'roulette'
              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          🎰 Ruleta Diaria
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'tasks'
              ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/60 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          ⚡ Tareas & Visita Presencial
        </button>
        <button
          onClick={() => setActiveTab('redeem')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'redeem'
              ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          🎟️ Canje de Minutos (QR)
        </button>
      </div>

      {/* Section 1: Ruleta Diaria */}
      {(activeTab === 'all' || activeTab === 'roulette') && (
        <div id="seccion-ruleta">
          <Roulette
            lastSpinTimestamp={lastSpinTimestamp}
            lastSpinDate={lastSpinDate}
            onSpinWin={onSpinWin}
          />
        </div>
      )}

      {/* Section 2: Tareas Recompensadas & Visita Presencial */}
      {(activeTab === 'all' || activeTab === 'tasks') && (
        <div id="seccion-tareas">
          <TasksList
            tasks={tasks}
            lastCheckinTimestamp={lastCheckinTimestamp}
            dailyStoreCode={dailyStoreCode}
            userStreak={user.streakDays || 0}
            onClaimTask={onClaimTask}
          />
        </div>
      )}

      {/* Section 3: Canje de Minutos */}
      {(activeTab === 'all' || activeTab === 'redeem') && (
        <div id="seccion-canje">
          <RedeemSection
            currentBalance={user.minutesBalance}
            userName={user.name}
            userId={user.id}
            vouchers={vouchers}
            onCreateVoucher={onCreateVoucher}
          />
        </div>
      )}

      {/* Discreet Admin / Cashier Access Footer */}
      {onOpenAdminAccess && (
        <div className="pt-8 pb-4 text-center">
          <button
            onClick={onOpenAdminAccess}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-slate-500 hover:text-slate-300 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-all cursor-pointer font-mono"
            title="Acceso restringido para personal de caja"
          >
            <Lock className="w-3 h-3 text-slate-600" />
            <span>Acceso Personal / Caja (Protegido por PIN)</span>
          </button>
        </div>
      )}
    </div>
  );
};
