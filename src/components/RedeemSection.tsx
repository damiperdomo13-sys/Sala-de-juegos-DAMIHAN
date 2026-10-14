import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import {
  QrCode,
  ArrowRight,
  ShieldAlert,
  Clock,
  Sparkles,
  Copy,
  Check,
  CheckCircle2,
  ExternalLink,
  Minus,
  Plus,
  X,
  PartyPopper,
  Gamepad2,
} from 'lucide-react';
import { RedeemVoucher } from '../types';
import { generateVoucherCode } from '../utils/storage';
import { soundEffects } from '../utils/audio';

interface RedeemSectionProps {
  currentBalance: number;
  userName: string;
  userId: string;
  vouchers?: RedeemVoucher[];
  onCreateVoucher: (voucher: RedeemVoucher) => void;
  onJumpToAdminWithVoucher?: (voucher: RedeemVoucher) => void;
}

export const RedeemSection: React.FC<RedeemSectionProps> = ({
  currentBalance,
  userName,
  userId,
  vouchers = [],
  onCreateVoucher,
  onJumpToAdminWithVoucher,
}) => {
  const [minutesToRedeem, setMinutesToRedeem] = useState<number>(30);
  const [activeVoucher, setActiveVoucher] = useState<RedeemVoucher | null>(null);
  const [redeemedSuccess, setRedeemedSuccess] = useState<RedeemVoucher | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(15 * 60); // 15 mins in seconds

  // Preset quick picks
  const quickPicks = [15, 30, 45, 60];

  // Adjust if current balance is lower than chosen
  useEffect(() => {
    if (currentBalance < minutesToRedeem && currentBalance >= 5) {
      setMinutesToRedeem(currentBalance);
    }
  }, [currentBalance, minutesToRedeem]);

  // Generate QR when voucher is set
  useEffect(() => {
    if (!activeVoucher) return;

    const payload = JSON.stringify({
      app: 'SALA_DE_JUEGOS_DAMIAN',
      voucherCode: activeVoucher.code,
      userId: activeVoucher.userId,
      userName: activeVoucher.userName,
      minutes: activeVoucher.minutes,
      createdAt: activeVoucher.createdAt,
      expiresAt: activeVoucher.expiresAt,
    });

    QRCode.toDataURL(payload, {
      width: 280,
      margin: 2,
      color: {
        dark: '#030712',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => {
        setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('QR code generation error', err);
      });

    // Reset countdown
    setTimeRemaining(15 * 60);
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeVoucher]);

  // Real-time listener: Watch for admin confirmation in the synced vouchers array (Firebase)
  useEffect(() => {
    if (!activeVoucher) return;

    // Check if the current active voucher has been confirmed as 'redeemed' by the admin
    const matched = vouchers.find(
      (v) => (v.id === activeVoucher.id || v.code === activeVoucher.code)
    );

    if (matched && matched.status === 'redeemed' && !redeemedSuccess) {
      // Administrator confirmed the voucher in the admin panel!
      setRedeemedSuccess(matched);
      soundEffects.playWin();

      try {
        confetti({
          particleCount: 130,
          spread: 85,
          origin: { y: 0.5 },
          colors: ['#06b6d4', '#10b981', '#fbbf24', '#38bdf8', '#a855f7'],
        });
      } catch (err) {
        console.warn('Confetti effect failed', err);
      }
    }
  }, [vouchers, activeVoucher, redeemedSuccess]);

  const handleCreateVoucher = () => {
    if (minutesToRedeem < 5 || minutesToRedeem > currentBalance) {
      soundEffects.playError();
      return;
    }

    soundEffects.playBeep();
    const newVoucher: RedeemVoucher = {
      id: `vch_${Date.now()}`,
      code: generateVoucherCode(),
      userId,
      userName,
      minutes: minutesToRedeem,
      createdAt: Date.now(),
      expiresAt: Date.now() + 15 * 60 * 1000,
      status: 'pending',
    };

    setRedeemedSuccess(null);
    setActiveVoucher(newVoucher);
    onCreateVoucher(newVoucher);
  };

  const handleCopyCode = () => {
    if (!activeVoucher) return;
    soundEffects.playTick(1.2);
    navigator.clipboard?.writeText(activeVoucher.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const projectedRemaining = Math.max(0, currentBalance - minutesToRedeem);

  return (
    <div className="bg-[#0b101b] rounded-2xl p-5 border border-slate-800/80 shadow-xl relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-white text-base md:text-lg">
              Canje de Minutos en Establecimiento
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Genera un código QR digital para que el encargado de Sala de Juegos Damihan descuente tus minutos y active tu tiempo de juego.
          </p>
        </div>
      </div>

      {/* Selector Container */}
      <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-slate-300">
            ¿Cuántos minutos deseas canjear?
          </label>
          <span className="text-xs text-slate-400 font-mono">
            Disponible: <strong className="text-emerald-400">{currentBalance} min</strong>
          </span>
        </div>

        {/* Stepper + Input */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              soundEffects.playTick(0.9);
              setMinutesToRedeem((prev) => Math.max(5, prev - 5));
            }}
            disabled={minutesToRedeem <= 5}
            className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 hover:text-white hover:bg-slate-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Minus className="w-4 h-4" />
          </button>

          <div className="flex-1 relative">
            <input
              type="number"
              min={5}
              max={currentBalance}
              value={minutesToRedeem}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10) || 0;
                setMinutesToRedeem(Math.min(currentBalance, Math.max(0, val)));
              }}
              className="w-full h-11 bg-slate-950 border border-slate-700 rounded-xl px-4 text-center font-bold font-mono text-xl text-cyan-400 focus:outline-none focus:border-cyan-400"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-medium">
              MIN
            </span>
          </div>

          <button
            onClick={() => {
              soundEffects.playTick(1.1);
              setMinutesToRedeem((prev) => Math.min(currentBalance, prev + 5));
            }}
            disabled={minutesToRedeem >= currentBalance}
            className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 hover:text-white hover:bg-slate-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Quick pick chips */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {quickPicks.map((amount) => (
            <button
              key={amount}
              onClick={() => {
                soundEffects.playTick(1.0);
                setMinutesToRedeem(Math.min(currentBalance, amount));
              }}
              disabled={amount > currentBalance}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all ${
                minutesToRedeem === amount
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                  : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 border border-slate-700/60 disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              {amount} min
            </button>
          ))}

          <button
            onClick={() => {
              soundEffects.playTick(1.2);
              setMinutesToRedeem(currentBalance);
            }}
            disabled={currentBalance <= 0}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              minutesToRedeem === currentBalance && currentBalance > 0
                ? 'bg-emerald-400 text-slate-950 shadow-md shadow-emerald-400/20'
                : 'bg-slate-800 text-emerald-400 hover:bg-slate-700 border border-emerald-900/40 disabled:opacity-40'
            }`}
          >
            Canjear Todo ({currentBalance}m)
          </button>
        </div>

        {/* Breakdown bar */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
          <span>Saldo restante estimado:</span>
          <span className="font-bold text-slate-200">{projectedRemaining} Minutos</span>
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={handleCreateVoucher}
        disabled={currentBalance < 5 || minutesToRedeem < 5 || minutesToRedeem > currentBalance}
        className={`mt-4 w-full py-3.5 px-6 rounded-xl font-extrabold text-sm tracking-wide flex items-center justify-center gap-2.5 transition-all shadow-lg ${
          currentBalance >= 5 && minutesToRedeem >= 5 && minutesToRedeem <= currentBalance
            ? 'bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 text-slate-950 hover:brightness-110 active:scale-[0.98] glow-cyan cursor-pointer'
            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/60'
        }`}
      >
        <QrCode className="w-4 h-4 text-slate-950" />
        <span>GENERAR CÓDIGO QR DE CANJE</span>
        <ArrowRight className="w-4 h-4 text-slate-950" />
      </button>

      {/* QR Code Digital Voucher Modal or Transformed Real-Time Success Receipt */}
      {activeVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className={`border rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl relative transition-all duration-300 ${
              redeemedSuccess
                ? 'bg-[#0b101b] border-emerald-500/60 glow-emerald scale-100'
                : 'bg-[#0b101b] border-cyan-500/40 glow-cyan'
            }`}
          >
            {/* Close button */}
            <button
              onClick={() => {
                soundEffects.playTick(1.0);
                setActiveVoucher(null);
                setRedeemedSuccess(null);
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer z-10"
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>

            {redeemedSuccess ? (
              /* Transformed View: ¡Canje Exitoso en Caja! */
              <div className="py-2 animate-in zoom-in-95 duration-300">
                <div className="relative w-20 h-20 mx-auto mb-3 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping opacity-60" />
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-xl shadow-emerald-500/30">
                    <div className="w-full h-full bg-[#0b101b] rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-pulse" />
                    </div>
                  </div>
                </div>

                <span className="text-[11px] font-black font-mono tracking-widest text-emerald-400 uppercase bg-emerald-950/80 border border-emerald-500/50 px-3.5 py-1 rounded-full inline-block mb-1 shadow-sm">
                  ¡CANJE EXITOSO EN CAJA!
                </span>

                <h3 className="text-2xl font-black text-white mt-1">
                  -{redeemedSuccess.minutes} Minutos
                </h3>

                <p className="text-xs text-slate-300 mt-1.5 px-2">
                  El encargado en <strong className="text-white">Sala de Juegos Damihan</strong> ha validado tu cupón y activado tu tiempo de juego.
                </p>

                {/* Comprobante de canje en tiempo real */}
                <div className="my-4 bg-slate-900/95 rounded-2xl p-4 border border-slate-800 text-xs font-mono space-y-2 text-left shadow-inner">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Cupón Canjeado:</span>
                    <span className="text-cyan-400 font-bold">{redeemedSuccess.code}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Cliente:</span>
                    <span className="text-slate-200 font-bold">{redeemedSuccess.userName}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Estado en Caja:</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Confirmado
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-slate-300 font-semibold">Saldo Restante Actualizado:</span>
                    <span className="text-emerald-400 font-black text-base">
                      {currentBalance} Minutos
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-300 font-semibold mb-4 bg-emerald-950/40 border border-emerald-800/40 py-2 px-3 rounded-xl">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>¡Tu puesto de juego está listo para jugar!</span>
                </div>

                <button
                  onClick={() => {
                    soundEffects.playTick(1.2);
                    setActiveVoucher(null);
                    setRedeemedSuccess(null);
                  }}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/30 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer glow-emerald"
                >
                  <Gamepad2 className="w-4 h-4 text-slate-950" />
                  <span>¡Listo, a Jugar en Consolas!</span>
                </button>
              </div>
            ) : (
              /* Pending View: QR Code Digital Voucher */
              <div>
                {/* Voucher Header */}
                <div className="mb-3">
                  <span className="text-[10px] font-bold font-mono tracking-widest text-cyan-400 uppercase bg-cyan-950/60 border border-cyan-800/60 px-3 py-1 rounded-full">
                    VOUCHER DE CANJE VÁLIDO
                  </span>
                  <h3 className="text-xl font-black text-white mt-2">
                    -{activeVoucher.minutes} MINUTOS
                  </h3>
                  <p className="text-xs text-slate-400">
                    Cliente: <strong className="text-slate-200">{activeVoucher.userName}</strong>
                  </p>
                </div>

                {/* QR Visual Canvas */}
                <div className="bg-white p-3.5 rounded-2xl inline-block shadow-inner mx-auto my-1 border-4 border-slate-900">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Código QR de Canje"
                      className="w-56 h-56 mx-auto object-contain"
                    />
                  ) : (
                    <div className="w-56 h-56 flex items-center justify-center text-slate-800 font-mono text-xs">
                      Generando QR...
                    </div>
                  )}
                </div>

                {/* Manual Code */}
                <div className="my-3 p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between px-4">
                  <div className="text-left">
                    <span className="text-[10px] text-slate-400 uppercase block font-semibold">
                      Código Manual (si la cámara falla)
                    </span>
                    <span className="font-mono font-black text-base text-cyan-400 tracking-wider">
                      {activeVoucher.code}
                    </span>
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="Copiar código"
                  >
                    {copiedCode ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Real-time sync indicator waiting for admin */}
                <div className="mb-3 flex items-center justify-center gap-2 text-[11px] text-cyan-300 font-mono bg-cyan-950/40 border border-cyan-800/40 py-1.5 px-3 rounded-lg animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span>Esperando confirmación en caja...</span>
                </div>

                {/* Expiration Timer */}
                <div className="flex items-center justify-center gap-1.5 text-xs text-amber-300 font-mono bg-amber-950/40 border border-amber-800/40 py-1.5 px-3 rounded-lg">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Expira en: {formatCountdown(timeRemaining)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
