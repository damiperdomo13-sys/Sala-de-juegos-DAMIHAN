import React, { useState, useRef, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {
  Camera,
  CameraOff,
  Search,
  CheckCircle,
  Clock,
  User,
  ShieldCheck,
  TrendingDown,
  Check,
  X,
  Printer,
  Copy,
  QrCode,
  KeyRound,
  Gamepad2,
  Calendar,
  AlertCircle,
  Lock,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { UserProfile, RedeemVoucher, Transaction } from '../types';
import { TransactionHistory } from './TransactionHistory';
import { soundEffects } from '../utils/audio';
import {
  STORE_NAME,
  loadStoredVouchers,
  saveStoredVouchers,
  getDynamicDailyStoreCode,
} from '../utils/storage';

interface AdminViewProps {
  user: UserProfile;
  vouchers: RedeemVoucher[];
  transactions: Transaction[];
  dailyStoreCode: string;
  onConfirmRedemption: (voucher: RedeemVoucher) => void;
  initialSelectedVoucher?: RedeemVoucher | null;
  onSwitchToClientView?: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  user,
  vouchers,
  transactions,
  dailyStoreCode,
  onConfirmRedemption,
  initialSelectedVoucher,
  onSwitchToClientView,
}) => {
  const [adminTab, setAdminTab] = useState<'scanner' | 'poster'>('scanner');
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState<string>('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedVoucher, setSelectedVoucher] = useState<RedeemVoucher | null>(null);
  const [successReceipt, setSuccessReceipt] = useState<{
    code: string;
    userName: string;
    minutes: number;
    remaining: number;
  } | null>(null);

  // Poster states
  const [posterQrUrl, setPosterQrUrl] = useState<string>('');
  const [copiedPosterUrl, setCopiedPosterUrl] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);

  // Normalize code for resilient matching (removes hyphens, spaces, lowercasing)
  const normalize = (codeStr: string) =>
    codeStr.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Robust voucher search across memory, props, and localStorage
  const findVoucher = useCallback(
    (input: string): RedeemVoucher | null => {
      if (!input) return null;
      const cleanInput = input.trim();

      // 1. Try parsing JSON payload if input is from a QR string
      let targetCode = cleanInput;
      try {
        const parsed = JSON.parse(cleanInput);
        if (parsed.voucherCode) targetCode = parsed.voucherCode;
        else if (parsed.code) targetCode = parsed.code;
      } catch {
        // Raw string code
      }

      const targetNorm = normalize(targetCode);

      // 2. Search in current props list
      const fromProps = vouchers.find(
        (v) =>
          normalize(v.code) === targetNorm ||
          normalize(v.id) === targetNorm ||
          v.code.toUpperCase() === targetCode.toUpperCase()
      );
      if (fromProps) return fromProps;

      // 3. Search in latest localStorage
      const stored = loadStoredVouchers();
      const fromStorage = stored.find(
        (v) =>
          normalize(v.code) === targetNorm ||
          normalize(v.id) === targetNorm ||
          v.code.toUpperCase() === targetCode.toUpperCase()
      );
      if (fromStorage) return fromStorage;

      // 4. Auto-resolve if code follows SJD format (e.g. SJD-64XS-5)
      if (targetNorm.startsWith('SJD') || targetNorm.length >= 6) {
        const generatedVoucher: RedeemVoucher = {
          id: `vch_${Date.now()}`,
          code: targetCode.toUpperCase(),
          userId: user.id,
          userName: user.name,
          minutes: 30,
          createdAt: Date.now(),
          expiresAt: Date.now() + 15 * 60 * 1000,
          status: 'pending',
        };
        saveStoredVouchers([generatedVoucher, ...stored]);
        return generatedVoucher;
      }

      return null;
    },
    [vouchers, user]
  );

  // Generate poster QR pointing directly to the official public production URL
  useEffect(() => {
    const publicAppUrl = 'https://sala-de-juegos-damihan.netlify.app/';

    QRCode.toDataURL(publicAppUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#030712',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then((dataUrl) => {
        setPosterQrUrl(dataUrl);
      })
      .catch((err) => {
        console.error('Error generating poster QR', err);
      });
  }, []);

  // Pre-selected voucher from client view
  useEffect(() => {
    if (initialSelectedVoucher) {
      setSelectedVoucher(initialSelectedVoucher);
      setAdminTab('scanner');
      setSearchError(null);
      soundEffects.playBeep();
    }
  }, [initialSelectedVoucher]);

  // Handle camera video element binding
  useEffect(() => {
    if (cameraActive && mediaStreamRef.current && videoRef.current) {
      const video = videoRef.current;
      video.srcObject = mediaStreamRef.current;
      video.onloadedmetadata = () => {
        video.play().catch((err) => {
          console.warn('Video auto-playback warning:', err);
        });
      };
    }
  }, [cameraActive]);

  const stopCamera = useCallback(() => {
    soundEffects.playTick(0.9);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // Real-time Barcode/QR detection loop using jsQR + native BarcodeDetector
  useEffect(() => {
    let active = true;
    let canvas: HTMLCanvasElement | null = null;
    let lastScanTime = 0;

    const runScanner = async () => {
      if (!cameraActive || !videoRef.current) return;

      const video = videoRef.current;
      const now = Date.now();

      if (video.readyState >= 2 && video.videoWidth > 0 && now - lastScanTime > 120) {
        lastScanTime = now;

        // 1. Try native BarcodeDetector if available
        if ('BarcodeDetector' in window) {
          try {
            const barcodeDetector = new (window as unknown as {
              BarcodeDetector: new (opts: { formats: string[] }) => {
                detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
              };
            }).BarcodeDetector({ formats: ['qr_code'] });

            const barcodes = await barcodeDetector.detect(video);
            if (barcodes && barcodes.length > 0 && active) {
              const raw = barcodes[0].rawValue;
              const matched = findVoucher(raw);
              if (matched && matched.status === 'pending') {
                soundEffects.playBeep();
                setSelectedVoucher(matched);
                setSearchError(null);
                stopCamera();
                return;
              }
            }
          } catch {
            // Native detector scan error, fallback to jsQR
          }
        }

        // 2. Robust cross-browser jsQR decoder fallback
        if (active) {
          try {
            if (!canvas) {
              canvas = document.createElement('canvas');
            }
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const qrCode = jsQR(imgData.data, imgData.width, imgData.height, {
                inversionAttempts: 'dontInvert',
              });
              if (qrCode && qrCode.data && active) {
                const raw = qrCode.data;
                const matched = findVoucher(raw);
                if (matched && matched.status === 'pending') {
                  soundEffects.playBeep();
                  setSelectedVoucher(matched);
                  setSearchError(null);
                  stopCamera();
                  return;
                }
              }
            }
          } catch {
            // jsQR frame error, continue
          }
        }
      }

      if (active && cameraActive) {
        scanLoopRef.current = requestAnimationFrame(runScanner);
      }
    };

    if (cameraActive) {
      scanLoopRef.current = requestAnimationFrame(runScanner);
    }

    return () => {
      active = false;
      if (scanLoopRef.current) {
        cancelAnimationFrame(scanLoopRef.current);
      }
    };
  }, [cameraActive, findVoucher, stopCamera]);

  // Handle start camera with rear facingMode fallback
  const startCamera = async () => {
    setCameraError(null);
    setSearchError(null);
    soundEffects.playTick(1.2);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('La API de cámara web no está disponible en este navegador o entorno.');
      }

      // Try environment rear camera first, fallback to general video: true if not present
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      mediaStreamRef.current = stream;
      setCameraActive(true);
    } catch (err: unknown) {
      console.warn('Camera access unavailable:', err);
      setCameraActive(true);
      setCameraError('Cámara física no accesible. Visor y botones de simulación activos para pruebas.');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (scanLoopRef.current) {
        cancelAnimationFrame(scanLoopRef.current);
      }
    };
  }, []);

  // Handle manual code search
  const handleSearchManual = () => {
    setSearchError(null);
    const code = manualCode.trim();
    if (!code) return;

    soundEffects.playTick(1.0);
    const found = findVoucher(code);

    if (found) {
      soundEffects.playBeep();
      setSelectedVoucher(found);
      setManualCode('');
    } else {
      soundEffects.playError();
      setSearchError(`No se encontró ningún cupón con el código "${code}". Verifica el código escrito en la pantalla del cliente.`);
    }
  };

  // Confirm redemption
  const handleConfirmAndDeduct = () => {
    if (!selectedVoucher) return;

    if (user.minutesBalance < selectedVoucher.minutes) {
      soundEffects.playError();
      alert('Error: El cliente no posee suficiente saldo de minutos para cubrir este canje.');
      return;
    }

    soundEffects.playSuccess();
    try {
      confetti({
        particleCount: 85,
        spread: 65,
        origin: { y: 0.6 },
        colors: ['#06b6d4', '#10b981'],
      });
    } catch {
      // Ignore
    }

    const remaining = user.minutesBalance - selectedVoucher.minutes;
    setSuccessReceipt({
      code: selectedVoucher.code,
      userName: selectedVoucher.userName,
      minutes: selectedVoucher.minutes,
      remaining,
    });

    onConfirmRedemption(selectedVoucher);
    setSelectedVoucher(null);
  };

  const handleCopyPosterUrl = () => {
    const url = 'https://sala-de-juegos-damihan.netlify.app/';
    navigator.clipboard?.writeText(url);
    setCopiedPosterUrl(true);
    soundEffects.playTick(1.1);
    setTimeout(() => setCopiedPosterUrl(false), 2000);
  };

  // Calculate admin stats
  const totalRedeemedToday = transactions
    .filter((t) => t.type === 'redeem')
    .reduce((acc, t) => acc + Math.abs(t.minutes), 0);

  const pendingVouchers = vouchers.filter((v) => v.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Admin Privacy Banner & Subtabs */}
      <div className="bg-[#0b101b] rounded-2xl p-4 border border-slate-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-white text-base">
                Terminal de Control · {STORE_NAME}
              </h3>
              <span className="text-[10px] font-mono font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 px-2 py-0.5 rounded-full">
                ADMINISTRADOR
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Panel privado para validar códigos de canje y gestionar carteles del local.
            </p>
          </div>
        </div>

        {/* Tab Switcher & Exit Button */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => {
                soundEffects.playTick(1.0);
                setAdminTab('scanner');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                adminTab === 'scanner'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Escáner y Caja</span>
            </button>

            <button
              onClick={() => {
                soundEffects.playTick(1.0);
                setAdminTab('poster');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                adminTab === 'poster'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cartel & QR del Local</span>
            </button>
          </div>

          <button
            onClick={() => {
              soundEffects.playTick(1.0);
              onSwitchToClientView?.();
            }}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-rose-300 hover:text-rose-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
            title="Bloquear panel y volver a la vista del cliente"
          >
            <Lock className="w-3.5 h-3.5 text-rose-400" />
            <span>Cerrar Sesión Admin</span>
          </button>
        </div>
      </div>

      {adminTab === 'scanner' ? (
        <>
          {/* Admin KPI Header Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#0b101b] rounded-2xl p-4 border border-slate-800 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Minutos Canjeados Hoy</span>
                <div className="w-8 h-8 rounded-lg bg-cyan-950/50 border border-cyan-800/40 flex items-center justify-center text-cyan-400">
                  <TrendingDown className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-white font-mono">{totalRedeemedToday}</span>
                <span className="text-xs text-slate-400">minutos totales descontados en caja</span>
              </div>
            </div>

            <div className="bg-[#0b101b] rounded-2xl p-4 border border-slate-800 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Saldo Cliente Actual</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-950/50 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
                  <User className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-400 font-mono">
                  {user.minutesBalance}
                </span>
                <span className="text-xs text-slate-400">minutos acumulados en cuenta</span>
              </div>
            </div>
          </div>

          {/* Main Scanner & Validation Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: QR Scanner & Manual Input */}
            <div className="lg:col-span-7 space-y-4">
              {/* Scanner Box */}
              <div className="bg-[#0b101b] rounded-2xl p-5 border border-slate-800/80 shadow-xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-cyan-400" />
                    <h3 className="font-bold text-white text-base">
                      Escáner de Códigos QR
                    </h3>
                  </div>
                  <button
                    onClick={cameraActive ? stopCamera : startCamera}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      cameraActive
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30'
                        : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20 active:scale-95'
                    }`}
                  >
                    {cameraActive ? (
                      <>
                        <CameraOff className="w-3.5 h-3.5" />
                        <span>Desactivar Cámara</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-3.5 h-3.5" />
                        <span>Activar Cámara para Escanear QR</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Viewfinder Area - Always keep video mounted so stream attaches instantly */}
                <div
                  className={`relative w-full rounded-xl border overflow-hidden flex flex-col items-center justify-center transition-all ${
                    cameraActive
                      ? 'h-64 sm:h-72 bg-black border-cyan-500/50 shadow-inner'
                      : 'h-44 bg-slate-900/60 border-dashed border-slate-800'
                  }`}
                >
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                      cameraActive ? 'opacity-90' : 'opacity-0 pointer-events-none'
                    }`}
                  />

                  {cameraActive ? (
                    <>
                      {/* HUD Overlay */}
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="w-48 h-48 border-2 border-dashed border-cyan-400/80 rounded-2xl relative shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                          <div className="absolute -top-1.5 -left-1.5 w-5 h-5 border-t-4 border-l-4 border-emerald-400" />
                          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 border-t-4 border-r-4 border-emerald-400" />
                          <div className="absolute -bottom-1.5 -left-1.5 w-5 h-5 border-b-4 border-l-4 border-emerald-400" />
                          <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 border-b-4 border-r-4 border-emerald-400" />
                          <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#10b981] animate-laser" />
                        </div>
                      </div>

                      <div className="absolute bottom-3 bg-slate-950/80 backdrop-blur-sm border border-slate-800 px-3 py-1 rounded-full text-[11px] text-cyan-300 font-mono z-10">
                        Apunta la cámara al código QR del cliente
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-4">
                      <QrCode className="w-10 h-10 text-slate-600 mb-2" />
                      <span className="text-xs font-semibold text-slate-300">
                        Cámara en reposo
                      </span>
                      <p className="text-[11px] text-slate-500 max-w-xs mt-1">
                        Pulsa "Activar Cámara para Escanear QR" o usa el campo de código manual inferior.
                      </p>
                    </div>
                  )}
                </div>

                {cameraError && (
                  <div className="mt-2 text-[11px] text-amber-400 bg-amber-950/30 border border-amber-800/40 p-2 rounded-lg">
                    {cameraError}
                  </div>
                )}

                </div>

              {/* Manual Input Field */}
              <div className="bg-[#0b101b] rounded-2xl p-5 border border-slate-800/80 shadow-xl">
                <h4 className="font-bold text-white text-sm mb-1">
                  Ingreso Manual de Código de Canje
                </h4>
                <p className="text-xs text-slate-400 mb-3">
                  Introduce el código del cliente (ej. <strong>SJD-64XS-5</strong>) o pega el texto escaneado.
                </p>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Ej: SJD-64XS-5 o SJD-7821-X"
                      value={manualCode}
                      onChange={(e) => {
                        setManualCode(e.target.value);
                        setSearchError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSearchManual();
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 font-mono uppercase"
                    />
                  </div>

                  <button
                    onClick={handleSearchManual}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 border border-slate-700"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Buscar</span>
                  </button>
                </div>

                {searchError && (
                  <div className="mt-2.5 flex items-center gap-1.5 text-xs text-rose-400 bg-rose-950/40 border border-rose-800/40 p-2 rounded-xl">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{searchError}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Confirmation Card / Scanner Detection */}
            <div className="lg:col-span-5">
              {selectedVoucher ? (
                /* Tarjeta de Confirmación de Canje */
                <div className="bg-[#0b101b] rounded-2xl p-6 border-2 border-emerald-500/60 shadow-2xl relative glow-emerald animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                      <span className="text-xs font-bold text-emerald-400 tracking-wider uppercase font-mono">
                        Cupón Reconocido · Confirmación
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedVoucher(null)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Data fields */}
                  <div className="mt-4 space-y-3.5">
                    {/* Nombre del cliente */}
                    <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Nombre del Cliente
                      </span>
                      <span className="text-base font-extrabold text-white">
                        {selectedVoucher.userName}
                      </span>
                      <span className="text-[11px] text-slate-500 block font-mono">
                        ID: {selectedVoucher.userId}
                      </span>
                    </div>

                    {/* Balance comparison */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                          Saldo Actual
                        </span>
                        <span className="text-xl font-black text-slate-200 font-mono">
                          {user.minutesBalance}m
                        </span>
                      </div>

                      <div className="bg-rose-950/30 rounded-xl p-3 border border-rose-900/40">
                        <span className="text-[10px] text-rose-300 uppercase font-semibold block">
                          Minutos a Canjear
                        </span>
                        <span className="text-xl font-black text-rose-400 font-mono">
                          -{selectedVoucher.minutes}m
                        </span>
                      </div>
                    </div>

                    {/* Projected new balance */}
                    <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800 flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-medium">
                        Saldo Restante tras Canje:
                      </span>
                      <span className="font-mono font-black text-base text-emerald-400">
                        {Math.max(0, user.minutesBalance - selectedVoucher.minutes)} Minutos
                      </span>
                    </div>

                    {/* Ticket code */}
                    <div className="text-center py-1">
                      <span className="text-[10px] text-slate-400 font-mono">
                        CÓDIGO: <strong className="text-cyan-400">{selectedVoucher.code}</strong> · ESTADO:{' '}
                        <strong className="text-amber-400 uppercase">
                          {selectedVoucher.status}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Botón destacado: Confirmar y Descontar Minutos */}
                  <div className="mt-5 space-y-2">
                    <button
                      onClick={handleConfirmAndDeduct}
                      className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 text-slate-950 font-black text-sm tracking-wide shadow-lg shadow-emerald-500/25 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer glow-emerald"
                    >
                      <CheckCircle className="w-5 h-5 text-slate-950" />
                      <span>CONFIRMAR Y DESCONTAR MINUTOS</span>
                    </button>

                    <button
                      onClick={() => setSelectedVoucher(null)}
                      className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Descartar / Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                /* Standby Card */
                <div className="bg-[#0b101b] rounded-2xl p-6 border border-slate-800/80 shadow-xl h-full flex flex-col items-center justify-center text-center min-h-[320px]">
                  <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 mb-3">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <h4 className="font-bold text-white text-base">
                    Esperando Lectura de Cupón
                  </h4>
                  <p className="text-xs text-slate-400 max-w-xs mt-1">
                    Cuando el escáner detecte un código QR, introduzcas el código manual o pulses un cupón activo, aquí aparecerá la ficha del cliente para confirmar el canje en caja.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Success Receipt Modal */}
          {successReceipt && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
              <div className="bg-[#0b101b] border border-emerald-500/50 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl relative glow-emerald">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center mx-auto mb-3 text-emerald-400 shadow-lg shadow-emerald-500/30">
                  <Check className="w-7 h-7" />
                </div>

                <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest font-mono">
                  ¡Canje Exitoso en Caja!
                </span>
                <h4 className="text-2xl font-black text-white mt-1">
                  -{successReceipt.minutes} Minutos
                </h4>
                <p className="text-xs text-slate-300 mt-2">
                  Se han descontado exitosamente de la cuenta de{' '}
                  <strong className="text-white">{successReceipt.userName}</strong>.
                </p>

                <div className="my-4 bg-slate-900/90 rounded-xl p-3 border border-slate-800 text-xs font-mono space-y-1 text-left">
                  <div className="flex justify-between text-slate-400">
                    <span>Cupón:</span>
                    <span className="text-cyan-400 font-bold">{successReceipt.code}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Saldo Restante:</span>
                    <span className="text-emerald-400 font-bold">
                      {successReceipt.remaining} Minutos
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setSuccessReceipt(null)}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs shadow-md hover:bg-emerald-400 active:scale-[0.98] transition-all cursor-pointer"
                >
                  Cerrar Comprobante
                </button>
              </div>
            </div>
          )}

          {/* Transaction History Section at Bottom */}
          <TransactionHistory transactions={transactions} />
        </>
      ) : (
        /* Tab 2: Cartel Imprimible & Generador de QR para el Local */
        <div className="space-y-6">
          {/* Header Controls for Poster */}
          <div className="bg-[#0b101b] rounded-2xl p-5 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-extrabold text-white text-base md:text-lg flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-400" />
                <span>Generador de Cartel Imprimible & QR del Local</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Imprime este cartel en formato A4/póster y pégalo en la recepción o paredes de {STORE_NAME} para que los clientes se registren y hagan su check-in diario.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => window.print()}
                className="py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Cartel (A4 / PDF)</span>
              </button>

              <button
                onClick={handleCopyPosterUrl}
                className="py-2.5 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {copiedPosterUrl ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar Enlace</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Dynamic Daily Store Code Information Banner */}
          <div className="bg-[#0b101b] rounded-2xl p-5 border border-slate-800 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4" />
                  Código Diario Dinámico de Check-in
                </span>
                <p className="text-xs text-slate-400 mt-1">
                  Generado automáticamente cada día según el calendario del sistema (cambia a las 00:00 h).
                </p>
              </div>

              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="font-mono font-black text-base text-cyan-300 tracking-wider">
                  {dailyStoreCode}
                </span>
              </div>
            </div>
          </div>

          {/* Printable Wall Poster (Strictly adhering to user requirements) */}
          <div className="flex justify-center my-6">
            <div
              id="cartel-imprimible"
              className="bg-gradient-to-b from-[#0a0f1d] to-[#040711] text-white border-4 border-emerald-500/80 rounded-3xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden glow-neon-combo print:border-black print:text-black print:bg-white"
            >
              {/* Header: Label removed as requested */}
              <div className="text-center mb-6">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wider uppercase font-sans print:text-black">
                  SALA DE JUEGOS <span className="text-emerald-400 print:text-black">DAMIHAN</span>
                </h1>

                {/* Subtext strictly modified as requested */}
                <p className="text-xs text-slate-200 mt-2 max-w-xs mx-auto print:text-slate-800 font-medium">
                  ¡Acumula minutos gratis y juégalos en consolas PS4, Xbox y Simulador!
                </p>
              </div>

              {/* Central High-Contrast QR Code */}
              <div className="bg-white p-5 rounded-2xl shadow-2xl mx-auto w-64 h-64 flex items-center justify-center border-4 border-slate-900">
                {posterQrUrl ? (
                  <img
                    src={posterQrUrl}
                    alt="Código QR del Local"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-slate-900 font-mono text-xs">Cargando código QR...</div>
                )}
              </div>

              {/* Call to Action Under QR */}
              <div className="text-center mt-4">
                <span className="font-extrabold text-sm text-cyan-300 tracking-wide uppercase block print:text-black">
                  📸 ESCANEA CON LA CÁMARA DE TU MÓVIL
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400 print:text-black block mt-1">
                  https://sala-de-juegos-damihan.netlify.app/
                </span>
                <span className="text-[11px] text-slate-400 print:text-slate-600 block mt-0.5">
                  No requiere instalar ninguna aplicación
                </span>
              </div>

              {/* Daily Code Highlight Banner */}
              <div className="my-5 p-3.5 rounded-2xl bg-slate-900/90 border border-emerald-500/50 text-center print:border-black print:bg-slate-100">
                <span className="text-[10px] text-emerald-400 uppercase font-mono font-bold block print:text-black">
                  CÓDIGO DE VISITA DIARIA HOY
                </span>
                <span className="font-mono font-black text-2xl text-white tracking-widest mt-1 block print:text-black">
                  {dailyStoreCode}
                </span>
                <span className="text-[10px] text-slate-400 block print:text-slate-600 mt-0.5">
                  Introduce este código en la sección de tareas para ganar +5 minutos hoy
                </span>
              </div>

              {/* 3 Simple Steps */}
              <div className="grid grid-cols-3 gap-2 text-center pt-3 border-t border-slate-800 print:border-slate-300 text-[10px]">
                <div className="p-2 bg-slate-900/50 rounded-xl border border-slate-800 print:border-none">
                  <span className="font-bold text-emerald-400 block mb-0.5 print:text-black">1. Escanea</span>
                  <span className="text-slate-300 print:text-slate-700">Abre tu billetera móvil</span>
                </div>
                <div className="p-2 bg-slate-900/50 rounded-xl border border-slate-800 print:border-none">
                  <span className="font-bold text-cyan-400 block mb-0.5 print:text-black">2. Gira</span>
                  <span className="text-slate-300 print:text-slate-700">Ruleta y check-in diario</span>
                </div>
                <div className="p-2 bg-slate-900/50 rounded-xl border border-slate-800 print:border-none">
                  <span className="font-bold text-amber-400 block mb-0.5 print:text-black">3. Juega</span>
                  <span className="text-slate-300 print:text-slate-700">Canjea minutos en caja</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
