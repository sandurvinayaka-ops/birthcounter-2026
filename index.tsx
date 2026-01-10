
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';

// --- Configuration ---
const BIRTHS_PER_SECOND = 4.352;
const AUTO_ROTATION_SPEED = 0.015; 
const INITIAL_PHI = -15;
const MAX_DPR = 1.0; 

const COLORS = {
  LAND: '#1e293b',
  OCEAN_DEEP: '#08132b',
  OCEAN_BRIGHT: '#1e3a8a',
  GOLD_SOLID: '#facc15',
  ATMOSPHERE: 'rgba(56, 189, 248, 0.2)',
  PACIFIER_SHIELD: '#009b9b',
  PACIFIER_HANDLE: '#ffffff',
  TEAT_SILICONE: 'rgba(255, 255, 255, 0.5)',
};

/**
 * TV-Optimized Dashboard Layout: Globe shifted right
 */
const getGlobePosition = (w: number, h: number) => {
  const minDim = Math.min(w, h);
  const radius = minDim * 0.42;
  const cx = w > 768 ? w * 0.65 : w / 2;
  const cy = h / 2;
  return { cx, cy, radius };
};

interface Comet {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  rot: number;
  rv: number;
  size: number;
  alpha: number;
  history: {x: number, y: number}[];
}

