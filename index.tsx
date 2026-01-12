
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';

// --- Configuration ---
const BIRTHS_PER_SECOND = 4.352;
const AUTO_ROTATION_SPEED = 0.012; 
const INITIAL_PHI = -15;
const MAX_DPR = window.devicePixelRatio || 1.0; 

const COLORS = {
  LAND: '#3d4f66', 
  OCEAN_DEEP: '#050c1f',
  OCEAN_BRIGHT: '#142a66',
  GOLD_SOLID: '#facc15',
  GOLD_BRIGHT: '#fde047',
  ATMOSPHERE: 'rgba(56, 189, 248, 0.15)',
  PACIFIER_SHIELD: '#c0dbd5',
  PACIFIER_CENTER: '#e9f5f1',
  PACIFIER_HANDLE: 'rgba(192, 219, 213, 0.8)',
  GLOW: 'rgba(250, 204, 21, 0.4)', // Warm gold glow
  PROGRESS_BG: 'rgba(15, 23, 42, 0.6)',
  PROGRESS_ACCENT: '#facc15', 
};

const getGlobePosition = (w: number, h: number) => {
  const minDim = Math.min(w, h);
  const radius = minDim * 0.44;
  const cx = w > 768 ? w * 0.68 : w / 2;
  const cy = h / 2;
  return { cx, cy, radius };
};

interface Comet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  rv: number;
  wobblePhase: number;
  wobbleSpeed: number;
  size: number;
  alpha: number;
}

