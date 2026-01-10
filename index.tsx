
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

const GlobalApp: React.FC = () => {
  const [total, setTotal] = useState<number>(0);
  const [timeState, setTimeState] = useState({ label: "00:00", pct: 0 });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const geoDataRef = useRef<any>(null);
  const startTimeRef = useRef<number>(performance.now());
  const activeFlashes = useRef<Map<string, number>>(new Map());
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
            <span className="text-[7vw] md:text-[76px] font-black leading-none tabular-nums" 
              style={{ 
                fontFamily: "'Anton', sans-serif", 
                color: COLORS.GOLD_SOLID,
                textShadow: `0 3px 0 #854d0e, 0 8px 30px rgba(0,0,0,0.9)`
              }}>
              {total.toLocaleString('en-US').replace(/,/g, '.')}
            </span>
          </div>

          {/* Progress Section - Reduced width by 60% (from 60% to 24%) */}
          <div className="w-[24%] relative">
            <div className="flex justify-between items-end mb-1 relative h-3">
              <span className="text-sky-400 font-bold uppercase tracking-[0.2em] text-[5.5px] opacity-60">Daily Progress</span>
              <span className="text-white/30 font-mono text-[5.5px] tabular-nums">{Math.floor(timeState.pct)}%</span>
            </div>

            <div className="h-0.5 w-full bg-white/10 rounded-full overflow-hidden shadow-inner ring-1 ring-white/5">
              <div className="h-full rounded-full transition-all duration-1000 ease-linear shadow-[0_0_6px_rgba(250,204,21,0.5)]"
                style={{ width: `${timeState.pct}%`, background: COLORS.GOLD_SOLID }} />
            </div>

            {/* Time Floating Indicator */}
            <div 
              className="absolute top-2 transition-all duration-1000 ease-linear"
              style={{ left: `${timeState.pct}%`, transform: 'translateX(-50%)' }}
            >
              <div className="flex flex-col items-center">
                <div className="w-[0.5px] h-3 bg-white/40 mb-0.5"></div>
                <span className="font-mono text-[0.85rem] font-black tracking-[0.05em] text-white tabular-nums drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">
                  {timeState.label}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cinematic Overlays */}
      <div className="absolute inset-0 pointer-events-none z-10 bg-gradient-to-r from-black/90 via-black/25 to-transparent" />
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-black/60 to-transparent z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-full h-48 bg-gradient-to-t from-black/60 to-transparent z-10 pointer-events-none" />
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<GlobalApp />);
}
