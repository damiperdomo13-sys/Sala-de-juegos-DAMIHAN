import React, { useRef, useEffect, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, Clock, RefreshCw, Trophy, Play, CheckCircle2, RotateCcw } from 'lucide-react';
import {
  ROULETTE_SECTORS,
  hasSpunRouletteToday,
  getTodayDateString,
  getDateStringFromTimestamp,
  getMsUntilMidnight,
} from '../utils/storage';
import { RouletteSector } from '../types';
import { soundEffects } from '../utils/audio';

interface RouletteProps {
  lastSpinTimestamp: number;
  lastSpinDate?: string;
  onSpinWin: (minutes: number) => void;
}

export const Roulette: React.FC<RouletteProps> = ({
  lastSpinTimestamp,
  lastSpinDate,
  onSpinWin,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotationAngle, setRotationAngle] = useState(0);
  const [winModal, setWinModal] = useState<{ open: boolean; minutes: number; label: string } | null>(null);
  const [timeUntilMidnight, setTimeUntilMidnight] = useState<number>(0);
  const [currentDateKey, setCurrentDateKey] = useState<string>(getTodayDateString());
  const animFrameRef = useRef<number | null>(null);
  const lastSectorIndexRef = useRef<number>(-1);

  // Check if user has already spun today based on local system calendar date (YYYY-MM-DD)
  const spunToday = hasSpunRouletteToday(lastSpinTimestamp, lastSpinDate);

  // Clock tick to recalculate time until midnight (00:00) and auto-unlock when new day begins
  useEffect(() => {
    const updateCalendarTimer = () => {
      const now = new Date();
      setCurrentDateKey(getTodayDateString(now));
      const remainingMs = getMsUntilMidnight(now);
      setTimeUntilMidnight(remainingMs);
    };

    updateCalendarTimer();
    const interval = setInterval(updateCalendarTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  const canSpin = !spunToday && !isSpinning;

  // Format remaining time into HH:MM:SS
  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Draw wheel on canvas
  const drawWheel = useCallback((angle: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const radius = center - 14;
    const numSectors = ROULETTE_SECTORS.length;
    const arc = (2 * Math.PI) / numSectors;

    ctx.clearRect(0, 0, size, size);

    // Outer glow ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius + 8, 0, 2 * Math.PI);
    ctx.strokeStyle = '#10b98133';
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.restore();

    // Outer border
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius + 3, 0, 2 * Math.PI);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.restore();

    // Draw sectors
    ROULETTE_SECTORS.forEach((sector, i) => {
      const sectorAngle = angle + i * arc;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, sectorAngle, sectorAngle + arc);
      ctx.closePath();

      // Sector fill
      ctx.fillStyle = sector.color;
      ctx.fill();

      // Sector border
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Text inside sector
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(sectorAngle + arc / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = sector.textColor;

      // Fit text size according to label length
      if (sector.label.length > 12) {
        ctx.font = 'bold 11px Outfit, sans-serif';
      } else if (sector.label.length > 8) {
        ctx.font = 'bold 13px Outfit, sans-serif';
      } else {
        ctx.font = 'bold 15px Outfit, sans-serif';
      }

      // Subtle text shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 4;
      ctx.fillText(sector.label, radius - 18, 0);

      ctx.restore();
      ctx.restore();
    });

    // Outer neon rim indicator dots
    for (let d = 0; d < 16; d++) {
      const dotAngle = (d * (2 * Math.PI)) / 16;
      const dx = center + (radius + 2) * Math.cos(dotAngle);
      const dy = center + (radius + 2) * Math.sin(dotAngle);
      ctx.save();
      ctx.beginPath();
      ctx.arc(dx, dy, 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = d % 2 === 0 ? '#10b981' : '#06b6d4';
      ctx.fill();
      ctx.restore();
    }

    // Center hub
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, 32, 0, 2 * Math.PI);
    ctx.fillStyle = '#090d16';
    ctx.fill();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Center hub inner core
    ctx.beginPath();
    ctx.arc(center, center, 14, 0, 2 * Math.PI);
    const grad = ctx.createRadialGradient(center, center, 2, center, center, 14);
    grad.addColorStop(0, '#10b981');
    grad.addColorStop(1, '#065f46');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }, []);

  useEffect(() => {
    drawWheel(rotationAngle);
  }, [drawWheel, rotationAngle]);

  const spin = () => {
    if (!canSpin) return;

    soundEffects.playTick(1.5);
    setIsSpinning(true);

    // Pick winning sector based on weights
    const totalWeight = ROULETTE_SECTORS.reduce((acc, s) => acc + s.weight, 0);
    let rand = Math.random() * totalWeight;
    let winningIndex = 0;

    for (let i = 0; i < ROULETTE_SECTORS.length; i++) {
      if (rand < ROULETTE_SECTORS[i].weight) {
        winningIndex = i;
        break;
      }
      rand -= ROULETTE_SECTORS[i].weight;
    }

    const winningSector: RouletteSector = ROULETTE_SECTORS[winningIndex];
    const numSectors = ROULETTE_SECTORS.length;
    const arc = (2 * Math.PI) / numSectors;

    // Pointer is at top: 3 * Math.PI / 2
    const pointerAngle = 1.5 * Math.PI;
    const baseTargetAngle = pointerAngle - (winningIndex * arc + arc / 2);

    const currentAngle = rotationAngle % (2 * Math.PI);
    const fullSpins = 6 + Math.floor(Math.random() * 3);
    const totalRotation = fullSpins * 2 * Math.PI + (baseTargetAngle - currentAngle + (2 * Math.PI)) % (2 * Math.PI);

    const startAngle = rotationAngle;
    const duration = 4200; // 4.2 seconds
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const ease = 1 - Math.pow(1 - progress, 3.5);
      const currentAng = startAngle + totalRotation * ease;

      setRotationAngle(currentAng);
      drawWheel(currentAng);

      // Play tick sound when sector boundary passes pointer
      const normalized = (pointerAngle - (currentAng % (2 * Math.PI)) + 4 * Math.PI) % (2 * Math.PI);
      const currentSectorIndex = Math.floor(normalized / arc) % numSectors;
      if (currentSectorIndex !== lastSectorIndexRef.current) {
        lastSectorIndexRef.current = currentSectorIndex;
        const speed = 1 - progress;
        if (speed > 0.05) {
          soundEffects.playTick(0.8 + speed * 0.8);
        }
      }

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Spin finished
        setIsSpinning(false);

        if (winningSector.minutes > 0) {
          soundEffects.playWin();
          try {
            confetti({
              particleCount: 75,
              spread: 60,
              origin: { y: 0.65 },
              colors: ['#10b981', '#06b6d4', '#f59e0b', '#ffffff'],
            });
          } catch {
            // Ignore
          }
        } else {
          soundEffects.playTick(0.8);
        }

        onSpinWin(winningSector.minutes);
        setWinModal({
          open: true,
          minutes: winningSector.minutes,
          label: winningSector.label,
        });
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  return (
    <div className="bg-[#0b101b] rounded-2xl p-5 border border-slate-800/80 shadow-xl relative overflow-hidden">
      {/* Background ambient neon glow */}
      <div className="absolute -top-20 -right-20 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-44 h-44 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-white text-base md:text-lg">
              Ruleta Diaria de Minutos
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Gira gratis cada día de calendario y gana hasta 100 minutos para consolas en Sala de Juegos Damihan.
          </p>
        </div>

        {/* Cooldown or ready status */}
        <div className="text-right">
          {canSpin ? (
            <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              ¡Disponible hoy!
            </span>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-amber-300 font-mono bg-amber-950/40 border border-amber-800/50 px-2.5 py-1 rounded-full" title="Se reinicia automáticamente a las 00:00">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>00:00 ({formatTime(timeUntilMidnight)})</span>
            </div>
          )}
        </div>
      </div>

      {/* Roulette visual container */}
      <div className="relative flex flex-col items-center justify-center my-3">
        {/* Top Pointer Indicator */}
        <div className="absolute -top-2.5 z-20 flex flex-col items-center">
          <div className="w-0 h-0 border-l-[11px] border-l-transparent border-r-[11px] border-r-transparent border-t-[18px] border-t-emerald-400 drop-shadow-[0_2px_8px_rgba(16,185,129,0.9)] animate-pulse" />
        </div>

        {/* Canvas Wheel */}
        <div className="p-2 rounded-full bg-slate-900/80 border border-slate-800 shadow-2xl relative">
          <canvas
            ref={canvasRef}
            width={320}
            height={320}
            className="w-[280px] h-[280px] sm:w-[310px] sm:h-[310px] rounded-full cursor-pointer select-none"
            onClick={() => {
              if (canSpin) spin();
            }}
          />
        </div>

        {/* Wheel action button */}
        <div className="mt-5 w-full max-w-xs flex flex-col items-center gap-2.5">
          <button
            onClick={spin}
            disabled={!canSpin}
            className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm tracking-wide flex items-center justify-center gap-2.5 transition-all shadow-lg ${
              canSpin
                ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 text-slate-950 hover:brightness-110 active:scale-[0.98] glow-emerald cursor-pointer'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/60'
            }`}
          >
            {isSpinning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                <span>Girando Ruleta de la Fortuna...</span>
              </>
            ) : canSpin ? (
              <>
                <Play className="w-4 h-4 fill-slate-950 text-slate-950" />
                <span>GIRAR RULETA GRATIS</span>
              </>
            ) : (
              <>
                <Clock className="w-4 h-4 text-slate-500" />
                <span>Próximo tiro a las 00:00 ({formatTime(timeUntilMidnight)})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Rewards preview strip */}
      <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Premios: +2, +5, +15 y +100 Minutos (o Vuelve a intentar)
        </span>
        <span className="text-slate-500 font-mono">1 Tiro / Día</span>
      </div>

      {/* Win / Try Again Modal Popup */}
      {winModal && winModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className={`bg-[#0f172a] border rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl relative overflow-hidden ${
              winModal.minutes > 0
                ? 'border-emerald-500/40 glow-emerald'
                : 'border-slate-700 shadow-slate-900/50'
            }`}
          >
            {winModal.minutes > 0 ? (
              <>
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center mx-auto mb-4 text-emerald-400 shadow-lg shadow-emerald-500/30">
                  <Trophy className="w-8 h-8" />
                </div>

                <span className="text-xs font-semibold tracking-wider text-emerald-400 uppercase">
                  ¡Premio Obtenido!
                </span>
                <h4 className="text-2xl font-extrabold text-white mt-1">
                  +{winModal.minutes} Minutos
                </h4>
                <p className="text-xs text-slate-300 mt-2">
                  Se han acreditado exitosamente a tu saldo en Sala de Juegos Damihan. ¡Canjéalos por tiempo de juego en consolas o arcades!
                </p>

                <button
                  onClick={() => setWinModal(null)}
                  className="mt-5 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-sm shadow-md hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
                >
                  ¡Excelente, continuar!
                </button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-4 text-slate-400">
                  <RotateCcw className="w-8 h-8" />
                </div>

                <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                  ¡Casi lo logras!
                </span>
                <h4 className="text-2xl font-extrabold text-white mt-1">
                  Vuelve a intentar
                </h4>
                <p className="text-xs text-slate-300 mt-2">
                  En esta tirada no sumaste minutos extra. ¡Vuelve a girar en tu próximo turno o realiza tu visita presencial al local para ganar más tiempo!
                </p>

                <button
                  onClick={() => setWinModal(null)}
                  className="mt-5 w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm shadow-md active:scale-[0.98] transition-all cursor-pointer border border-slate-700"
                >
                  Entendido
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
