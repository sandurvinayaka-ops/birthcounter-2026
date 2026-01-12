
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';

// --- Configuration ---
const BIRTHS_PER_SECOND = 4.352;
const AUTO_ROTATION_SPEED = 60.0; // Faster, purposeful rotation for cinematic feel
const INITIAL_PHI = -15;

/** 
 * TV OPTIMIZATION: 
 * Most TV browsers struggle with high-resolution canvases (4K).
 * We limit DPR to 1.0 on large displays to ensure 60FPS stability.
 */
const getDPR = () => {
  const baseDPR = window.devicePixelRatio || 1.0;
  return window.innerWidth > 1280 ? 1.0 : Math.min(baseDPR, 1.5);
};

const COLORS = {
  LAND: '#546a8c', 
  LAND_BORDER: 'rgba(255, 255, 255, 0.15)',
  OCEAN_DEEP: '#020617',
  OCEAN_BRIGHT: '#0f172a',
  YELLOW_SOLID: '#facc15',
  ATMOSPHERE: 'rgba(56, 189, 248, 0.12)',
  HEADER_BLUE: '#60a5fa',
  PACIFIER_GLOW: 'rgba(165, 243, 252, 0.6)',
  GRATICULE: 'rgba(148, 163, 184, 0.08)', 
};

