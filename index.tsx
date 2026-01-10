
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';

// --- Configuration ---
const BIRTHS_PER_SECOND = 4.352;
const AUTO_ROTATION_SPEED = 0.015; 
const INITIAL_PHI = -15;
const MAX_DPR = 1.0; 

const COLORS = {
  LAND: '#3d4f66', 
  OCEAN_DEEP: '#050c1f',
  OCEAN_BRIGHT: '#142a66',
  GOLD_SOLID: '#facc15',
  ATMOSPHERE: 'rgba(56, 189, 248, 0.15)',
  PACIFIER_SHIELD: '#c0dbd5', // Light mint/teal
  PACIFIER_CENTER: '#e9f5f1', // Off-white/mint
  PACIFIER_HANDLE: 'rgba(192, 219, 213, 0.8)', // Boosted handle visibility
};

/**
 * TV-Optimized Dashboard Layout: Globe shifted right
 */
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
      vx: (Math.random() - 0.5) * 3.5, 
      vy: (Math.random() - 0.5) * 3.5,
      rot: Math.random() * Math.PI * 2,
      rv: (Math.random() - 0.5) * 0.04,
      size: 15 + Math.random() * 12, // Reduced size to 30% of previous (was 50-90)
      alpha: 0,
      history: []
    });

    const drawPhilipsPacifier = (ctx: CanvasRenderingContext2D, size: number, alpha: number) => {
      ctx.save();
      ctx.globalAlpha = alpha;

      // Shield shape
      ctx.beginPath();
      const sw = size * 1.3;
      const sh = size * 0.9;
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

      // High contrast outline
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Ventilation holes
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.arc(-sw * 0.4, 0, size * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sw * 0.4, 0, size * 0.18, 0, Math.PI * 2);
      ctx.fill();

      // Center button
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.48, size * 0.4, 0, 0, Math.PI * 2);
      const buttonGrad = ctx.createRadialGradient(0, -size * 0.1, 0, 0, 0, size * 0.48);
      buttonGrad.addColorStop(0, '#ffffff');
      buttonGrad.addColorStop(1, '#d5e9e4');
      ctx.fillStyle = buttonGrad;
      ctx.fill();

      // Star icon
      ctx.beginPath();
      ctx.fillStyle = '#4a90ff';
      const rOuter = size * 0.2;
      const rInner = size * 0.09;
      for (let i = 0; i < 5; i++) {
        const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
        ctx.lineTo(Math.cos(angle) * rOuter, Math.sin(angle) * rOuter);
        const innerAngle = angle + (Math.PI * 2) / 10;
        ctx.lineTo(Math.cos(innerAngle) * rInner, Math.sin(innerAngle) * rInner);
      }
      ctx.closePath();
      ctx.fill();

      // Handle
      ctx.beginPath();
      ctx.arc(0, size * 0.25, size * 0.6, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.strokeStyle = COLORS.PACIFIER_HANDLE;
      ctx.lineWidth = size * 0.18;
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.restore();
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

      ctx.fillStyle = '#010208';
      ctx.fillRect(0, 0, w, h);

      // Deep Space Starfield
      for (let i = 0; i < 280; i++) {
        const sx = (Math.sin(i * 123.45) * 0.5 + 0.5) * w;
        const sy = (Math.cos(i * 456.78) * 0.5 + 0.5) * h;
        const brightness = (Math.sin(i + time * 0.0013) * 0.5 + 0.5);
        const baseAlpha = 0.35 + brightness * 0.65;
        
        if (i % 6 === 0) {
          const auraSize = 7 + (i % 9);
          const ag = ctx.createRadialGradient(sx, sy, 0, sx, sy, auraSize);
          ag.addColorStop(0, `rgba(255, 255, 255, ${baseAlpha * 0.3})`);
          ag.addColorStop(1, 'transparent');
          ctx.fillStyle = ag;
          ctx.beginPath(); ctx.arc(sx, sy, auraSize, 0, Math.PI * 2); ctx.fill();
        }

        ctx.fillStyle = `rgba(255, 255, 255, ${baseAlpha})`;
        const sz = i % 12 === 0 ? 3.0 : (i % 4 === 0 ? 1.8 : 1.0);
        ctx.fillRect(sx - sz/2, sy - sz/2, sz, sz);
      }

      // Comet Logic
      if (comets.current.length < 12) comets.current.push(createComet(w, h));
      comets.current.forEach((c, idx) => {
        c.x += c.vx; c.y += c.vy; c.rot += c.rv;
        c.alpha = Math.min(c.alpha + 0.012, 0.95);
        
        c.history.unshift({x: c.x, y: c.y});
        if (c.history.length > 25) c.history.pop();

        if (c.x < -500 || c.x > w + 500 || c.y < -500 || c.y > h + 500) {
          comets.current[idx] = createComet(w, h);
          return;
        }

        // Draw Glow Trail
        if (c.history.length > 1) {
          ctx.save();
          for (let p = 0; p < c.history.length - 1; p++) {
            const r = 1 - (p / c.history.length);
            ctx.beginPath();
            ctx.moveTo(c.history[p].x, c.history[p].y);
            ctx.lineTo(c.history[p+1].x, c.history[p+1].y);
            ctx.strokeStyle = `rgba(200, 240, 230, ${c.alpha * r * 0.5})`; 
            ctx.lineWidth = c.size * 0.8 * r;
            ctx.lineCap = 'round';
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(c.history[p].x, c.history[p].y);
            ctx.lineTo(c.history[p+1].x, c.history[p+1].y);
            ctx.strokeStyle = `rgba(255, 255, 255, ${c.alpha * r * 0.7})`; 
            ctx.lineWidth = c.size * 0.2 * r;
            ctx.stroke();
          }
          ctx.restore();
        }

        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);
        drawPhilipsPacifier(ctx, c.size * 0.7, c.alpha);
        ctx.restore();
      });

      if (!geoDataRef.current) {
        animId = requestAnimationFrame(render);
        return;
      }

      // Globe Physics
      const elapsed = time - startTimeRef.current;
      const rotX = (elapsed * AUTO_ROTATION_SPEED) % 360;
      const projection = d3.geoOrthographic()
        .scale(radius)
        .translate([cx, cy])
        .rotate([rotX, INITIAL_PHI, 0])
        .precision(2.0)
        .clipAngle(90);
      const path = d3.geoPath(projection, ctx);

      // Deep Ocean Gradient
      const og = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx, cy, radius);
      og.addColorStop(0, COLORS.OCEAN_BRIGHT);
      og.addColorStop(1, COLORS.OCEAN_DEEP);
      ctx.fillStyle = og;
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();

      // High Visibility Land & Precise Borders
      ctx.beginPath(); path(geoDataRef.current); ctx.fillStyle = COLORS.LAND; ctx.fill();
      ctx.beginPath(); path(geoDataRef.current); ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 0.8; ctx.stroke();

      // Atmospheric Halo
      const atmo = ctx.createRadialGradient(cx, cy, radius, cx, cy, radius * 1.08);
      atmo.addColorStop(0, COLORS.ATMOSPHERE);
      atmo.addColorStop(1, 'transparent');
      ctx.fillStyle = atmo;
      ctx.beginPath(); ctx.arc(cx, cy, radius * 1.08, 0, Math.PI * 2); ctx.fill();

      // High Intensity Birth Flashes
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
              ctx.strokeStyle = 'rgba(255,255,255,0.7)';
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

      {/* Brand Header */}
      <div className="absolute top-8 left-8 md:top-14 md:left-14 z-40 pointer-events-none">
        <div className="flex flex-col items-start w-fit">
          <div className="flex items-baseline font-black tracking-tighter text-[0.7rem] md:text-[2.1rem] leading-none">
            <span className="text-white">M</span>
            <span className="text-white">&</span>
            <span className="text-white">CC</span>
          </div>
          <div className="w-full h-[1.5px] bg-sky-500 mt-0.5 opacity-70 shadow-[0_0_8px_rgba(14,165,233,0.6)]"></div>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="absolute inset-y-0 left-0 z-40 flex flex-col justify-center pl-8 md:pl-14 pointer-events-none w-full max-w-[800px]">
        <div className="flex flex-col items-start w-full">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sky-400 font-bold uppercase tracking-[0.4em] text-[0.45rem] md:text-[0.6rem] drop-shadow-lg opacity-80">Global birth count today</span>
          </div>
          
          <div className="mb-2">
            <span className="text-[7vw] md:text-[88px] font-black leading-none tabular-nums" 
              style={{ 
                fontFamily: "'Anton', sans-serif", 
                color: COLORS.GOLD_SOLID,
                textShadow: `0 3px 0 #854d0e, 0 10px 40px rgba(0,0,0,0.9)`
              }}>
              {total.toLocaleString('en-US').replace(/,/g, '.')}
            </span>
          </div>

          {/* Progress Section - Precision 36% Width */}
          <div className="w-[36%] relative mt-4">
            <div className="flex justify-between items-end mb-2 relative h-6">
              <span className="text-sky-400 font-bold uppercase tracking-[0.25em] text-[10px] md:text-[12px] opacity-70">Daily Progress</span>
              <span className="text-white/40 font-mono text-[10px] md:text-[12px] tabular-nums font-black">{Math.floor(timeState.pct)}%</span>
            </div>

            <div className="h-[10px] w-full bg-white/10 rounded-full overflow-hidden shadow-inner ring-1 ring-white/10">
              <div className="h-full rounded-full transition-all duration-1000 ease-linear shadow-[0_0_15px_rgba(250,204,21,0.9)]"
                style={{ width: `${timeState.pct}%`, background: COLORS.GOLD_SOLID }} />
            </div>

            {/* Time Floating Indicator - HH:MM size reduced to 60% of 1.5rem = 0.9rem */}
            <div 
              className="absolute top-6 transition-all duration-1000 ease-linear"
              style={{ left: `${timeState.pct}%`, transform: 'translateX(-50%)' }}
            >
              <div className="flex flex-col items-center">
                <div className="w-[2px] h-6 bg-white/50 mb-1"></div>
                <span className="font-mono text-[0.9rem] font-black tracking-[0.08em] text-white tabular-nums drop-shadow-[0_4px_8px_rgba(0,0,0,1)]">
                  {timeState.label}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cinematic Overlays */}
      <div className="absolute inset-0 pointer-events-none z-10 bg-gradient-to-r from-black/95 via-black/20 to-transparent" />
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-black/70 to-transparent z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-full h-48 bg-gradient-to-t from-black/70 to-transparent z-10 pointer-events-none" />
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<GlobalApp />);
}
