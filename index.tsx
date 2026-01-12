
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';

// --- Configuration ---
const BIRTHS_PER_SECOND = 4.352;
const AUTO_ROTATION_SPEED = 12.5; // Degrees per second for smooth rotation
const INITIAL_PHI = -15;
// TV Optimization: Cap DPR at 1.2 to ensure high FPS on large display panels
const MAX_DPR = Math.min(window.devicePixelRatio || 1.0, 1.2); 

const COLORS = {
  LAND: '#3d4f66', 
  OCEAN_DEEP: '#050c1f',
  OCEAN_BRIGHT: '#142a66',
  GOLD_SOLID: '#facc15',
  GOLD_BRIGHT: '#fde047',
  ATMOSPHERE: 'rgba(56, 189, 248, 0.1)',
  PACIFIER_SHIELD: '#f0faf8',
  PACIFIER_CENTER: '#e9f5f1',
  PACIFIER_HANDLE: 'rgba(192, 219, 213, 0.6)',
  GLOW: 'rgba(250, 204, 21, 0.3)',
  PROGRESS_BG: 'rgba(15, 23, 42, 0.6)',
  PROGRESS_ACCENT: '#facc15', 
};

/**
 * TV SAFE ZONE CALIBRATION (40-inch Display):
 * - cx: 0.60w (Shifted left to sit immediately next to the progress bar/HUD area)
 * - cy: 0.30h (Maintained high vertical position to clear progress bar overlap)
 * - radius: 0.30 of min dimension
 */
