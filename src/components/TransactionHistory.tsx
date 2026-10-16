import React, { useState } from 'react';
import {
  History,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  User,
  Sparkles,
  Flame,
  Gift,
  RotateCcw,
} from 'lucide-react';
import { Transaction } from '../types';
import { isCurrentCalendarMonth, getCurrentMonthName } from '../utils/firebase';

interface TransactionHistoryProps {
  transactions: Transaction[];
  isGlobal?: boolean;
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  transactions,
  isGlobal = false,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [monthScope, setMonthScope] = useState<'current' | 'all'>('current');

  const currentMonthName = getCurrentMonthName();

  // 1. Filter by calendar month (resets automatically at 00:00 h on day 1 of every month)
  const monthlyTransactions = transactions.filter((t) => {
    if (monthScope === 'all') return true;
    return isCurrentCalendarMonth(t.timestamp);
  });

  // 2. Filter by category
  const filtered = monthlyTransactions.filter((t) => {
    if (filterType === 'all') return true;
    if (filterType === 'redeem') return t.type === 'redeem';
    if (filterType === 'roulette') return t.type === 'roulette';
    if (filterType === 'checkin') {
      const lowerTitle = (t.title || '').toLowerCase();
      return lowerTitle.includes('check-in') || lowerTitle.includes('racha') || lowerTitle.includes('visita');
    }
    if (filterType === 'referral') {
      const lower = (t.title + ' ' + (t.subtitle || '')).toLowerCase();
      return t.type === 'bonus' || lower.includes('referido') || lower.includes('invit');
    }
    return true;
  });

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-[#0b101b] rounded-2xl p-5 border border-slate-800/80 shadow-xl">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-white text-base md:text-lg">
              {isGlobal ? 'Historial de Transacciones Global' : 'Historial de Transacciones'}
            </h3>
            <span className="text-[10px] font-mono font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 px-2 py-0.5 rounded-full">
              {monthScope === 'current' ? `Mes: ${currentMonthName}` : 'Histórico Total'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {isGlobal
              ? `Actividad consolidada de todos los clientes. Se reinicia automáticamente el día 1 de cada mes a las 00:00 h.`
              : 'Registro de tus giros, visitas presenciales, bonos y canjes aprobados en el sistema.'}
          </p>
        </div>

        {/* Month Scope Toggle and Category Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Month Scope Selector */}
          <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setMonthScope('current')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                monthScope === 'current'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Muestra las transacciones del mes calendario actual (se limpia el día 1 a las 00:00)"
            >
              <Calendar className="w-3 h-3" />
              <span>Mes Actual</span>
            </button>
            <button
              onClick={() => setMonthScope('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                monthScope === 'all'
                  ? 'bg-slate-800 text-white shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Muestra el histórico acumulado de todos los meses"
            >
              <span>Todos los Meses</span>
            </button>
          </div>

          {/* Category Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filterType === 'all'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todos ({monthlyTransactions.length})
            </button>
            <button
              onClick={() => setFilterType('redeem')}
              className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filterType === 'redeem'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Canjes
            </button>
            <button
              onClick={() => setFilterType('checkin')}
              className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filterType === 'checkin'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Check-in / Rachas
            </button>
            <button
              onClick={() => setFilterType('roulette')}
              className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filterType === 'roulette'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Ruleta
            </button>
            <button
              onClick={() => setFilterType('referral')}
              className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filterType === 'referral'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Referidos & Bonos
            </button>
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="divide-y divide-slate-800/60 max-h-96 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-xs space-y-1">
            <p>No hay transacciones registradas para este filtro en {monthScope === 'current' ? currentMonthName : 'el sistema'}.</p>
            {monthScope === 'current' && (
              <p className="text-[11px] text-slate-600">
                Las transacciones se acumulan automáticamente a medida que los clientes juegan la ruleta, validan visitas y canjean minutos.
              </p>
            )}
          </div>
        ) : (
          filtered.map((item) => {
            const isPositive = item.minutes > 0;
            const isRedeem = item.type === 'redeem';
            const clientUsername = item.username || 'cliente';

            return (
              <div
                key={item.id}
                className="py-3 flex items-center justify-between gap-3 hover:bg-slate-900/40 px-2 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                      isPositive
                        ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-400'
                        : 'bg-rose-950/40 border-rose-800/40 text-rose-400'
                    }`}
                  >
                    {isPositive ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Cliente Username Badge - Prominente para Admin y Global */}
                      <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-cyan-950/80 border border-cyan-800/70 text-cyan-300 font-bold shrink-0">
                        @{clientUsername}
                      </span>
                      <h4 className="font-semibold text-xs md:text-sm text-slate-100 truncate">
                        {item.title}
                      </h4>
                    </div>

                    <p className="text-xs text-slate-300 truncate mt-0.5">
                      {item.subtitle}
                    </p>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span>{formatDate(item.timestamp)}</span>
                      {item.voucherCode && (
                        <>
                          <span>·</span>
                          <span className="font-mono text-cyan-400 font-semibold">
                            {item.voucherCode}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`font-mono font-bold text-sm block ${
                      isPositive ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isPositive ? `+${item.minutes}` : item.minutes} min
                  </span>
                  <span className="text-[10px] text-slate-500 capitalize">
                    {item.status === 'completed' ? 'Aprobado' : item.status}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