const GlobalApp: React.FC = () => {
  const [total, setTotal] = useState<number>(0);
  const [timeState, setTimeState] = useState({ label: "00:00", pct: 0 });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const geoDataRef = useRef<any>(null);
  const startTimeRef = useRef<number>(performance.now());
  const activeFlashes = useRef<Map<string, number>>(new Map());
  const comets = useRef<Comet[]>([]);
  const countRef = useRef(0);

  // Load Map Data
  useEffect(() => {
    fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson')
      .then(res => res.json())
      .then(data => {
        data.features.forEach((f: any) => { f.centroid = d3.geoCentroid(f); });
        geoDataRef.current = data;
      });
  }, []);

  // Birth Counter Logic
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

  // Main Render Loop
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
      z: 0.6 + Math.random() * 0.4,
      vx: (Math.random() - 0.5) * 2.8,
      vy: (Math.random() - 0.5) * 2.8,
      rot: Math.random() * Math.PI * 2,
      rv: (Math.random() - 0.5) * 0.05,
      size: 20 + Math.random() * 15,
      alpha: 0,
      history: []
    });

    const drawPhilipsPacifier = (ctx: CanvasRenderingContext2D, size: number) => {
      // Shield - Improved Ultra Air shape
      ctx.beginPath();
      ctx.moveTo(-size, -size * 0.3);
      ctx.bezierCurveTo(-size * 1.1, -size * 0.8, -size * 0.2, -size * 0.7, 0, -size * 0.4);
      ctx.bezierCurveTo(size * 0.2, -size * 0.7, size * 1.1, -size * 0.8, size, -size * 0.3);
      ctx.bezierCurveTo(size * 1.3, size * 0.2, size * 0.8, size * 0.8, 0, size * 0.5);
      ctx.bezierCurveTo(-size * 0.8, size * 0.8, -size * 1.3, size * 0.2, -size, -size * 0.3);
      ctx.fillStyle = COLORS.PACIFIER_SHIELD;
      ctx.fill();
      
      // Airflow holes
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.ellipse(-size * 0.5, 0, size * 0.2, size * 0.1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(size * 0.5, 0, size * 0.2, size * 0.1, 0, 0, Math.PI * 2); ctx.fill();

      // Teat (Silicone tip)
      ctx.beginPath();
      ctx.ellipse(0, -size * 0.5, size * 0.35, size * 0.55, 0, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.TEAT_SILICONE;
      ctx.fill();

      // Handle (Ring)
      ctx.beginPath();
      ctx.arc(0, size * 0.15, size * 0.35, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.PACIFIER_HANDLE;
      ctx.lineWidth = size * 0.1;
      ctx.stroke();
    };

    const render = (time: number) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const { cx, cy, radius } = getGlobePosition(w, h);

      if (canvas.width !== Math.floor(w * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        ctx.scale(dpr, dpr);
      }

      ctx.fillStyle = '#010206';
      ctx.fillRect(0, 0, w, h);

      // Glowing Stars
      for (let i = 0; i < 180; i++) {
        const sx = (Math.sin(i * 123.45) * 0.5 + 0.5) * w;
        const sy = (Math.cos(i * 456.78) * 0.5 + 0.5) * h;
        const brightness = (Math.sin(i + time * 0.0012) * 0.5 + 0.5);
        const baseAlpha = 0.2 + brightness * 0.6;
        
        // Star Aura (Glow)
        if (i % 5 === 0) {
          const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 4);
          glow.addColorStop(0, `rgba(255,255,255,${baseAlpha * 0.3})`);
          glow.addColorStop(1, 'transparent');
          ctx.fillStyle = glow;
          ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2); ctx.fill();
        }

        ctx.fillStyle = `rgba(255,255,255,${baseAlpha})`;
        const s = i % 3 === 0 ? 1.5 : 0.8;
        ctx.fillRect(sx, sy, s, s);
      }

      if (comets.current.length < 10) comets.current.push(createComet(w, h));
      comets.current.forEach((c, idx) => {
        c.x += c.vx; c.y += c.vy; c.rot += c.rv;
        c.alpha = Math.min(c.alpha + 0.015, 0.5);
        
        c.history.unshift({x: c.x, y: c.y});
        if (c.history.length > 15) c.history.pop();

        if (c.x < -300 || c.x > w + 300 || c.y < -300 || c.y > h + 300) {
          comets.current[idx] = createComet(w, h);
          return;
        }

        // Trail
        if (c.history.length > 1) {
          for (let p = 0; p < c.history.length - 1; p++) {
            const ratio = 1 - (p / c.history.length);
            ctx.beginPath();
            ctx.moveTo(c.history[p].x, c.history[p].y);
            ctx.lineTo(c.history[p+1].x, c.history[p+1].y);
            ctx.strokeStyle = `rgba(0,180,180,${c.alpha * ratio * 0.4})`; 
            ctx.lineWidth = c.size * 0.5 * ratio;
            ctx.lineCap = 'round';
            ctx.stroke();
          }
        }

        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);
        ctx.globalAlpha = c.alpha;
        drawPhilipsPacifier(ctx, c.size * 0.6);
        ctx.restore();
      });
      ctx.globalAlpha = 1.0;

      if (!geoDataRef.current) {
        animId = requestAnimationFrame(render);
        return;
      }

      // Globe
      const elapsed = time - startTimeRef.current;
      const rotX = (elapsed * AUTO_ROTATION_SPEED) % 360;
      const projection = d3.geoOrthographic()
        .scale(radius)
        .translate([cx, cy])
        .rotate([rotX, INITIAL_PHI, 0])
        .precision(2.0)
        .clipAngle(90);
      const path = d3.geoPath(projection, ctx);

      const ocean = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx, cy, radius);
      ocean.addColorStop(0, COLORS.OCEAN_BRIGHT);
      ocean.addColorStop(1, COLORS.OCEAN_DEEP);
      ctx.fillStyle = ocean;
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();

      ctx.beginPath();
      path(geoDataRef.current);
      ctx.fillStyle = COLORS.LAND;
      ctx.fill();

      const atmosphere = ctx.createRadialGradient(cx, cy, radius, cx, cy, radius * 1.08);
      atmosphere.addColorStop(0, COLORS.ATMOSPHERE);
      atmosphere.addColorStop(1, 'transparent');
      ctx.fillStyle = atmosphere;
      ctx.beginPath(); ctx.arc(cx, cy, radius * 1.08, 0, Math.PI * 2); ctx.fill();

      const now = Date.now();
      activeFlashes.current.forEach((flashTime, id) => {
        const feature = geoDataRef.current.features.find((f: any) => f.id === id || f.properties.name === id || f.id === id.substring(0,3));
        if (feature) {
          const t = Math.min((now - flashTime) / 1800, 1);
          if (t >= 1) {
            activeFlashes.current.delete(id);
          } else {
            const distance = d3.geoDistance(feature.centroid, [-rotX, -INITIAL_PHI]);
            if (distance < 1.57) {
              ctx.beginPath();
              path(feature);
              ctx.fillStyle = d3.interpolateRgb(COLORS.GOLD_SOLID, COLORS.LAND)(t);
              ctx.fill();
            }
          }
        }
      });

      ctx.beginPath();
      path(geoDataRef.current);
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-black flex flex-col font-sans">
      <canvas ref={canvasRef} className="absolute inset-0 z-0" style={{ willChange: 'contents' }} />

      {/* Brand Header */}
      <div className="absolute top-12 left-12 md:top-20 md:left-20 z-40 pointer-events-none">
        <div className="flex flex-col items-start w-fit">
          <div className="flex items-baseline font-black tracking-tighter text-xl md:text-3xl leading-none">
            <span className="text-white">M</span>
            <span className="text-white">&</span>
            <span className="text-white">CC</span>
          </div>
          <div className="w-full h-[2.5px] bg-sky-500 mt-1 opacity-70 shadow-[0_0_12px_rgba(14,165,233,0.6)]"></div>
        </div>
      </div>

      {/* Stats Dashboard - Left Aligned */}
      <div className="absolute inset-y-0 left-0 z-40 flex flex-col justify-center pl-12 md:pl-20 pointer-events-none w-full max-w-[700px]">
        <div className="flex flex-col items-start w-full">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sky-400 font-bold uppercase tracking-[0.4em] text-xs md:text-sm drop-shadow-lg">Global birth count today</span>
          </div>
          
          <div className="mb-4">
            <span className="text-[10vw] md:text-[108px] font-black leading-none tabular-nums" 
              style={{ 
                fontFamily: "'Anton', sans-serif", 
                color: COLORS.GOLD_SOLID,
                textShadow: `0 5px 0 #854d0e, 0 15px 50px rgba(0,0,0,0.9)`
              }}>
              {total.toLocaleString('en-US').replace(/,/g, '.')}
            </span>
          </div>

          {/* Progress Section */}
          <div className="w-[65%] relative">
            <div className="flex justify-between items-end mb-2 relative h-4">
              <span className="text-sky-400 font-bold uppercase tracking-[0.2em] text-[10px] opacity-70">Daily Progress</span>
              <span className="text-white/40 font-mono text-[10px] tabular-nums">{Math.floor(timeState.pct)}%</span>
            </div>

            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden shadow-inner ring-1 ring-white/5">
              <div className="h-full rounded-full transition-all duration-1000 ease-linear shadow-[0_0_10px_rgba(250,204,21,0.4)]"
                style={{ width: `${timeState.pct}%`, background: COLORS.GOLD_SOLID }} />
            </div>

            {/* Time Floating Indicator - Now positioned BELOW the bar */}
            <div 
              className="absolute top-4 transition-all duration-1000 ease-linear"
              style={{ left: `${timeState.pct}%`, transform: 'translateX(-50%)' }}
            >
              <div className="flex flex-col items-center">
                <div className="w-[1.5px] h-3 bg-white/50 mb-1"></div>
                <span className="font-mono text-xl font-black tracking-[0.1em] text-white tabular-nums drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                  {timeState.label}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cinematic Overlays */}
      <div className="absolute inset-0 pointer-events-none z-10 bg-gradient-to-r from-black/85 via-black/20 to-transparent" />
      <div className="absolute top-0 left-0 w-full h-48 bg-gradient-to-b from-black/60 to-transparent z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-full h-72 bg-gradient-to-t from-black/60 to-transparent z-10 pointer-events-none" />
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<GlobalApp />);
}