const getGlobePosition = (w: number, h: number) => {
  const minDim = Math.min(w, h);
  const radius = minDim * 0.30; 
  const cx = w > 768 ? w * 0.60 : w / 2;
  const cy = w > 768 ? h * 0.30 : h / 2;
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
  const starsCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const geoDataRef = useRef<any>(null);
  const lastTimeRef = useRef<number>(0);
  const rotationRef = useRef<number>(0);
  const activeFlashes = useRef<Map<string, number>>(new Map());
  const comets = useRef<Comet[]>([]);
  const countRef = useRef(0);

  // Load GeoJSON
  useEffect(() => {
    fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson')
      .then(res => res.json())
      .then(data => {
        if (data && data.features) {
          data.features.forEach((f: any) => { f.centroid = d3.geoCentroid(f); });
          geoDataRef.current = data;
        }
      })
      .catch(err => console.error("GeoJSON load failed", err));
  }, []);

  // Time & Counter Logic
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

  // Rendering Loop
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
      vx: (Math.random() - 0.5) * 180,
      vy: (Math.random() - 0.5) * 180,
      rot: Math.random() * Math.PI * 2,
      rv: (Math.random() - 0.5) * 0.4,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.6 + Math.random() * 0.8,
      size: 4 + Math.random() * 3,
      alpha: 0
    });

    const preRenderStars = (w: number, h: number) => {
      const sCanvas = document.createElement('canvas');
      sCanvas.width = w * dpr;
      sCanvas.height = h * dpr;
      const sCtx = sCanvas.getContext('2d');
      if (!sCtx) return null;
      sCtx.scale(dpr, dpr);
      sCtx.fillStyle = '#010208';
      sCtx.fillRect(0, 0, w, h);
      for (let i = 0; i < 300; i++) {
        const sx = Math.random() * w;
        const sy = Math.random() * h;
        const sz = Math.random() > 0.95 ? 1.4 : 0.6;
        const op = 0.1 + Math.random() * 0.6;
        sCtx.fillStyle = `rgba(255, 255, 255, ${op})`;
        sCtx.fillRect(sx, sy, sz, sz);
      }
      return sCanvas;
    };

    const drawPhilipsPacifier = (ctx: CanvasRenderingContext2D, size: number, alpha: number) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      const sw = size * 1.3;
      const sh = size * 0.9;
      ctx.beginPath();
      ctx.moveTo(-sw * 0.5, -sh * 0.2);
      ctx.bezierCurveTo(-sw * 0.8, -sh * 0.8, sw * 0.8, -sh * 0.8, sw * 0.5, -sh * 0.2);
      ctx.bezierCurveTo(sw * 1.2, sh * 0.2, sw * 0.9, sh * 1.0, 0, sh * 0.7);
      ctx.bezierCurveTo(-sw * 0.9, sh * 1.0, -sw * 1.2, sh * 0.2, -sw * 0.5, -sh * 0.2);
      const shieldGrad = ctx.createLinearGradient(0, -sh, 0, sh);
      shieldGrad.addColorStop(0, '#f0faf8');
      shieldGrad.addColorStop(1, '#a8c7c1');
      ctx.fillStyle = shieldGrad;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.48, size * 0.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, size * 0.25, size * 0.6, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.strokeStyle = 'rgba(192, 219, 213, 0.5)';
      ctx.lineWidth = size * 0.08;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    };

    const render = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const deltaTime = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      // Tight delta cap for butter-smooth movement on high refresh screens
      const safeDelta = Math.min(deltaTime, 0.033);

      const w = window.innerWidth;
      const h = window.innerHeight;
      const { cx, cy, radius } = getGlobePosition(w, h);

      if (canvas.width !== Math.floor(w * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        ctx.setTransform(1, 0, 0, 1, 0, 0); 
        ctx.scale(dpr, dpr);
        starsCanvasRef.current = preRenderStars(w, h);
      }

      // 1. Draw Space Backdrop
      if (starsCanvasRef.current) {
        ctx.drawImage(starsCanvasRef.current, 0, 0, w, h);
      } else {
        ctx.fillStyle = '#010208';
        ctx.fillRect(0, 0, w, h);
      }

      // 2. Comet Physics
      if (comets.current.length < 8) comets.current.push(createComet(w, h));
      comets.current.forEach((c, idx) => {
        c.x += c.vx * safeDelta;
        c.y += c.vy * safeDelta;
        c.rot += c.rv * safeDelta;
        c.wobblePhase += c.wobbleSpeed * safeDelta;
        c.alpha = Math.min(c.alpha + 0.3 * safeDelta, 0.65);
        
        if (c.x < -300 || c.x > w + 300 || c.y < -300 || c.y > h + 300) {
          comets.current[idx] = createComet(w, h);
          return;
        }
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot + Math.sin(c.wobblePhase) * 0.04);
        drawPhilipsPacifier(ctx, c.size, c.alpha);
        ctx.restore();
      });

      if (!geoDataRef.current) {
        animId = requestAnimationFrame(render);
        return;
      }

      // 3. Increment Earth Rotation (Physics-based)
      rotationRef.current = (rotationRef.current + AUTO_ROTATION_SPEED * safeDelta) % 360;

      const projection = d3.geoOrthographic()
        .scale(radius)
        .translate([cx, cy])
        .rotate([rotationRef.current, INITIAL_PHI, 0])
        .clipAngle(90);
      const path = d3.geoPath(projection, ctx);

      // Deep Space Spherical Gradient
      const og = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx, cy, radius);
      og.addColorStop(0, COLORS.OCEAN_BRIGHT);
      og.addColorStop(1, COLORS.OCEAN_DEEP);
      ctx.fillStyle = og;
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();

      // Landmass Rendering
      ctx.beginPath(); path(geoDataRef.current); ctx.fillStyle = COLORS.LAND; ctx.fill();
      ctx.beginPath(); path(geoDataRef.current); ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 0.4; ctx.stroke();

      // High-Precision Atmosphere
      ctx.beginPath();
      const atmo = ctx.createRadialGradient(cx, cy, radius, cx, cy, radius * 1.05);
      atmo.addColorStop(0, COLORS.ATMOSPHERE);
      atmo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = atmo;
      ctx.arc(cx, cy, radius * 1.05, 0, Math.PI * 2);
      ctx.fill();

      // Flash Events
      const timeNow = Date.now();
      activeFlashes.current.forEach((flashTime, id) => {
        const feature = geoDataRef.current.features.find((f: any) => 
          f.id === id || f.properties.name === id || (f.id && f.id.toString().substring(0,3) === id)
        );
        if (feature) {
          const t = Math.min((timeNow - flashTime) / 1500, 1);
          if (t >= 1) {
            activeFlashes.current.delete(id);
          } else {
            const distance = d3.geoDistance(feature.centroid, [-rotationRef.current, -INITIAL_PHI]);
            if (distance < 1.57) {
              ctx.beginPath();
              path(feature);
              ctx.fillStyle = d3.interpolateRgb(COLORS.GOLD_SOLID, COLORS.LAND)(t);
              ctx.fill();
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
    <div className="relative w-full h-full overflow-hidden bg-black flex flex-col font-sans select-none">
      <canvas ref={canvasRef} className="absolute inset-0 z-0" style={{ opacity: 0.95 }} />

      {/* Brand Header */}
      <div className="absolute top-10 left-10 md:top-14 md:left-20 z-40 pointer-events-none">
        <div className="flex flex-col items-start w-fit">
          <div className="flex items-baseline font-black tracking-tighter text-[0.8rem] md:text-[2.2rem] leading-none">
            <span className="text-white">M</span>
            <span className="text-white">&</span>
            <span className="text-white">CC</span>
          </div>
          <div className="w-full h-[1.5px] bg-amber-500 mt-1 opacity-60 shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
        </div>
      </div>

      {/* Main UI Console */}
      <div className="absolute inset-y-0 left-0 z-40 flex flex-col justify-center pl-10 md:pl-20 pointer-events-none w-full max-w-[900px]">
        <div className="flex flex-col items-start w-full">
          <div className="mb-4">
            <span className="text-white font-bold uppercase tracking-[0.45em] text-[0.6rem] md:text-[0.9rem] opacity-80 drop-shadow-md">Global birth count today</span>
          </div>
          
          <div className="mb-5">
            <span className="text-[6.5vw] md:text-[88px] font-black leading-none tabular-nums" 
              style={{ 
                fontFamily: "'Anton', sans-serif", 
                color: COLORS.GOLD_SOLID,
                textShadow: `0 4px 0 #854d0e, 0 15px 50px rgba(0,0,0,0.9)`
              }}>
              {total.toLocaleString('en-US').replace(/,/g, '.')}
            </span>
          </div>

          <div className="w-[45%] md:w-[42%] relative mt-12">
            <div className="flex justify-between items-end mb-4 relative h-6">
              <span className="text-amber-400 font-bold uppercase tracking-[0.45em] text-[0.55rem] md:text-[0.85rem] opacity-80">Daily Progress</span>
              <span className="text-amber-200/40 font-mono text-[11px] md:text-[15px] tabular-nums font-black tracking-widest">{Math.floor(timeState.pct)}%</span>
            </div>

            {/* Tactical Meter */}
            <div className="h-[10px] w-full bg-amber-950/20 rounded-full overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] ring-1 ring-amber-500/10 relative backdrop-blur-sm">
              <div 
                className="h-full rounded-full transition-all duration-1000 ease-linear relative overflow-hidden"
                style={{ 
                    width: `${timeState.pct}%`, 
                    background: `linear-gradient(90deg, #78350f 0%, #d97706 40%, #facc15 90%, #fff 100%)`,
                    boxShadow: `0 0 20px rgba(245, 158, 11, 0.2)`
                }} 
              >
                <div className="absolute top-0 left-0 w-full h-[1.5px] bg-white/10" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent w-[30%] skew-x-[-35deg]" style={{ animation: 'shimmer 4.5s infinite ease-in-out' }} />
              </div>
            </div>

            {/* Time Ref Marker */}
            <div 
              className="absolute top-6 transition-all duration-1000 ease-linear z-50"
              style={{ left: `${timeState.pct}%`, transform: 'translateX(-50%)' }}
            >
              <div className="flex flex-col items-center">
                <div className="w-[1.5px] h-10 bg-gradient-to-b from-amber-400 to-transparent mb-1.5 opacity-40"></div>
                <div className="px-4 py-1.5 bg-black/90 backdrop-blur-xl border border-amber-500/10 rounded shadow-2xl flex items-center justify-center">
                    <span className="font-mono text-[0.8rem] md:text-[1rem] font-bold tracking-[0.25em] text-amber-50 tabular-nums">
                    {timeState.label}
                    </span>
                </div>
              </div>
            </div>

            {/* Calibration Grid */}
            <div className="absolute top-[10px] w-full flex justify-between px-1 opacity-10 pointer-events-none">
                {[...Array(11)].map((_, i) => (
                    <div key={i} className="w-[1px] h-3 bg-amber-50"></div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Cinematic Overlays */}
      <div className="absolute inset-0 pointer-events-none z-10 bg-gradient-to-r from-black/90 via-black/10 to-transparent" />
      <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-black/70 to-transparent z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-full h-60 bg-gradient-to-t from-black/70 to-transparent z-10 pointer-events-none" />

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-200%) skewX(-35deg); }
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
