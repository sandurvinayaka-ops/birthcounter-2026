
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
  TEAT_SILICONE: 'rgba(255, 255, 255, 0.4)',
};

/**
 * TV-Optimized Dashboard Layout: Globe shifted right
 */
const getGlobePosition = (w: number, h: number) => {
  const minDim = Math.min(w, h);
  const radius = minDim * 0.42;
  // Shift globe to the right (approx 65% of width)
  const cx = w > 768 ? w * 0.65 : w / 2;
  const cy = h / 2;
  return { cx, cy, radius };
};

interface Comet {
  type: 'pacifier' | 'teat';
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
      type: Math.random() > 0.5 ? 'pacifier' : 'teat',
      x: Math.random() * w,
      y: Math.random() * h,
      z: 0.6 + Math.random() * 0.4,
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5,
      rot: Math.random() * Math.PI * 2,
      rv: (Math.random() - 0.5) * 0.02,
      size: 15 + Math.random() * 10,
      alpha: 0,
      history: []
    });

    const drawPhilipsPacifier = (ctx: CanvasRenderingContext2D, size: number) => {
      // Shield (Butterfly shape)
      ctx.beginPath();
      ctx.moveTo(-size, -size * 0.4);
      ctx.bezierCurveTo(-size * 1.2, -size, -size * 0.2, -size * 0.8, 0, -size * 0.4);
      ctx.bezierCurveTo(size * 0.2, -size * 0.8, size * 1.2, -size, size, -size * 0.4);
      ctx.bezierCurveTo(size * 1.5, 0, size * 1.2, size, 0, size * 0.6);
      ctx.bezierCurveTo(-size * 1.2, size, -size * 1.5, 0, -size, -size * 0.4);
      ctx.fillStyle = COLORS.PACIFIER_SHIELD;
      ctx.fill();
      
      // Teat (Silicone tip)
      ctx.beginPath();
      ctx.ellipse(0, -size * 0.6, size * 0.4, size * 0.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.TEAT_SILICONE;
      ctx.fill();

      // Handle (Ring)
      ctx.beginPath();
      ctx.arc(0, size * 0.2, size * 0.4, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.PACIFIER_HANDLE;
      ctx.lineWidth = size * 0.15;
      ctx.stroke();
    };

    const drawPhilipsTeat = (ctx: CanvasRenderingContext2D, size: number) => {
      // Base
      ctx.beginPath();
      ctx.arc(0, size * 0.5, size * 0.8, Math.PI, 0);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fill();

      // Teat Bulb
      ctx.beginPath();
      ctx.moveTo(-size * 0.4, size * 0.5);
      ctx.bezierCurveTo(-size * 0.4, -size * 0.2, -size * 0.8, -size * 0.8, 0, -size * 1.2);
      ctx.bezierCurveTo(size * 0.8, -size * 0.8, size * 0.4, -size * 0.2, size * 0.4, size * 0.5);
      ctx.fillStyle = COLORS.TEAT_SILICONE;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
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

      // Background
      ctx.fillStyle = '#010206';
      ctx.fillRect(0, 0, w, h);

      // Stars (Simple static twinkling effect using time)
      const starSeed = 42;
      for (let i = 0; i < 150; i++) {
        const sx = (Math.sin(i * 123.45) * 0.5 + 0.5) * w;
        const sy = (Math.cos(i * 456.78) * 0.5 + 0.5) * h;
        const size = (Math.sin(i + time * 0.001) * 0.5 + 0.5) * 1.2;
        ctx.fillStyle = `rgba(255,255,255,${0.3 + size * 0.5})`;
        ctx.fillRect(sx, sy, size, size);
      }

      if (comets.current.length < 10) comets.current.push(createComet(w, h));
      comets.current.forEach((c, idx) => {
        c.x += c.vx; c.y += c.vy; c.rot += c.rv;
        c.alpha = Math.min(c.alpha + 0.01, 0.4);
        
        c.history.unshift({x: c.x, y: c.y});
        if (c.history.length > 8) c.history.pop();

        if (c.x < -200 || c.x > w + 200 || c.y < -200 || c.y > h + 200) {
          comets.current[idx] = createComet(w, h);
          return;
        }

        // Draw Trail
        if (c.history.length > 1) {
          ctx.beginPath();
          ctx.moveTo(c.history[0].x, c.history[0].y);
          for (let p = 1; p < c.history.length; p++) {
            ctx.lineTo(c.history[p].x, c.history[p].y);
          }
          ctx.strokeStyle = c.type === 'pacifier' ? `rgba(0,155,155,${c.alpha * 0.3})` : `rgba(255,255,255,${c.alpha * 0.2})`;
          ctx.lineWidth = c.size * 0.4;
          ctx.lineCap = 'round';
          ctx.stroke();
        }

        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);
        ctx.globalAlpha = c.alpha;
        if (c.type === 'pacifier') drawPhilipsPacifier(ctx, c.size * 0.5);
        else drawPhilipsTeat(ctx, c.size * 0.5);
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

      // Ocean with depth gradient
      const ocean = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx, cy, radius);
      ocean.addColorStop(0, COLORS.OCEAN_BRIGHT);
      ocean.addColorStop(1, COLORS.OCEAN_DEEP);
      ctx.fillStyle = ocean;
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();

      // Landmasses
      ctx.beginPath();
      path(geoDataRef.current);
      ctx.fillStyle = COLORS.LAND;
      ctx.fill();

      // Atmosphere glow
      const atmosphere = ctx.createRadialGradient(cx, cy, radius, cx, cy, radius * 1.08);
      atmosphere.addColorStop(0, COLORS.ATMOSPHERE);
      atmosphere.addColorStop(1, 'transparent');
      ctx.fillStyle = atmosphere;
      ctx.beginPath(); ctx.arc(cx, cy, radius * 1.08, 0, Math.PI * 2); ctx.fill();

      // Country Flashes
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

      // Subtle border for high-res look
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
          <div className="w-full h-[2px] bg-sky-500 mt-1 opacity-70 shadow-[0_0_8px_rgba(14,165,233,0.5)]"></div>
        </div>
      </div>

      {/* Stats Dashboard - Left Aligned */}
      <div className="absolute inset-y-0 left-0 z-40 flex flex-col justify-center pl-12 md:pl-20 pointer-events-none w-full max-w-[600px]">
        <div className="flex flex-col items-start">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sky-400 font-bold uppercase tracking-[0.4em] text-xs md:text-sm drop-shadow-md">Global birth count today</span>
          </div>
          
          <div className="mb-10">
            <span className="text-[10vw] md:text-[92px] font-black leading-none tabular-nums" 
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
            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden shadow-inner">
              <div className="h-full rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${timeState.pct}%`, background: COLORS.GOLD_SOLID }} />
            </div>
            {/* Time positioned directly under progress bar */}
            <div className="mt-4 flex flex-col items-start gap-1">
              <span className="text-[10px] text-sky-400/60 uppercase font-bold tracking-widest">Current Time</span>
              <span className="font-mono text-xl font-black tracking-[0.1em] text-white tabular-nums">
                {timeState.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Overlays for Cinematic Feel */}
      <div className="absolute inset-0 pointer-events-none z-10 bg-gradient-to-r from-black/80 via-transparent to-transparent" />
      <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-black/60 to-transparent z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-full h-60 bg-gradient-to-t from-black/60 to-transparent z-10 pointer-events-none" />
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<GlobalApp />);
}
