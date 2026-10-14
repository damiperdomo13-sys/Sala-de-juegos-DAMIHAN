import React, { useState, useEffect } from 'react';
import {
  User,
  Lock,
  Sparkles,
  Eye,
  EyeOff,
  UserPlus,
  LogIn,
  AlertCircle,
  CheckCircle2,
  Gamepad2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { registerCustomer, loginCustomer } from '../utils/auth';
import { UserAccount } from '../types';
import { soundEffects } from '../utils/audio';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  canDismiss?: boolean;
  onAuthSuccess: (account: UserAccount) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  canDismiss = false,
  onAuthSuccess,
}) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [referredBy, setReferredBy] = useState<string>('');

  // Auto-detect ?ref= username from URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const refCode = params.get('ref');
      if (refCode) {
        setReferredBy(refCode.trim());
        setTab('register');
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (tab === 'register') {
        if (password !== confirmPassword) {
          setError('Las contraseñas no coinciden. Por favor verifícalas.');
          soundEffects.playError();
          setLoading(false);
          return;
        }

        const res = await registerCustomer(username, password, displayName, referredBy);
        if (res.success && res.account) {
          soundEffects.playWin();
          setSuccessMsg(res.message);
          setTimeout(() => {
            onAuthSuccess(res.account!);
          }, 600);
        } else {
          soundEffects.playError();
          setError(res.message);
        }
      } else {
        const res = await loginCustomer(username, password);
        if (res.success && res.account) {
          soundEffects.playTick(1.2);
          setSuccessMsg(res.message);
          setTimeout(() => {
            onAuthSuccess(res.account!);
          }, 500);
        } else {
          soundEffects.playError();
          setError(res.message);
        }
      }
    } catch (err: unknown) {
      soundEffects.playError();
      setError('Ocurrió un error inesperado al procesar tu solicitud.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTabSwitch = (newTab: 'login' | 'register') => {
    soundEffects.playTick(1.0);
    setTab(newTab);
    setError(null);
    setSuccessMsg(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0b101b] border border-emerald-500/40 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl relative glow-emerald">
        {/* Dismiss Button if allowed */}
        {canDismiss && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Brand Header */}
        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-500 p-0.5 mx-auto mb-3 shadow-lg shadow-emerald-500/20">
            <div className="w-full h-full bg-[#0b101b] rounded-2xl flex items-center justify-center text-emerald-400">
              <Gamepad2 className="w-7 h-7" />
            </div>
          </div>
          <h3 className="text-xl font-black text-white">
            SALA DE JUEGOS <span className="text-emerald-400">DAMIHAN</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Portal de Fidelización y Acumulación de Minutos
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 mb-5">
          <button
            type="button"
            onClick={() => handleTabSwitch('login')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              tab === 'login'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Iniciar Sesión</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch('register')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              tab === 'register'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Crear Cuenta</span>
          </button>
        </div>

        {/* Registration Info Note */}
        {tab === 'register' && (
          <div className="space-y-2.5 mb-4">
            {referredBy && (
              <div className="bg-amber-950/50 border border-amber-500/50 rounded-xl p-3 flex items-center gap-2.5 text-xs text-amber-200">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <span className="font-semibold text-amber-300">¡Enlace de Referido Detectado!</span>
                  <p className="text-[11px] text-amber-200/90 mt-0.5">
                    Invitado por <strong className="text-white font-mono">@{referredBy}</strong>. Al registrarte se acreditarán automáticamente +25 min a tu amigo.
                  </p>
                </div>
              </div>
            )}

            <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-xl p-3 flex items-start gap-2.5 text-xs text-emerald-200">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold text-emerald-300">Regla de Cuenta Oficial:</strong>
                <span>Tu cuenta iniciará con <strong>0 minutos</strong>, <strong>Nivel 1 (Novato)</strong> y racha en <strong>0 días</strong>. ¡Gira la ruleta y visita la sala para empezar a subir de nivel!</span>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {tab === 'register' && (
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Nombre o Apodo de Jugador
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Ej: Daniel Gómez"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 transition-colors"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Nombre de Usuario
            </label>
            <div className="relative">
              <input
                type="text"
                required
                autoCapitalize="none"
                placeholder="Ej: gamer_daniel"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 font-mono transition-colors"
              />
              <User className="w-3.5 h-3.5 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Mínimo 4 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-slate-500 hover:text-slate-300 absolute right-3 top-1/2 -translate-y-1/2 p-1 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {tab === 'register' && (
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Confirmar Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Repite tu contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 transition-colors"
                />
                <Lock className="w-3.5 h-3.5 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wide bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 text-slate-950 shadow-lg shadow-emerald-500/25 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer glow-emerald disabled:opacity-50"
          >
            {loading ? (
              <span>Cargando cuenta...</span>
            ) : tab === 'register' ? (
              <>
                <UserPlus className="w-4 h-4 text-slate-950" />
                <span>Registrar Mi Cuenta de Jugador</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4 text-slate-950" />
                <span>Ingresar a Mi Cuenta</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-4 pt-3 border-t border-slate-800/80 text-center">
          <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Sesión guardada de forma segura para no tener que iniciar sesión cada vez.</span>
          </p>
        </div>
      </div>
    </div>
  );
};
