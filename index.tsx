
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';

// --- Configuration ---
const BIRTHS_PER_SECOND = 4.352;
const AUTO_ROTATION_SPEED = 50.0; 
const INITIAL_PHI = -15;

/** 
 * TV PERFORMANCE CALIBRATION:
 * We force a max internal resolution of 1080p.
 */
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;

const COLORS = {
  LAND: '#718eb5', // Brightened land for better visibility
  LAND_BORDER: 'rgba(255, 255, 255, 0.18)',
  OCEAN_DEEP: '#020617',
  OCEAN_BRIGHT: '#111e36', // Slightly brighter ocean
  YELLOW_SOLID: '#facc15',
  ATMOSPHERE: 'rgba(56, 189, 248, 0.15)',
  HEADER_BLUE: '#60a5fa',
  PACIFIER_GLOW: 'rgba(165, 243, 252, 0.4)',
  GRATICULE: 'rgba(148, 163, 184, 0.08)', 
};

const getGlobePosition = (w: number, h: number) => {
  const minDim = Math.min(w, h);
  const radius = minDim * 0.35; // Increased radius for better visibility
  const cx = w > 768 ? w * 0.65 : w / 2; // Shifted slightly right to avoid text overlap
  const cy = w > 768 ? h * 0.50 : h / 2; // Centered vertically more
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
}

