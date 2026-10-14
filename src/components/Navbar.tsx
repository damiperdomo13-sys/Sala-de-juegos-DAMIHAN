import React from 'react';
import {
  Volume2,
  VolumeX,
  User,
  ShieldCheck,
  Zap,
  Lock,
  LogOut,
  LogIn,
} from 'lucide-react';
import { soundEffects } from '../utils/audio';

interface NavbarProps {
  currentView: 'client' | 'admin';
  userName?: string;
  clientMinutes: number;
  soundEnabled: boolean;
  isLoggedIn: boolean;
  onToggleSound: () => void;
  onOpenAdminAccess: () => void;
  onExitAdminView: () => void;
  onOpenAuthModal: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  userName = 'Jugador',
  clientMinutes,
  soundEnabled,
  isLoggedIn,
  onToggleSound,
  onOpenAdminAccess,
  onExitAdminView,
  onOpenAuthModal,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-50 bg-[#07090e]/95 backdrop-blur-md border-b border-slate-800/80 px-3 md:px-4 py-2.5 md:py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 md:gap-4">
        {/* Brand Zone */}
        <div className="flex items-center gap-2.5 md:gap-3">
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/20 shrink-0">
            <Zap className="w-4 h-4 md:w-5 md:h-5 fill-slate-950 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm md:text-lg tracking-wider text-white">
                SALA DE JUEGOS <span className="text-emerald-400">DAMIHAN</span>
              </span>
              {currentView === 'admin' && (
                <span className="text-[10px] font-mono font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 px-2 py-0.5 rounded-full">
                  CAJA / ADMIN
                </span>
              )}
            </div>
            <p className="text-[10px] md:text-[11px] text-slate-400 font-medium hidden sm:block">
              Fidelización y Recompensas en Consolas y Simulador
            </p>
          </div>
        </div>

        {/* Center / User Zone */}
        <div className="flex items-center gap-2 md:gap-3">
          {currentView === 'admin' ? (
            /* In Admin View: Exit button */
            <button
              onClick={() => {
                soundEffects.playTick(1.0);
                onExitAdminView();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-rose-300 hover:text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
            >
              <Lock className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Cerrar Sesión Admin</span>
              <span className="sm:hidden">Salir Admin</span>
            </button>
          ) : isLoggedIn ? (
            /* Logged in customer badge */
            <div className="flex items-center gap-1.5 md:gap-2 bg-slate-900/90 border border-slate-800 rounded-xl p-1 md:pr-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-xs font-bold">
                <User className="w-3.5 h-3.5" />
              </div>
              <div className="text-left hidden xs:block">
                <span className="text-[11px] font-bold text-white block leading-tight max-w-[120px] truncate">
                  {userName}
                </span>
                <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                  {clientMinutes} min
                </span>
              </div>
              <button
                onClick={() => {
                  soundEffects.playTick(0.9);
                  onLogout();
                }}
                title="Cerrar sesión"
                className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer ml-1"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            /* Guest / Login CTA */
            <button
              onClick={() => {
                soundEffects.playTick(1.1);
                onOpenAuthModal();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Iniciar Sesión</span>
            </button>
          )}

          {/* Sound Mute Toggle */}
          <button
            onClick={onToggleSound}
            title={soundEnabled ? 'Silenciar efectos' : 'Activar efectos de sonido'}
            className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
          </button>

          {/* Discreet Admin / Cashier Lock Button */}
          {currentView !== 'admin' && (
            <button
              onClick={() => {
                soundEffects.playTick(1.0);
                onOpenAdminAccess();
              }}
              title="Acceso Personal / Terminal de Caja (Protegido por PIN)"
              className="w-8 h-8 rounded-lg bg-slate-900/70 border border-slate-800 flex items-center justify-center text-slate-500 hover:text-cyan-400 hover:border-cyan-800/60 transition-colors cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