const getGlobePosition = (w: number, h: number) => {
  const minDim = Math.min(w, h);
  const radius = minDim * 0.32; 
  const cx = w > 768 ? w * 0.62 : w / 2;
  const cy = w > 768 ? h * 0.38 : h / 2;
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
  const featuresMapRef = useRef<Map<string, any>>(new Map());
  const activeFlashes = useRef<Map<string, number>>(new Map());
  const comets = useRef<Comet[]>([]);
  const countRef = useRef(0);
  const dimensionsRef = useRef({ w: 0, h: 0 });
  const dprRef = useRef(1);
  
  const projectionRef = useRef<d3.GeoProjection>(d3.geoOrthographic().clipAngle(90));

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson')
      .then(res => res.json())
      .then(data => {
        if (data && data.features) {
          const map = new Map();
          data.features.forEach((f: any) => { 
            f.centroid = d3.geoCentroid(f);
            const id = f.id || f.properties.name || f.properties.ISO_A3;
            map.set(id, f);
          });
          featuresMapRef.current = map;
          geoDataRef.current = data;
        }
      })
      .catch(err => console.error("GeoJSON load failed", err));
  }, []);

  useEffect(() => {
    const updateProgress = () => {
      const d = new Date();
      const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const elapsed = (d.getTime() - midnight) / 1000;
      const pct = (elapsed / 86400) * 100;
      
      const currentBirths = Math.floor(elapsed * BIRTHS_PER_SECOND);
      countRef.current = currentBirths;
      setTotal(currentBirths);
      
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
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = getDPR();
      dprRef.current = dpr;
      dimensionsRef.current = { w, h };
      
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);
            ctx.imageSmoothingEnabled = true;
        }
      }

      const { cx, cy, radius } = getGlobePosition(w, h);
      projectionRef.current.scale(radius).translate([cx, cy]);

      const sCanvas = document.createElement('canvas');
      sCanvas.width = w * dpr;
      sCanvas.height = h * dpr;
      const sCtx = sCanvas.getContext('2d');
      if (sCtx) {
        sCtx.scale(dpr, dpr);
        sCtx.fillStyle = '#010208';
        sCtx.fillRect(0, 0, w, h);
        
        for (let i = 0; i < 400; i++) {
          const sx = Math.random() * w;
          const sy = Math.random() * h;
          const sz = Math.random() > 0.9 ? 1.5 : 0.8;
          const op = 0.3 + Math.random() * 0.4;
          sCtx.fillStyle = `rgba(255, 255, 255, ${op})`;
          sCtx.fillRect(sx, sy, sz, sz);
        }
      }
      starsCanvasRef.current = sCanvas;
    };

    window.addEventListener('resize', handleResize);
    handleResize(); 
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animId: number;
    const graticule = d3.geoGraticule10();
    const projection = projectionRef.current;
    const path = d3.geoPath(projection, ctx);

    const createComet = (w: number, h: number): Comet => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 180, 
      vy: (Math.random() - 0.5) * 180,
      rot: Math.random() * Math.PI * 2,
      rv: (Math.random() - 0.5) * 0.4,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.8 + Math.random() * 1.2,
      size: 4 + Math.random() * 4,
      alpha: 0
    });

    const drawGlowingPacifier = (ctx: CanvasRenderingContext2D, comet: Comet) => {
      const { size, alpha } = comet;
      ctx.save();
      ctx.globalAlpha = alpha;
      const sw = size * 1.3;
      const sh = size * 0.9;
      ctx.beginPath();
      ctx.moveTo(-sw * 0.5, -sh * 0.2);
      ctx.bezierCurveTo(-sw * 0.8, -sh * 0.8, sw * 0.8, -sh * 0.8, sw * 0.5, -sh * 0.2);
      ctx.bezierCurveTo(sw * 1.2, sh * 0.2, sw * 0.9, sh * 1.0, 0, sh * 0.7);
      ctx.bezierCurveTo(-sw * 0.9, sh * 1.0, -sw * 1.2, sh * 0.2, -sw * 0.5, -sh * 0.2);
      ctx.fillStyle = '#67e8f9';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.35, size * 0.3, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();
    };

    const render = (time: number) => {
      const { w, h } = dimensionsRef.current;
      const { cx, cy, radius } = getGlobePosition(w, h);

      // Background
      if (starsCanvasRef.current) {
        ctx.drawImage(starsCanvasRef.current, 0, 0, w, h);
      } else {
        ctx.fillStyle = '#010208';
        ctx.fillRect(0, 0, w, h);
      }

      // Physics (approximate delta for low CPU consumption)
      const safeDelta = 0.016; 
      if (comets.current.length < 8) comets.current.push(createComet(w, h));
      comets.current.forEach((c, idx) => {
        c.x += c.vx * safeDelta;
        c.y += c.vy * safeDelta;
        c.rot += c.rv * safeDelta;
        c.alpha = Math.min(c.alpha + 0.4 * safeDelta, 0.7);
        if (c.x < -100 || c.x > w + 100 || c.y < -100 || c.y > h + 100) {
          comets.current[idx] = createComet(w, h);
          return;
        }
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);
        drawGlowingPacifier(ctx, c);
        ctx.restore();
      });

      if (geoDataRef.current) {
        /**
         * DETERMINISTIC ROTATION:
         * We use the global `time` parameter directly.
         * This ensures that even if a frame is dropped, the globe is at the exact correct position
         * for the current moment, eliminating "stepping" or accumulative jerks.
         */
        const rotation = (time * 0.001 * AUTO_ROTATION_SPEED) % 360;
        projection.rotate([rotation, INITIAL_PHI, 0]);

        // Ocean
        const og = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx, cy, radius);
        og.addColorStop(0, COLORS.OCEAN_BRIGHT);
        og.addColorStop(1, COLORS.OCEAN_DEEP);
        ctx.fillStyle = og;
        ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();

        // Graticule
        ctx.beginPath();
        path(graticule);
        ctx.strokeStyle = COLORS.GRATICULE;
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Land
        ctx.beginPath();
        path(geoDataRef.current);
        ctx.fillStyle = COLORS.LAND;
        ctx.fill();

        // Atmospheric Edge
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.beginPath();
        const atmo = ctx.createRadialGradient(cx, cy, radius, cx, cy, radius * 1.06);
        atmo.addColorStop(0, COLORS.ATMOSPHERE);
        atmo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = atmo;
        ctx.arc(cx, cy, radius * 1.06, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Land Detail
        ctx.beginPath();
        path(geoDataRef.current);
        ctx.strokeStyle = COLORS.LAND_BORDER;
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Flashes
        const timeNow = Date.now();
        activeFlashes.current.forEach((flashTime, id) => {
          const feature = featuresMapRef.current.get(id);
          if (feature) {
            const t = Math.min((timeNow - flashTime) / 1200, 1);
            if (t >= 1) {
              activeFlashes.current.delete(id);
            } else {
              const distance = d3.geoDistance(feature.centroid, [-rotation, -INITIAL_PHI]);
              if (distance < 1.57) {
                ctx.beginPath();
                path(feature);
                ctx.fillStyle = d3.interpolateRgb(COLORS.YELLOW_SOLID, COLORS.LAND)(t);
                ctx.fill();
              }
            }
          }
        });
      }

      animId = requestAnimationFrame(render);
    };
    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  const renderFormattedTotal = (val: number) => {
    const str = val.toLocaleString('en-US').replace(/,/g, '.');
    return str.split('').map((char, i) => {
      if (char === '.') {
        return <span key={i} className="font-sans align-baseline inline-block px-[1px]" style={{ verticalAlign: 'baseline' }}>.</span>;
      }
      return char;
    });
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-black flex flex-col font-sans select-none">
      <canvas ref={canvasRef} className="absolute inset-0 z-0" style={{ opacity: 0.98 }} />

      {/* Brand */}
      <div className="absolute top-10 left-10 md:top-14 md:left-20 z-40 pointer-events-none">
        <div className="flex flex-col items-start w-fit">
          <div className="flex items-baseline font-black tracking-tighter text-[0.8rem] md:text-[2.2rem] leading-none">
            <span className="text-white">M</span>
            <span className="text-white">&</span>
            <span className="text-white">CC</span>
          </div>
          <div className="w-full h-[1.5px] bg-yellow-500 mt-1 opacity-60 shadow-[0_0_10px_rgba(250,204,21,0.5)]"></div>
        </div>
      </div>

      {/* Primary Data HUD */}
      <div className="absolute inset-y-0 left-0 z-40 flex flex-col justify-center pl-10 md:pl-20 pointer-events-none w-full max-w-[900px]">
        <div className="flex flex-col items-start w-full">
          <div className="mb-4">
            <span className="font-bold uppercase tracking-[0.45em] text-[0.6rem] md:text-[0.8rem] opacity-70" style={{ color: COLORS.HEADER_BLUE }}>Global birth count today</span>
          </div>
          
          <div className="mb-5 relative">
            <span className="text-[7.2vw] md:text-[100px] font-normal leading-none tabular-nums bg-clip-text text-transparent bg-gradient-to-b from-[#fef9c3] via-[#facc15] to-[#854d0e] tracking-[0.05em]" 
              style={{ 
                fontFamily: "'Bebas Neue', cursive",
                filter: `drop-shadow(0 0 20px rgba(250, 204, 21, 0.1))`
              }}>
              {renderFormattedTotal(total)}
            </span>
          </div>

          <div className="w-[45%] md:w-[42%] relative mt-12">
            <div className="flex justify-between items-end mb-4 relative h-6">
              <span className="text-yellow-400 font-bold uppercase tracking-[0.45em] text-[0.5rem] md:text-[0.7rem] opacity-60">Daily Progress</span>
              <span className="text-yellow-200/40 font-mono text-[10px] md:text-[14px] tabular-nums font-black tracking-widest">{Math.floor(timeState.pct)}%</span>
            </div>

            <div className="h-[8px] w-full bg-yellow-950/20 rounded-full overflow-hidden ring-1 ring-yellow-500/10 relative backdrop-blur-sm">
              <div 
                className="h-full rounded-full transition-all duration-1000 ease-linear relative overflow-hidden"
                style={{ 
                    width: `${timeState.pct}%`, 
                    background: `linear-gradient(90deg, #ca8a04 0%, #facc15 50%, #fef9c3 100%)`
                }} 
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent w-[30%] skew-x-[-35deg]" style={{ animation: 'shimmer 4.5s infinite ease-in-out' }} />
              </div>
            </div>

            <div 
              className="absolute top-6 transition-all duration-1000 ease-linear z-50"
              style={{ left: `${timeState.pct}%`, transform: 'translateX(-50%)' }}
            >
              <div className="flex flex-col items-center">
                <div className="w-[1.5px] h-8 bg-gradient-to-b from-yellow-400 to-transparent mb-1.5 opacity-30"></div>
                <div className="px-3 py-1 bg-black/90 backdrop-blur-xl border border-yellow-500/20 rounded shadow-2xl">
                    <span className="font-mono text-[0.7rem] md:text-[0.9rem] font-bold tracking-[0.2em] text-yellow-50 tabular-nums">
                    {timeState.label}
                    </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none z-10 bg-gradient-to-r from-black/80 via-black/10 to-transparent" />
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