const GlobalApp: React.FC = () => {
  const [total, setTotal] = useState<number>(0);
  const [timeState, setTimeState] = useState({ label: "00:00", pct: 0 });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const geoDataRef = useRef<any>(null);
  const startTimeRef = useRef<number>(performance.now());
  const lastTimeRef = useRef<number>(performance.now());
  const activeFlashes = useRef<Map<string, number>>(new Map());
  const comets = useRef<Comet[]>([]);
  const countRef = useRef(0);

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson')
      .then(res => res.json())
      .then(data => {
        data.features.forEach((f: any) => { f.centroid = d3.geoCentroid(f); });
        geoDataRef.current = data;
      });
  }, []);

  useEffect(() => {
    const updateProgress = () => {
      const d = new Date();
      const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const elapsed = (d.getTime() - midnight) / 1000;
      const pct = (elapsed / 86400) * 100;
      if (countRef.current === 0) {
        countRef.current = Math.floor(elapsed * BIRTHS_PER_SECOND);
        setTotal(countRef.current);
      }
      setTimeState({ 
        label: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }), 
        pct 
      });
    };
    
    updateProgress();
    const clockInterval = setInterval(updateProgress, 1000);
    
    let spawnTimeoutId: any;
    const spawn = () => {
      const nextDelay = -Math.log(Math.random()) * (1000 / BIRTHS_PER_SECOND);
      spawnTimeoutId = setTimeout(() => {
        countRef.current += 1; 
        setTotal(countRef.current);
        if (geoDataRef.current) {
          const countries = ['IND', 'CHN', 'NGA', 'PAK', 'IDN', 'BRA', 'USA', 'BGD', 'ETH', 'MEX', 'PHL', 'COD', 'EGY', 'RUS'];
          const target = countries[Math.floor(Math.random() * countries.length)];
          activeFlashes.current.set(target, Date.now());
        }
        spawn();
      }, nextDelay);
    };
    spawn();
    
    return () => { clearInterval(clockInterval); clearTimeout(spawnTimeoutId); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animId: number;
    const dpr = MAX_DPR;

    const createComet = (w: number, h: number): Comet => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 120,
      vy: (Math.random() - 0.5) * 120,
      rot: Math.random() * Math.PI * 2,
      rv: (Math.random() - 0.5) * 1.0,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleSpeed: 2 + Math.random() * 2,
      size: 5 + Math.random() * 5,
      alpha: 0
    });

    const drawPhilipsPacifier = (ctx: CanvasRenderingContext2D, size: number, alpha: number) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowBlur = 12;
      ctx.shadowColor = 'rgba(125, 211, 252, 0.6)';
      const sw = size * 1.3;
      const sh = size * 0.9;
      ctx.beginPath();
      ctx.moveTo(-sw * 0.5, -sh * 0.2);
      ctx.bezierCurveTo(-sw * 0.8, -sh * 0.8, sw * 0.8, -sh * 0.8, sw * 0.5, -sh * 0.2);
      ctx.bezierCurveTo(sw * 1.2, sh * 0.2, sw * 0.9, sh * 1.0, 0, sh * 0.7);
      ctx.bezierCurveTo(-sw * 0.9, sh * 1.0, -sw * 1.2, sh * 0.2, -sw * 0.5, -sh * 0.2);
      const shieldGrad = ctx.createLinearGradient(0, -sh, 0, sh);
      shieldGrad.addColorStop(0, '#e8f7f4');
      shieldGrad.addColorStop(0.5, '#c0dbd5');
      shieldGrad.addColorStop(1, '#98b7b1');
      ctx.fillStyle = shieldGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.48, size * 0.4, 0, 0, Math.PI * 2);
      const buttonGrad = ctx.createRadialGradient(0, -size * 0.1, 0, 0, 0, size * 0.48);
      buttonGrad.addColorStop(0, '#ffffff');
      buttonGrad.addColorStop(1, '#d5e9e4');
      ctx.fillStyle = buttonGrad;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, size * 0.25, size * 0.6, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.strokeStyle = 'rgba(192, 219, 213, 0.8)';
      ctx.lineWidth = size * 0.18;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    };

    const render = (time: number) => {
      const now = performance.now();
      const deltaTime = Math.min((now - lastTimeRef.current) / 1000, 0.1); 
      lastTimeRef.current = now;

      const w = window.innerWidth;
      const h = window.innerHeight;
      const { cx, cy, radius } = getGlobePosition(w, h);

      if (canvas.width !== Math.floor(w * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        ctx.scale(dpr, dpr);
        ctx.imageSmoothingEnabled = true;
      }

      ctx.fillStyle = '#010208';
      ctx.fillRect(0, 0, w, h);

      // Enhanced Stars that "Shine" and "Twinkle"
      for (let i = 0; i < 300; i++) {
        const sx = (Math.sin(i * 123.45) * 0.5 + 0.5) * w;
        const sy = (Math.cos(i * 456.78) * 0.5 + 0.5) * h;
        
        // Individual twinkle speed per star
        const twinkleSpeed = 0.0008 + (i % 8) * 0.0004;
        const brightness = (Math.sin(i + time * twinkleSpeed) * 0.5 + 0.5);
        const baseAlpha = 0.15 + brightness * 0.85;
        
        const isGlowing = i % 25 === 0;
        const isBlueShift = i % 33 === 0;
        
        ctx.save();
        if (isGlowing) {
          ctx.shadowBlur = 4 + brightness * 8;
          ctx.shadowColor = '#fff';
        }
        
        ctx.fillStyle = isBlueShift 
          ? `rgba(186, 230, 253, ${baseAlpha})` 
          : `rgba(255, 255, 255, ${baseAlpha})`;
          
        const sz = isGlowing ? 2.5 : (i % 12 === 0 ? 1.4 : 0.7);
        ctx.fillRect(sx - sz/2, sy - sz/2, sz, sz);
        ctx.restore();
      }

      if (comets.current.length < 24) comets.current.push(createComet(w, h));
      comets.current.forEach((c, idx) => {
        c.x += c.vx * deltaTime;
        c.y += c.vy * deltaTime;
        c.rot += c.rv * deltaTime;
        c.wobblePhase += c.wobbleSpeed * deltaTime;
        c.alpha = Math.min(c.alpha + 0.5 * deltaTime, 0.9);
        if (c.x < -200 || c.x > w + 200 || c.y < -200 || c.y > h + 200) {
          comets.current[idx] = createComet(w, h);
          return;
        }
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot + Math.sin(c.wobblePhase) * 0.15);
        drawPhilipsPacifier(ctx, c.size, c.alpha);
        ctx.restore();
      });

      if (!geoDataRef.current) {
        animId = requestAnimationFrame(render);
        return;
      }

      const rotX = (time * AUTO_ROTATION_SPEED) % 360;
      const projection = d3.geoOrthographic()
        .scale(radius)
        .translate([cx, cy])
        .rotate([rotX, INITIAL_PHI, 0])
        .precision(0.1)
        .clipAngle(90);
      const path = d3.geoPath(projection, ctx);

      const og = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx, cy, radius);
      og.addColorStop(0, COLORS.OCEAN_BRIGHT);
      og.addColorStop(1, COLORS.OCEAN_DEEP);
      ctx.fillStyle = og;
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();

      ctx.beginPath(); path(geoDataRef.current); ctx.fillStyle = COLORS.LAND; ctx.fill();
      ctx.beginPath(); path(geoDataRef.current); ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 0.5; ctx.stroke();

      const atmo = ctx.createRadialGradient(cx, cy, radius, cx, cy, radius * 1.08);
      atmo.addColorStop(0, COLORS.ATMOSPHERE);
      atmo.addColorStop(1, 'transparent');
      ctx.fillStyle = atmo;
      ctx.beginPath(); ctx.arc(cx, cy, radius * 1.08, 0, Math.PI * 2); ctx.fill();

      const timeNow = Date.now();
      activeFlashes.current.forEach((flashTime, id) => {
        const feature = geoDataRef.current.features.find((f: any) => f.id === id || f.properties.name === id || f.id === id.substring(0,3));
        if (feature) {
          const t = Math.min((timeNow - flashTime) / 1800, 1);
          if (t >= 1) {
            activeFlashes.current.delete(id);
          } else {
            const distance = d3.geoDistance(feature.centroid, [-rotX, -INITIAL_PHI]);
            if (distance < 1.57) {
              ctx.beginPath();
              path(feature);
              ctx.fillStyle = d3.interpolateRgb(COLORS.GOLD_SOLID, COLORS.LAND)(t);
              ctx.fill();
              ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - t)})`;
              ctx.stroke();
            }
          }
        }
      });
      animId = requestAnimationFrame(render);
    };
    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-black flex flex-col font-sans">
      <canvas ref={canvasRef} className="absolute inset-0 z-0" style={{ willChange: 'contents' }} />

      <div className="absolute top-8 left-8 md:top-14 md:left-14 z-40 pointer-events-none">
        <div className="flex flex-col items-start w-fit">
          <div className="flex items-baseline font-black tracking-tighter text-[0.7rem] md:text-[2.1rem] leading-none">
            <span className="text-white">M</span>
            <span className="text-white">&</span>
            <span className="text-white">CC</span>
          </div>
          <div className="w-full h-[1.5px] bg-amber-500 mt-0.5 opacity-70 shadow-[0_0_8px_rgba(245,158,11,0.6)]"></div>
        </div>
      </div>

      <div className="absolute inset-y-0 left-0 z-40 flex flex-col justify-center pl-8 md:pl-14 pointer-events-none w-full max-w-[800px]">
        <div className="flex flex-col items-start w-full">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-white font-bold uppercase tracking-[0.4em] text-[0.55rem] md:text-[0.75rem] drop-shadow-lg opacity-90">Global birth count today</span>
          </div>
          
          <div className="mb-2">
            <span className="text-[5.7vw] md:text-[69px] font-black leading-none tabular-nums" 
              style={{ 
                fontFamily: "'Anton', sans-serif", 
                color: COLORS.GOLD_SOLID,
                textShadow: `0 3px 0 #854d0e, 0 12px 40px rgba(0,0,0,0.9)`
              }}>
              {total.toLocaleString('en-US').replace(/,/g, '.')}
            </span>
          </div>

          <div className="w-[42%] md:w-[38%] relative mt-8">
            <div className="flex justify-between items-end mb-2 relative h-5">
              <span className="text-amber-400 font-bold uppercase tracking-[0.4em] text-[0.55rem] md:text-[0.75rem] opacity-70 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]">Daily Progress</span>
              <span className="text-amber-200/50 font-mono text-[10px] md:text-[12px] tabular-nums font-black tracking-widest">{Math.floor(timeState.pct)}%</span>
            </div>

            {/* Thinner Progress Bar (8px) with Solar Gold Color Scheme */}
            <div className="h-[8px] w-full bg-amber-950/40 rounded-full overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] ring-1 ring-amber-500/20 relative backdrop-blur-md">
              {/* Solar Gold Gradient Fill */}
              <div 
                className="h-full rounded-full transition-all duration-1000 ease-linear relative overflow-hidden"
                style={{ 
                    width: `${timeState.pct}%`, 
                    background: `linear-gradient(90deg, #78350f 0%, #d97706 35%, #facc15 85%, #fef3c7 100%)`,
                    boxShadow: `0 0 15px rgba(245, 158, 11, 0.3)`
                }} 
              >
                {/* Internal High-gloss Shine Line */}
                <div className="absolute top-0 left-0 w-full h-[1px] bg-white/20" />
                
                {/* Advanced Scanning Shimmer */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent w-[30%] skew-x-[-35deg]" style={{ animation: 'shimmer 4s infinite ease-in-out' }} />
              </div>
            </div>

            {/* Precision Instrument Marker */}
            <div 
              className="absolute top-5 transition-all duration-1000 ease-linear z-50"
              style={{ left: `${timeState.pct}%`, transform: 'translateX(-50%)' }}
            >
              <div className="flex flex-col items-center">
                <div className="w-[1px] h-6 bg-gradient-to-b from-amber-400 to-transparent mb-1 opacity-60"></div>
                <div className="px-2 py-0.5 bg-black/95 backdrop-blur-md border border-amber-500/20 rounded shadow-2xl flex items-center justify-center">
                    <span className="font-mono text-[0.7rem] md:text-[0.8rem] font-bold tracking-[0.15em] text-amber-50 tabular-nums">
                    {timeState.label}
                    </span>
                </div>
              </div>
            </div>

            {/* Tick Marks with recalibrated spacing */}
            <div className="absolute top-[8px] w-full flex justify-between px-1 opacity-10 pointer-events-none">
                {[...Array(11)].map((_, i) => (
                    <div key={i} className="w-[0.5px] h-1.5 bg-amber-200"></div>
                ))}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none z-10 bg-gradient-to-r from-black/95 via-black/20 to-transparent" />
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-black/70 to-transparent z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-full h-48 bg-gradient-to-t from-black/70 to-transparent z-10 pointer-events-none" />

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-250%) skewX(-35deg); }
          100% { transform: translateX(500%) skewX(-35deg); }
        }
      `}</style>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<GlobalApp />);
}