const GlobalApp: React.FC = () => {
  const [total, setTotal] = useState<number>(0);
  const [timeState, setTimeState] = useState({ label: "00:00", pct: 0 });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cometSpriteRef = useRef<HTMLCanvasElement | null>(null);
  const geoDataRef = useRef<any>(null);
  const featuresMapRef = useRef<Map<string, any>>(new Map());
  const activeFlashes = useRef<Map<string, number>>(new Map());
  const comets = useRef<Comet[]>([]);
  const countRef = useRef(0);
  const dimensionsRef = useRef({ w: 0, h: 0 });
  
  const projectionRef = useRef<d3.GeoProjection>(d3.geoOrthographic().clipAngle(90));

  // Initialize GeoData
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

  // Pre-render Sprites for Performance
  useEffect(() => {
    const cSprite = document.createElement('canvas');
    const size = 32;
    cSprite.width = size * 2;
    cSprite.height = size * 2;
    const sCtx = cSprite.getContext('2d');
    if (sCtx) {
      sCtx.translate(size, size);
      const sw = size * 0.8;
      const sh = size * 0.6;
      sCtx.beginPath();
      sCtx.moveTo(-sw * 0.5, -sh * 0.2);
      sCtx.bezierCurveTo(-sw * 0.8, -sh * 0.8, sw * 0.8, -sh * 0.8, sw * 0.5, -sh * 0.2);
      sCtx.bezierCurveTo(sw * 1.2, sh * 0.2, sw * 0.9, sh * 1.0, 0, sh * 0.7);
      sCtx.bezierCurveTo(-sw * 0.9, sh * 1.0, -sw * 1.2, sh * 0.2, -sw * 0.5, -sh * 0.2);
      sCtx.fillStyle = '#67e8f9';
      sCtx.fill();
      sCtx.beginPath();
      sCtx.ellipse(0, 0, size * 0.2, size * 0.18, 0, 0, Math.PI * 2);
      sCtx.fillStyle = '#ffffff';
      sCtx.fill();
    }
    cometSpriteRef.current = cSprite;
  }, []);

  // Handle Resize and Resolution Capping
  useEffect(() => {
    const handleResize = () => {
      let w = window.innerWidth;
      let h = window.innerHeight;
      
      if (w > MAX_WIDTH) {
        h = (MAX_WIDTH / w) * h;
        w = MAX_WIDTH;
      }
      if (h > MAX_HEIGHT) {
        w = (MAX_HEIGHT / h) * w;
        h = MAX_HEIGHT;
      }

      dimensionsRef.current = { w, h };
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.imageSmoothingEnabled = true;
      }

      const { cx, cy, radius } = getGlobePosition(w, h);
      projectionRef.current.scale(radius).translate([cx, cy]);

      const sCanvas = document.createElement('canvas');
      sCanvas.width = w;
      sCanvas.height = h;
      const sCtx = sCanvas.getContext('2d');
      if (sCtx) {
        sCtx.fillStyle = '#010208';
        sCtx.fillRect(0, 0, w, h);
        for (let i = 0; i < 300; i++) {
          sCtx.fillStyle = `rgba(255, 255, 255, ${0.1 + Math.random() * 0.3})`;
          sCtx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
        }
      }
      starsCanvasRef.current = sCanvas;
    };

    window.addEventListener('resize', handleResize);
    handleResize(); 
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Time & Counter Logic
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

  // Main Render Loop
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
      vx: (Math.random() - 0.5) * 120, 
      vy: (Math.random() - 0.5) * 120,
      rot: Math.random() * Math.PI * 2,
      rv: (Math.random() - 0.5) * 0.05,
      size: 15 + Math.random() * 15,
      alpha: 0
    });

    const render = (time: number) => {
      const { w, h } = dimensionsRef.current;
      const { cx, cy, radius } = getGlobePosition(w, h);

      // Background
      if (starsCanvasRef.current) {
        ctx.drawImage(starsCanvasRef.current, 0, 0);
      } else {
        ctx.fillStyle = '#010208';
        ctx.fillRect(0, 0, w, h);
      }

      const delta = 0.016; 
      if (comets.current.length < 10) comets.current.push(createComet(w, h));
      
      if (cometSpriteRef.current) {
        comets.current.forEach((c, idx) => {
          c.x += c.vx * delta;
          c.y += c.vy * delta;
          c.rot += c.rv;
          c.alpha = Math.min(c.alpha + 0.02, 0.6);
          if (c.x < -100 || c.x > w + 100 || c.y < -100 || c.y > h + 100) {
            comets.current[idx] = createComet(w, h);
            return;
          }
          ctx.save();
          ctx.globalAlpha = c.alpha;
          ctx.translate(c.x, c.y);
          ctx.rotate(c.rot);
          const drawSize = c.size;
          ctx.drawImage(cometSpriteRef.current, -drawSize, -drawSize, drawSize * 2, drawSize * 2);
          ctx.restore();
        });
      }

      if (geoDataRef.current) {
        const rotation = (time * 0.001 * AUTO_ROTATION_SPEED) % 360;
        projection.rotate([rotation, INITIAL_PHI, 0]);

        // Subtle Back Glow
        ctx.save();
        const backGlow = ctx.createRadialGradient(cx, cy, radius * 0.8, cx, cy, radius * 1.3);
        backGlow.addColorStop(0, 'rgba(56, 189, 248, 0.1)');
        backGlow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = backGlow;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Ocean
        const og = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx, cy, radius);
        og.addColorStop(0, COLORS.OCEAN_BRIGHT);
        og.addColorStop(1, COLORS.OCEAN_DEEP);
        ctx.fillStyle = og;
        ctx.beginPath(); 
        ctx.arc(cx, cy, radius, 0, Math.PI * 2); 
        ctx.fill();

        // Graticule
        ctx.beginPath();
        path(graticule);
        ctx.strokeStyle = COLORS.GRATICULE;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Land
        ctx.beginPath();
        path(geoDataRef.current);
        ctx.fillStyle = COLORS.LAND;
        ctx.fill();

        // Atmosphere Glow
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.beginPath();
        const atmo = ctx.createRadialGradient(cx, cy, radius, cx, cy, radius * 1.05);
        atmo.addColorStop(0, COLORS.ATMOSPHERE);
        atmo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = atmo;
        ctx.arc(cx, cy, radius * 1.05, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Borders
        ctx.beginPath();
        path(geoDataRef.current);
        ctx.strokeStyle = COLORS.LAND_BORDER;
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Country Flashes
        const timeNow = Date.now();
        activeFlashes.current.forEach((flashTime, id) => {
          const feature = featuresMapRef.current.get(id);
          if (feature) {
            const t = Math.min((timeNow - flashTime) / 1000, 1);
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
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 z-0 w-full h-full object-contain" 
        style={{ opacity: 0.98, imageRendering: 'auto' }} 
      />

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
      <div className="absolute inset-y-0 left-0 z-40 flex flex-col justify-center pl-10 md:pl-20 pointer-events-none w-full max-w-[950px]">
        <div className="flex flex-col items-start w-full">
          <div className="mb-2">
            <span className="font-bold uppercase tracking-[0.45em] text-[0.6rem] md:text-[0.8rem] opacity-70" style={{ color: COLORS.HEADER_BLUE }}>Global birth count today</span>
          </div>
          
          <div className="mb-2 relative">
            <span className="text-[7.2vw] md:text-[110px] font-normal leading-none tabular-nums bg-clip-text text-transparent bg-gradient-to-b from-[#fef9c3] via-[#facc15] to-[#854d0e] tracking-[0.05em]" 
              style={{ 
                fontFamily: "'Bebas Neue', cursive",
                filter: `drop-shadow(0 0 10px rgba(250, 204, 21, 0.1))`
              }}>
              {renderFormattedTotal(total)}
            </span>
          </div>

          {/* Progress Bar moved directly below numbers */}
          <div className="w-[50%] md:w-[45%] relative mt-4">
            <div className="flex justify-between items-end mb-2 relative h-5">
              <span className="text-yellow-400 font-bold uppercase tracking-[0.45em] text-[0.5rem] md:text-[0.7rem] opacity-60">Daily Progress</span>
              <span className="text-yellow-200/40 font-mono text-[10px] md:text-[14px] tabular-nums font-black tracking-widest">{Math.floor(timeState.pct)}%</span>
            </div>

            <div className="h-[6px] w-full bg-yellow-950/20 rounded-full overflow-hidden ring-1 ring-yellow-500/10 relative backdrop-blur-sm">
              <div 
                className="h-full rounded-full transition-all duration-1000 ease-linear relative overflow-hidden"
                style={{ 
                    width: `${timeState.pct}%`, 
                    background: `linear-gradient(90deg, #ca8a04 0%, #facc15 50%, #fef9c3 100%)`
                }} 
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent w-[30%] skew-x-[-35deg]" style={{ animation: 'shimmer 4s infinite linear' }} />
              </div>
            </div>

            <div 
              className="absolute top-6 transition-all duration-1000 ease-linear z-50"
              style={{ left: `${timeState.pct}%`, transform: 'translateX(-50%)' }}
            >
              <div className="flex flex-col items-center">
                <div className="w-[1.5px] h-6 bg-gradient-to-b from-yellow-400 to-transparent mb-1.5 opacity-30"></div>
                <div className="px-3 py-1 bg-black/90 backdrop-blur-xl border border-yellow-500/10 rounded shadow-xl">
                    <span className="font-mono text-[0.7rem] md:text-[0.9rem] font-bold tracking-[0.2em] text-yellow-50 tabular-nums">
                    {timeState.label}
                    </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Soft Overlays - Lightened to improve globe visibility */}
      <div className="absolute inset-0 pointer-events-none z-10 bg-gradient-to-r from-black/60 via-black/5 to-transparent" />
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-black/50 to-transparent z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-full h-48 bg-gradient-to-t from-black/50 to-transparent z-10 pointer-events-none" />

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
