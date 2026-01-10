
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';

// --- Configuration ---
const BIRTHS_PER_SECOND = 4.352;
const AUTO_ROTATION_SPEED = 0.015; // Degrees per ms
const INITIAL_PHI = -25;
const MAX_DPR = 1.0; // Essential for TV performance to stay at native pixel grid

const COLORS = {
  LAND: '#1e293b',
  OCEAN_DEEP: '#08132b',
  OCEAN_BRIGHT: '#1e3a8a',
  GOLD_SOLID: '#facc15',
  ATMOSPHERE: 'rgba(56, 189, 248, 0.2)',
  PACIFIER: '#009b9b',
  TEAT: 'rgba(255, 255, 255, 0.6)',
};

/**
 * TV-Optimized Position Logic
 */
const getGlobePosition = (w: number, h: number) => {
  const minDim = Math.min(w, h);
  const radius = minDim * 0.38;
  return { cx: w / 2, cy: h / 2, radius };
};

// --- Types ---
interface Comet {
  type: 'p' | 't';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  rot: number;
  rv: number;
  size: number;
  alpha: number;
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
      setTimeState({ label: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }), pct });
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

  // Main Render Loop (Combined for performance)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false }); // Disable alpha for background clearing speed
    if (!ctx) return;

    let animId: number;
    const dpr = MAX_DPR;

    const createComet = (w: number, h: number): Comet => ({
      type: Math.random() > 0.5 ? 'p' : 't',
      x: Math.random() * w,
      y: Math.random() * h,
      z: 0.5 + Math.random() * 0.5,
      vx: (Math.random() - 0.5) * 2.0,
      vy: (Math.random() - 0.5) * 2.0,
      rot: Math.random() * Math.PI * 2,
      rv: (Math.random() - 0.5) * 0.03,
      size: 10 + Math.random() * 10,
      alpha: 0
    });

    const render = (time: number) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const { cx, cy, radius } = getGlobePosition(w, h);

      if (canvas.width !== Math.floor(w * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        ctx.scale(dpr, dpr);
      }

      // Draw background directly to avoid CSS composition issues
      ctx.fillStyle = '#000103';
      ctx.fillRect(0, 0, w, h);

      if (!geoDataRef.current) {
        animId = requestAnimationFrame(render);
        return;
      }

      // 1. Update & Draw Comets (Background Comets)
      if (comets.current.length < 8) comets.current.push(createComet(w, h));
      comets.current.forEach((c, idx) => {
        c.x += c.vx; c.y += c.vy; c.rot += c.rv;
        c.alpha = Math.min(c.alpha + 0.01, 0.4);
        if (c.x < -100 || c.x > w + 100 || c.y < -100 || c.y > h + 100) comets.current[idx] = createComet(w, h);
        
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);
        ctx.globalAlpha = c.alpha;
        ctx.fillStyle = c.type === 'p' ? COLORS.PACIFIER : COLORS.TEAT;
        ctx.beginPath();
        ctx.arc(0, 0, c.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      ctx.globalAlpha = 1.0;

      // 2. Globe Rotation & Projection
      const elapsed = time - startTimeRef.current;
      const rotX = (elapsed * AUTO_ROTATION_SPEED) % 360;
      const projection = d3.geoOrthographic()
        .scale(radius)
        .translate([cx, cy])
        .rotate([rotX, INITIAL_PHI, 0])
        .precision(2.0) // Significant speedup for TVs
        .clipAngle(90);
      const path = d3.geoPath(projection, ctx);

      // 3. Globe Base
      const ocean = ctx.createRadialGradient(cx - radius * 0.2, cy - radius * 0.2, 0, cx, cy, radius);
      ocean.addColorStop(0, COLORS.OCEAN_BRIGHT);
      ocean.addColorStop(1, COLORS.OCEAN_DEEP);
      ctx.fillStyle = ocean;
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();

      // 4. Batch Land Rendering
      ctx.beginPath();
      path(geoDataRef.current);
      ctx.fillStyle = COLORS.LAND;
      ctx.fill();

      // 5. Lighting Overlays
      const atmosphere = ctx.createRadialGradient(cx, cy, radius, cx, cy, radius * 1.05);
      atmosphere.addColorStop(0, COLORS.ATMOSPHERE);
      atmosphere.addColorStop(1, 'transparent');
      ctx.fillStyle = atmosphere;
      ctx.beginPath(); ctx.arc(cx, cy, radius * 1.05, 0, Math.PI * 2); ctx.fill();

      // 6. Active Country Flashes
      const now = Date.now();
      activeFlashes.current.forEach((flashTime, id) => {
        const feature = geoDataRef.current.features.find((f: any) => f.id === id || f.properties.name === id || f.id === id.substring(0,3));
        if (feature) {
          const t = Math.min((now - flashTime) / 1500, 1);
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

      // 7. Borders (Very faint)
      ctx.beginPath();
      path(geoDataRef.current);
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
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

      {/* UI Elements - Kept as DOM for accessibility and layout */}
      <div className="absolute top-12 left-12 md:top-20 md:left-20 z-40 pointer-events-none">
        <div className="flex flex-col items-start w-fit">
          <div className="flex items-baseline font-black tracking-tighter text-xl md:text-3xl leading-none">
            <span className="text-white">M</span>
            <span className="text-white">&</span>
            <span className="text-white">CC</span>
          </div>
          <div className="w-full h-[2px] bg-sky-500 mt-1 opacity-70"></div>
        </div>
      </div>

      <div className="absolute inset-y-0 left-0 z-40 flex flex-col justify-center pl-12 md:pl-20 pointer-events-none w-full max-w-[500px]">
        <div className="flex flex-col items-start">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 rounded-full bg-red-600 animate-pulse"></div>
            <span className="text-sky-400 font-bold uppercase tracking-[0.4em] text-xs md:text-sm">Global Live Pulse</span>
          </div>
          
          <div className="mb-10">
            <span className="text-[10vw] md:text-[86px] font-black leading-none tabular-nums" 
              style={{ 
                fontFamily: "'Anton', sans-serif", 
                color: COLORS.GOLD_SOLID,
                textShadow: `0 4px 0 #854d0e, 0 10px 40px rgba(0,0,0,0.9)`
              }}>
              {total.toLocaleString('en-US').replace(/,/g, '.')}
            </span>
          </div>

          <div className="w-full relative pr-12">
            <div className="flex justify-between items-end mb-3">
              <span className="text-sky-400 font-bold uppercase tracking-[0.2em] text-[10px]">Daily Progress</span>
              <span className="text-white/50 font-mono text-[10px] tabular-nums">{Math.floor(timeState.pct)}%</span>
            </div>
            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${timeState.pct}%`, background: COLORS.GOLD_SOLID }} />
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="font-mono text-xs font-bold tracking-[0.2em] text-white/80 bg-black/60 px-3 py-1 rounded border border-white/10 backdrop-blur-sm">
                UTC {timeState.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Screen Overlays */}
      <div className="absolute inset-0 pointer-events-none z-10 bg-gradient-to-r from-black/60 via-transparent to-transparent" />
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-black/50 to-transparent z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-full h-48 bg-gradient-to-t from-black/50 to-transparent z-10 pointer-events-none" />
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<GlobalApp />);
}
