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
  CheckCircle2,
} from 'lucide-react';
import { UserProfile, RewardTask, RedeemVoucher } from '../types';
import { calculateUserLevel, isSameCalendarDay } from '../utils/storage';
import { Roulette } from './Roulette';
import { TasksList } from './TasksList';
import { RedeemSection } from './RedeemSection';
import { soundEffects } from '../utils/audio';

interface ClientViewProps {
  user: UserProfile;
  tasks: RewardTask[];
  vouchers?: RedeemVoucher[];
  username?: string;
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
  username,
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
          <span className="flex items-center gap-1.5 font-mono text-emerald-400">
            <Zap className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
            <span>Sistema Activo en Sala Damihan · Canjes habilitados en caja</span>
          </span>
          <span className="font-mono text-slate-500">ID Gamer: {user.id}</span>
        </div>
      </div>

      {/* MÓDULO DESTACADO DE RACHA DE VISITAS PRESENCIALES */}
      {(() => {
        const currentStreak = user.streakDays || 0;
        const isCheckedInToday = isSameCalendarDay(lastCheckinTimestamp, Date.now());
        const nextMilestone = currentStreak === 0 ? 5 : (Math.floor(currentStreak / 5) + 1) * 5;
        const daysToNextMilestone = nextMilestone - currentStreak;

        return (
          <div className="relative rounded-3xl p-6 md:p-7 bg-gradient-to-br from-[#1a0f07] via-[#120d18] to-[#080d19] border-2 border-amber-500/60 shadow-2xl shadow-amber-500/15 overflow-hidden glow-amber">
            {/* Ambient fire illumination */}
            <div className="absolute -top-16 -left-16 w-56 h-56 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -right-16 w-56 h-56 bg-orange-600/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
              {/* Flame Icon & Streak Counter */}
              <div className="flex items-start sm:items-center gap-4">
                <div className="relative shrink-0">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-600 flex items-center justify-center text-slate-950 font-black shadow-xl shadow-orange-500/40 animate-pulse">
                    <Flame className="w-9 h-9 md:w-11 md:h-11 fill-slate-950 text-slate-950" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-950 border-2 border-amber-400 flex items-center justify-center text-amber-400 shadow-sm">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-mono font-bold tracking-widest text-amber-400 uppercase bg-amber-950/80 border border-amber-700/80 px-2.5 py-0.5 rounded-full">
                      SISTEMA DE RACHAS EN SALA
                    </span>
                    {isCheckedInToday ? (
                      <span className="text-[11px] font-semibold text-emerald-300 bg-emerald-950/80 border border-emerald-700/70 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Visita de hoy validada</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-amber-300 bg-amber-950/80 border border-amber-700/70 px-2 py-0.5 rounded-full animate-pulse">
                        ¡Valida tu visita hoy para sumar!
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex items-baseline gap-2">
                    <h3 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-orange-300 to-amber-400 font-mono">
                      {currentStreak}
                    </h3>
                    <span className="text-lg md:text-xl font-black text-white font-sans uppercase">
                      {currentStreak === 1 ? 'DÍA CONSECUTIVO' : 'DÍAS CONSECUTIVOS'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 mt-1 max-w-md">
                    {currentStreak > 0 ? (
                      <span>
                        ¡Mantén la llama viva! Próximo hito: <strong className="text-amber-300 font-bold">Día {nextMilestone}</strong> (en {daysToNextMilestone} {daysToNextMilestone === 1 ? 'día' : 'días'}) para el <strong className="text-emerald-400">Bono Especial de +5 Minutos</strong>.
                      </span>
                    ) : (
                      <span>
                        Escanea el código QR del cartel en la recepción para iniciar tu racha y ganar <strong className="text-amber-300">5 minutos base</strong>.
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Action & Reward Breakdown */}
              <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0">
                <button
                  onClick={() => {
                    soundEffects.playTick(1.1);
                    const el = document.getElementById('seccion-tareas');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className={`py-3 px-5 rounded-xl font-black text-xs md:text-sm tracking-wide shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    isCheckedInToday
                      ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700'
                      : 'bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 text-slate-950 hover:brightness-110 active:scale-95 shadow-orange-500/25 glow-amber'
                  }`}
                >
                  <Flame className="w-4 h-4 fill-current" />
                  <span>{isCheckedInToday ? 'VER DETALLES DE VISITA' : 'VALIDAR VISITA PRESENCIAL'}</span>
                </button>

                {/* Quick Reward Pill Legend */}
                <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                  <div className="bg-slate-950/80 border border-slate-800 px-2.5 py-1 rounded-lg text-slate-300 flex items-center justify-between">
                    <span>Base QR:</span>
                    <strong className="text-emerald-400 font-bold">+5 min</strong>
                  </div>
                  <div className="bg-slate-950/80 border border-slate-800 px-2.5 py-1 rounded-lg text-slate-300 flex items-center justify-between">
                    <span>Día extra:</span>
                    <strong className="text-cyan-400 font-bold">+1 min</strong>
                  </div>
                  <div className="col-span-2 bg-amber-950/40 border border-amber-800/60 px-2.5 py-1 rounded-lg text-amber-200 flex items-center justify-between">
                    <span>Hito cada 5 días (Día 5, 10, 15...):</span>
                    <strong className="text-amber-300 font-bold">¡+5 min bono!</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
            username={username || user.name}
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
