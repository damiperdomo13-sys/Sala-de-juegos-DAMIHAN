import React, { useState } from 'react';
import {
  ShieldAlert,
  Lock,
  KeyRound,
  X,
  Check,
  Delete,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { verifyAdminPin } from '../utils/auth';
import { soundEffects } from '../utils/audio';

interface AdminPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminPinModal: React.FC<AdminPinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    soundEffects.playTick(1.1);
    setError(false);
    setErrorMessage('');
    if (pin.length < 8) {
      setPin((prev) => prev + digit);
    }
  };

  const handleBackspace = () => {
    soundEffects.playTick(0.9);
    setError(false);
    setErrorMessage('');
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    soundEffects.playTick(0.8);
    setError(false);
    setErrorMessage('');
    setPin('');
  };

  const handleVerify = (enteredPin = pin) => {
    if (!enteredPin) {
      setError(true);
      setErrorMessage('Por favor introduce el PIN de acceso.');
      soundEffects.playError();
      return;
    }

    if (verifyAdminPin(enteredPin)) {
      soundEffects.playWin();
      setPin('');
      setError(false);
      onSuccess();
    } else {
      soundEffects.playError();
      setError(true);
      setErrorMessage('PIN incorrecto. Acceso exclusivo para personal de caja.');
      setPin('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleVerify();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`bg-[#0b101b] border rounded-3xl p-6 sm:p-7 max-w-sm w-full text-center shadow-2xl relative transition-all duration-200 ${
          error
            ? 'border-rose-500/80 shadow-rose-500/20 animate-shake'
            : 'border-cyan-500/50 glow-cyan'
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon */}
        <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center mx-auto mb-3 text-cyan-400 shadow-lg shadow-cyan-500/20">
          <Lock className="w-7 h-7" />
        </div>

        <span className="text-[10px] font-mono font-bold tracking-widest text-cyan-400 uppercase bg-cyan-950/80 border border-cyan-800/80 px-3 py-1 rounded-full inline-block mb-1">
          ÁREA RESTRINGIDA
        </span>
        <h3 className="text-xl font-black text-white mt-1">
          Terminal de Caja y Control
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Ingresa la clave de empleado para abrir el escáner de canjes.
        </p>

        {/* PIN Display Dots / Input */}
        <div className="my-5">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center justify-center gap-3">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all ${
                  pin.length > idx
                    ? 'bg-cyan-400 shadow-md shadow-cyan-400/50 scale-110'
                    : 'bg-slate-800 border border-slate-700'
                }`}
              />
            ))}
          </div>

          <div className="mt-2">
            <input
              type="password"
              inputMode="numeric"
              placeholder="PIN de acceso..."
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError(false);
              }}
              onKeyDown={handleKeyDown}
              className="w-full text-center bg-transparent text-sm text-cyan-300 font-mono tracking-widest focus:outline-none"
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center justify-center gap-1.5 text-xs text-rose-400 bg-rose-950/40 border border-rose-900/60 p-2 rounded-xl">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Touch Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2 max-w-[260px] mx-auto mb-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-12 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-bold text-lg active:scale-95 transition-all cursor-pointer flex items-center justify-center font-mono"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="h-12 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-xs font-bold active:scale-95 transition-all cursor-pointer flex items-center justify-center font-mono"
          >
            C
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-12 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-bold text-lg active:scale-95 transition-all cursor-pointer flex items-center justify-center font-mono"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-12 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-xs font-bold active:scale-95 transition-all cursor-pointer flex items-center justify-center font-mono"
          >
            <Delete className="w-4 h-4" />
          </button>
        </div>

        {/* Confirm Button */}
        <button
          type="button"
          onClick={() => handleVerify()}
          className="w-full py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wide bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-lg shadow-cyan-500/25 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer glow-cyan"
        >
          <ShieldCheck className="w-4 h-4 text-slate-950" />
          <span>Acceder al Panel de Caja</span>
        </button>
      </div>
    </div>
  );
};
