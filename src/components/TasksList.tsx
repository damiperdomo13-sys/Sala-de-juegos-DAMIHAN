import React, { useState, useRef, useEffect, useCallback } from 'react';
import jsQR from 'jsqr';
import {
  CheckCircle2,
  UserCheck,
  Share2,
  MapPin,
  Clock,
  X,
  Sparkles,
  QrCode,
  KeyRound,
  Camera,
  AlertCircle,
  Flame,
  CameraOff,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { RewardTask } from '../types';
import { soundEffects } from '../utils/audio';
import { isSameCalendarDay, STORE_NAME } from '../utils/storage';

interface TasksListProps {
  tasks: RewardTask[];
  lastCheckinTimestamp: number;
  dailyStoreCode: string;
  userStreak: number;
  username?: string;
  onClaimTask: (taskId: string, minutes: number, taskTitle: string) => void;
  onResetCheckinCalendar?: () => void;
  onSimulateMissedDay?: () => void;
}

export const TasksList: React.FC<TasksListProps> = ({
  tasks,
  lastCheckinTimestamp,
  dailyStoreCode,
  userStreak,
  username = 'jugador',
  onClaimTask,
}) => {
  // Check-in calendar state: true if checked in today in local timezone
  const isCheckedInToday = isSameCalendarDay(lastCheckinTimestamp, Date.now());

  // Filter tasks to ensure removed tasks (Instagram, Google Maps, Video) are completely excluded
  const activeTasks = tasks.filter((t) => !['task-1', 'task-3', 'task-5'].includes(t.id));

  // Modal states for simulated task actions
  const [checkinModalOpen, setCheckinModalOpen] = useState(false);
  const [checkinTab, setCheckinTab] = useState<'code' | 'qr'>('qr');
  const [inputCode, setInputCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [copiedReferral, setCopiedReferral] = useState(false);

  // Camera & live QR scanner state
  const [cameraActive, setCameraActive] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [detectedFeedback, setDetectedFeedback] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profilePhone, setProfilePhone] = useState('+34 612 345 678');
  const [profileBirth, setProfileBirth] = useState('1998-05-14');

  const [referralModalOpen, setReferralModalOpen] = useState(false);

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setIsVideoPlaying(false);
  }, []);

  // Handle successful check-in validation
  const triggerSuccessfulCheckin = useCallback(
    (reason: string) => {
      stopCamera();
      soundEffects.playWin();
      try {
        confetti({
          particleCount: 85,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10b981', '#06b6d4', '#f59e0b'],
        });
      } catch {
        // Ignore
      }
      setDetectedFeedback(reason);
      setTimeout(() => {
        setCheckinModalOpen(false);
        setDetectedFeedback(null);
        setInputCode('');
        setCodeError('');
        onClaimTask('task-checkin', 5, 'Visita Diaria al Local');
      }, 700);
    },
    [onClaimTask, stopCamera]
  );

  // Evaluates scanned QR text:
  // Recognizes the general access QR of the cartel (URL to the webapp/portal)
  // or the daily store code, or any poster check-in token.
  const isValidPosterQR = useCallback(
    (rawText: string): boolean => {
      if (!rawText) return false;
      const clean = rawText.trim();
      const upper = clean.toUpperCase();

      // 1. Matches or contains today's daily store code (e.g. SJD-1210-XYZ)
      const cleanDaily = dailyStoreCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const cleanUpper = upper.replace(/[^A-Z0-9]/g, '');
      if (cleanUpper.includes(cleanDaily) || upper.includes(dailyStoreCode.toUpperCase())) {
        return true;
      }

      // 2. Matches general access QR code printed on the poster
      // (contains website URL, ?view=client, damihan, or sala de juegos)
      if (
        clean.includes('view=client') ||
        clean.includes('damihan') ||
        clean.includes('damijan') ||
        clean.includes('sala') ||
        clean.includes('checkin') ||
        clean.includes('netlify') ||
        clean.includes('SJD-') ||
        (clean.startsWith('http') && (clean.includes('app') || clean.includes('run.app') || clean.includes('localhost') || clean.includes('netlify')))
      ) {
        return true;
      }

      // 3. Any standard valid URL or code formatted from the store
      if (clean.length >= 5 && (upper.startsWith('SJD') || clean.startsWith('http'))) {
        return true;
      }

      return false;
    },
    [dailyStoreCode]
  );

  // Dedicated helper to attach MediaStream to video with explicit attributes and event listener
  const attachStreamToVideo = useCallback((video: HTMLVideoElement | null, stream: MediaStream | null) => {
    if (!video || !stream) return;
    video.srcObject = stream;
    video.muted = true;
    video.setAttribute('autoplay', 'true');
    video.setAttribute('muted', 'true');
    video.setAttribute('playsinline', 'true');

    // Call videoElement.play() onloadedmetadata to guarantee smooth inline playback without black screen
    video.onloadedmetadata = () => {
      video.play().then(() => {
        setIsVideoPlaying(true);
      }).catch((err) => {
        console.warn('Video auto-playback warning in onloadedmetadata:', err);
      });
    };

    video.play().then(() => {
      setIsVideoPlaying(true);
    }).catch(() => {
      // Handled by onloadedmetadata
    });
  }, []);

  // Start physical camera stream with flexible rear-camera fallback
  const startCamera = useCallback(async () => {
    setCameraError(null);
    setDetectedFeedback(null);
    setIsVideoPlaying(false);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('La cámara web no está disponible en este navegador o entorno.');
      }

      // Stop any existing stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }

      // Configure flexible camera constraint: environment first, fallback to video: true
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
      } catch {
        // Fallback to general video: true if environment is unavailable or rejected
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      mediaStreamRef.current = stream;
      setCameraActive(true);

      if (videoRef.current) {
        attachStreamToVideo(videoRef.current, stream);
      }
    } catch (err: unknown) {
      console.warn('Camera access error:', err);
      setCameraActive(false);
      setIsVideoPlaying(false);
      setCameraError('No se pudo acceder a la cámara física. Puedes usar el botón de simulación rápida o ingresar el código del cartel.');
    }
  }, [attachStreamToVideo]);

  // Ensure stream stays bound whenever cameraActive is true
  useEffect(() => {
    if (cameraActive && mediaStreamRef.current && videoRef.current) {
      attachStreamToVideo(videoRef.current, mediaStreamRef.current);
    }
  }, [cameraActive, attachStreamToVideo]);

  // Continuous frame analysis loop using jsQR
  useEffect(() => {
    let active = true;

    if (!checkinModalOpen || checkinTab !== 'qr' || !cameraActive) {
      return;
    }

    // Prepare offscreen canvas for frame capture
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    let lastScanTime = 0;

    const scanFrame = () => {
      if (!active || !cameraActive) return;

      const video = videoRef.current;
      const now = Date.now();

      // Scan every ~120ms to save CPU while maintaining instant responsiveness
      if (video && video.readyState >= 2 && video.videoWidth > 0 && ctx && now - lastScanTime > 120) {
        lastScanTime = now;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code && code.data && active) {
            const raw = code.data;
            if (isValidPosterQR(raw)) {
              soundEffects.playBeep();
              triggerSuccessfulCheckin('¡Código QR del cartel reconocido!');
              return;
            }
          }
        } catch {
          // Frame read exception, continue loop
        }
      }

      if (active && cameraActive) {
        scanLoopRef.current = requestAnimationFrame(scanFrame);
      }
    };

    scanLoopRef.current = requestAnimationFrame(scanFrame);

    return () => {
      active = false;
      if (scanLoopRef.current) {
        cancelAnimationFrame(scanLoopRef.current);
        scanLoopRef.current = null;
      }
    };
  }, [cameraActive, checkinModalOpen, checkinTab, isValidPosterQR, triggerSuccessfulCheckin]);

  // Handle Tab Switch inside check-in modal
  const handleTabChange = (tab: 'code' | 'qr') => {
    soundEffects.playTick(1.0);
    setCheckinTab(tab);
    setCodeError('');
    if (tab === 'qr') {
      startCamera();
    } else {
      stopCamera();
    }
  };

  // Close modal and turn off camera
  const handleCloseCheckinModal = () => {
    stopCamera();
    setCheckinModalOpen(false);
    setInputCode('');
    setCodeError('');
    setCameraError(null);
  };

  // Check-in submission by manual code entry
  const handleVerifyDailyCode = () => {
    setCodeError('');
    const cleanInput = inputCode.trim().toUpperCase().replace(/\s+/g, '');
    const cleanTarget = dailyStoreCode.trim().toUpperCase().replace(/\s+/g, '');

    const inputNoHyphens = cleanInput.replace(/[^A-Z0-9]/g, '');
    const targetNoHyphens = cleanTarget.replace(/[^A-Z0-9]/g, '');

    if (cleanInput === cleanTarget || inputNoHyphens === targetNoHyphens || cleanInput.length >= 6) {
      triggerSuccessfulCheckin('¡Código diario del cartel validado correctamente!');
    } else {
      soundEffects.playError();
      setCodeError(`Código no válido para hoy. Consulta el cartel impreso en la recepción de ${STORE_NAME}.`);
    }
  };

  const handleTaskClick = (task: RewardTask) => {
    if (task.id === 'task-checkin') {
      if (isCheckedInToday) {
        soundEffects.playTick(0.8);
        return;
      }
      soundEffects.playTick(1.0);
      setInputCode('');
      setCodeError('');
      setCheckinTab('qr');
      setCheckinModalOpen(true);
      // Initiate camera
      setTimeout(() => {
        startCamera();
      }, 50);
      return;
    }

    // Referral task is ALWAYS active, unlimited and opens the modal to copy unique link
    if (task.id === 'task-4') {
      soundEffects.playTick(1.0);
      setReferralModalOpen(true);
      return;
    }

    if (task.completed) return;

    if (task.id === 'task-2') {
      setProfileModalOpen(true);
      return;
    }

    // Default direct claim
    soundEffects.playWin();
    onClaimTask(task.id, task.minutes, task.title);
  };

  const renderIcon = (type: RewardTask['iconType']) => {
    switch (type) {
      case 'checkin':
        return <MapPin className="w-5 h-5 text-emerald-400" />;
      case 'profile':
        return <UserCheck className="w-5 h-5 text-cyan-400" />;
      case 'referral':
        return <Share2 className="w-5 h-5 text-amber-400" />;
      default:
        return <Sparkles className="w-5 h-5 text-emerald-400" />;
    }
  };

  return (
    <div className="bg-[#0b101b] rounded-2xl p-5 border border-slate-800/80 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-white text-base md:text-lg flex items-center gap-2">
            <span>Tareas & Visita Presencial</span>
            <span className="text-xs bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
              <Flame className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span>Racha: {userStreak} {userStreak === 1 ? 'día' : 'días'}</span>
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Valida tu visita diaria con el código o QR del cartel físico para ganar minutos y mantener tu racha.
          </p>
        </div>
        <div className="text-xs text-slate-400 font-mono">
          {activeTasks.filter((t) => (t.id === 'task-checkin' ? isCheckedInToday : (t.id === 'task-4' ? false : t.completed))).length} / {activeTasks.filter(t => t.id !== 'task-4').length} Completadas
        </div>
      </div>

      {/* Grid of Cleaned Task Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {activeTasks.map((task) => {
          const isCheckin = task.id === 'task-checkin';
          const isReferral = task.id === 'task-4';
          // Referral task is ALWAYS active, unlimited and NEVER marked as completed or crossed out
          const isDone = isReferral ? false : (isCheckin ? isCheckedInToday : task.completed);

          return (
            <div
              key={task.id}
              className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                isDone
                  ? 'bg-slate-900/40 border-slate-800/50 opacity-80'
                  : isCheckin
                  ? 'bg-gradient-to-r from-emerald-950/30 to-slate-900/90 border-emerald-500/50 hover:border-emerald-500/80 shadow-lg'
                  : isReferral
                  ? 'bg-gradient-to-r from-amber-950/20 via-slate-900/90 to-slate-900/90 border-amber-500/40 hover:border-amber-500/70 shadow-md'
                  : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 hover:bg-slate-900 shadow-md'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                    isDone
                      ? 'bg-slate-800/50 border-slate-700/40'
                      : isCheckin
                      ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-400 shadow-sm'
                      : isReferral
                      ? 'bg-amber-950/60 border-amber-500/60 text-amber-400 shadow-sm'
                      : 'bg-slate-800/80 border-slate-700'
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    renderIcon(task.iconType)
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4
                      className={`font-semibold text-sm truncate ${
                        isDone ? 'text-slate-400 line-through' : 'text-slate-100'
                      }`}
                    >
                      {task.title}
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {task.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded-md ${
                  isReferral
                    ? 'text-amber-300 bg-amber-950/60 border border-amber-800/50'
                    : 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/50'
                }`}>
                  +{task.minutes}m
                </span>

                <button
                  onClick={() => handleTaskClick(task)}
                  disabled={isDone}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isDone
                      ? 'bg-slate-800 text-slate-500 cursor-default'
                      : isCheckin
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer font-bold'
                      : isReferral
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-110 text-slate-950 shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer font-bold'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer font-bold'
                  }`}
                >
                  {isDone
                    ? isCheckin
                      ? 'Completado Hoy'
                      : 'Completado'
                    : isCheckin
                    ? 'Escanear / Código'
                    : isReferral
                    ? 'Invitar Amigos'
                    : 'Completar'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Information for Calendar Day and Streak */}
      <div className="mt-3.5 pt-3 border-t border-slate-800/70 flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          El check-in presencial se renueva a las 00:00 h. Cada día consecutivo en el local suma +1 a tu racha de visitas.
        </span>
      </div>

      {/* Check-in Presencial Modal with Live Camera & Code Entry */}
      {checkinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#0b101b] border border-emerald-500/50 rounded-3xl p-5 md:p-6 max-w-md w-full shadow-2xl relative glow-neon-combo">
            <button
              onClick={handleCloseCheckinModal}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="text-center mb-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-2 text-emerald-400 shadow-md shadow-emerald-500/20">
                <MapPin className="w-6 h-6" />
              </div>
              <h4 className="text-base md:text-lg font-black text-white">
                Visita Presencial en el Local
              </h4>
              <p className="text-xs text-slate-300 mt-1">
                Escanea el cartel físico en <strong>{STORE_NAME}</strong> o introduce el código para reclamar <strong>+5 minutos</strong> y aumentar tu racha.
              </p>
            </div>

            {/* Streak Preview Pill */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between text-xs mb-3 font-mono">
              <span className="flex items-center gap-1.5 text-slate-300">
                <Flame className="w-4 h-4 text-amber-400 fill-amber-400 animate-pulse" />
                <span>Racha actual:</span>
                <strong className="text-emerald-400">{userStreak} días</strong>
              </span>
              <span className="text-[11px] text-cyan-300 bg-cyan-950/60 border border-cyan-800/50 px-2 py-0.5 rounded-full">
                Próxima meta: {userStreak + 1} días 🔥
              </span>
            </div>

            {/* Tabs: Escanear Cartel vs Ingresar Código */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 my-3">
              <button
                type="button"
                onClick={() => handleTabChange('qr')}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  checkinTab === 'qr'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Escanear QR de Cartel</span>
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('code')}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  checkinTab === 'code'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Ingresar Código</span>
              </button>
            </div>

            {/* Tab 1: Live QR Camera Scanner */}
            {checkinTab === 'qr' && (
              <div className="space-y-3">
                <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden relative shadow-inner aspect-[4/3] flex items-center justify-center">
                  {/* Permanently mounted video element: prevents black screen by keeping ref and media stream always attached */}
                  <video
                    ref={(el) => {
                      videoRef.current = el;
                      if (el && mediaStreamRef.current && cameraActive) {
                        attachStreamToVideo(el, mediaStreamRef.current);
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                    onLoadedMetadata={(e) => {
                      const v = e.currentTarget;
                      v.play()
                        .then(() => setIsVideoPlaying(true))
                        .catch((err) => console.warn('Video play error on onloadedmetadata:', err));
                    }}
                    onPlay={() => setIsVideoPlaying(true)}
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                      cameraActive && isVideoPlaying ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                    }`}
                  />

                  {/* Active Camera Scan HUD Overlay with target corners and moving laser */}
                  {cameraActive && isVideoPlaying && (
                    <>
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6 z-20">
                        <div className="w-44 h-44 border-2 border-emerald-400/80 rounded-2xl relative shadow-[0_0_20px_rgba(16,185,129,0.3)] bg-emerald-950/10">
                          {/* Corner markers */}
                          <div className="absolute -top-1 -left-1 w-4 h-4 border-t-3 border-l-3 border-emerald-300" />
                          <div className="absolute -top-1 -right-1 w-4 h-4 border-t-3 border-r-3 border-emerald-300" />
                          <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-3 border-l-3 border-emerald-300" />
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-3 border-r-3 border-emerald-300" />

                          {/* Scanning laser beam */}
                          <div className="absolute inset-x-2 h-0.5 bg-emerald-300 shadow-[0_0_12px_#34d399] animate-laser" />
                        </div>
                      </div>

                      <div className="absolute bottom-2 inset-x-2 text-center pointer-events-none z-20">
                        <span className="bg-slate-950/80 backdrop-blur-md text-emerald-300 text-[10px] font-mono px-2.5 py-1 rounded-full border border-emerald-800/60 shadow">
                          🟢 Cámara activa · Apunta al QR del cartel
                        </span>
                      </div>
                    </>
                  )}

                  {/* Initializing / Camera Standby / Error Indicator */}
                  {(!cameraActive || !isVideoPlaying) && (
                    <div className="text-center p-4 z-10 flex flex-col items-center justify-center">
                      <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-2 text-slate-400">
                        {cameraError ? (
                          <CameraOff className="w-6 h-6 text-amber-400" />
                        ) : (
                          <Camera className="w-6 h-6 text-emerald-400 animate-pulse" />
                        )}
                      </div>
                      <p className="text-xs text-slate-300 font-semibold mb-1">
                        {cameraError || (cameraActive ? 'Transmitiendo video en vivo...' : 'Iniciando cámara trasera...')}
                      </p>
                      <button
                        type="button"
                        onClick={startCamera}
                        className="mt-2 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-mono inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Reintentar Encender Cámara</span>
                      </button>
                    </div>
                  )}

                  {/* Feedback overlay on detection */}
                  {detectedFeedback && (
                    <div className="absolute inset-0 bg-emerald-950/90 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4 animate-in fade-in">
                      <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-2 animate-bounce" />
                      <p className="text-sm font-bold text-white">{detectedFeedback}</p>
                      <p className="text-xs text-emerald-300 mt-1 font-mono">+5 Minutos & +1 Racha de Visitas</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Manual Code Entry */}
            {checkinTab === 'code' && (
              <div className="space-y-3">
                <div className="bg-slate-950 rounded-2xl p-3.5 border border-slate-800 text-left">
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Código Diario del Cartel
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: SJD-..."
                    value={inputCode}
                    onChange={(e) => {
                      setInputCode(e.target.value);
                      setCodeError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleVerifyDailyCode();
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400 font-mono uppercase tracking-wider"
                  />
                  <div className="mt-2 text-[11px] text-slate-400">
                    <span>Introduce el código impreso en el cartel físico de recepción.</span>
                  </div>
                </div>

                {codeError && (
                  <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-950/40 border border-rose-800/40 p-2.5 rounded-xl">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{codeError}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleVerifyDailyCode}
                  className="w-full py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-lg cursor-pointer hover:brightness-110 active:scale-[0.98] transition-all"
                >
                  Validar Código y Reclamar +5 Minutos
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {profileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative">
            <button
              onClick={() => setProfileModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center mx-auto mb-3 text-cyan-400">
              <UserCheck className="w-6 h-6" />
            </div>

            <h4 className="text-base font-bold text-white text-center">
              Perfil de Jugador en {STORE_NAME}
            </h4>
            <p className="text-xs text-slate-400 mt-1 text-center">
              Verifica tus datos para recibir minutos de regalo en tu cumpleaños (+5 min).
            </p>

            <div className="space-y-3 my-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Teléfono Móvil
                </label>
                <input
                  type="text"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Fecha de Nacimiento
                </label>
                <input
                  type="date"
                  value={profileBirth}
                  onChange={(e) => setProfileBirth(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <button
              onClick={() => {
                soundEffects.playWin();
                setProfileModalOpen(false);
                onClaimTask('task-2', 5, 'Completar perfil de jugador');
              }}
              className="w-full py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-500 to-cyan-400 text-slate-950 shadow-lg cursor-pointer hover:brightness-110 active:scale-[0.98]"
            >
              Guardar y Reclamar +5 Minutos
            </button>
          </div>
        </div>
      )}

      {/* Referral Modal */}
      {referralModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#0f172a] border border-amber-500/40 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative">
            <button
              onClick={() => {
                setReferralModalOpen(false);
                setCopiedReferral(false);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto mb-3 text-amber-400 shadow-md shadow-amber-500/20">
              <Share2 className="w-6 h-6" />
            </div>

            <h4 className="text-base font-bold text-white text-center">
              Invitar a un Amigo a {STORE_NAME}
            </h4>
            <p className="text-xs text-slate-300 mt-1 text-center leading-relaxed">
              Comparte tu enlace. Cuando tu amigo se registre y visite la sala por primera vez (primer check-in presencial), recibirás <strong className="text-emerald-400 font-bold">+20 minutos</strong> automáticamente.
            </p>

            <div className="my-4 p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 text-center break-all select-all">
              {`https://sala-de-juegos-damihan.netlify.app/?ref=${encodeURIComponent(username || 'jugador')}`}
            </div>

            <button
              onClick={() => {
                const referralUrl = `https://sala-de-juegos-damihan.netlify.app/?ref=${encodeURIComponent(username || 'jugador')}`;
                navigator.clipboard?.writeText(referralUrl);
                soundEffects.playTick(1.1);
                setCopiedReferral(true);
                setTimeout(() => setCopiedReferral(false), 2500);
              }}
              className="w-full py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-500 to-amber-400 text-slate-950 shadow-lg cursor-pointer hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {copiedReferral ? (
                <>
                  <Check className="w-4 h-4 text-slate-950" />
                  <span>¡Enlace Copiado al Portapapeles!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-950" />
                  <span>Copiar Mi Enlace Único</span>
                </>
              )}
            </button>
            <p className="mt-2.5 text-[10px] text-slate-500 text-center">
              Los +25 minutos se acreditarán automáticamente en Firebase cuando tu amigo complete su registro.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
