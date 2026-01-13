
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';

// --- Configuration ---
const BIRTHS_PER_SECOND = 4.352;
const AUTO_ROTATION_SPEED = 30.0; // Fixed at 80% of original baseline for TV stability
const INITIAL_PHI = -15;

const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;
const GLOBE_RENDER_SCALE = 0.5; // 50% Res: The perfect balance of crispness and TV performance

const COLORS = {
  LAND: '#94a3b8', 
  LAND_BRIGHT: '#cbd5e1',
  OCEAN_DEEP: '#010409',
  OCEAN_BRIGHT: '#0f172a', 
  YELLOW_SOLID: '#facc15',
  ATMOSPHERE: 'rgba(56, 189, 248, 0.2)',
  SPECULAR: 'rgba(255, 255, 255, 0.08)',
  HEADER_BLUE: '#93c5fd',
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
  
  const globeCanvasRef = useRef<HTMLCanvasElement>(null);
  const fxCanvasRef = useRef<HTMLCanvasElement>(null);
  const starsCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cometSpriteRef = useRef<HTMLCanvasElement | null>(null);
  
  const geoDataRef = useRef<any>(null);
  const featuresMapRef = useRef<Map<string, any>>(new Map());
  const activeFlashes = useRef<Map<string, number>>(new Map());
  const comets = useRef<Comet[]>([]);
  const countRef = useRef(0);
  const dimensionsRef = useRef({ w: 0, h: 0 });
  
  const gradients = useRef<{ [key: string]: CanvasGradient | null }>({});
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
    const cSprite = document.createElement('canvas');
    const size = 32;
    cSprite.width = size * 2; cSprite.height = size * 2;
    const sCtx = cSprite.getContext('2d');
    if (sCtx) {
      sCtx.translate(size, size);
      const sw = size * 0.8; const sh = size * 0.6;
      sCtx.beginPath();
      sCtx.moveTo(-sw * 0.5, -sh * 0.2);
      sCtx.bezierCurveTo(-sw * 0.8, -sh * 0.8, sw * 0.8, -sh * 0.8, sw * 0.5, -sh * 0.2);
      sCtx.bezierCurveTo(sw * 1.2, sh * 0.2, sw * 0.9, sh * 1.0, 0, sh * 0.7);
      sCtx.bezierCurveTo(-sw * 0.9, sh * 1.0, -sw * 1.2, sh * 0.2, -sw * 0.5, -sh * 0.2);
      sCtx.fillStyle = '#67e8f9'; sCtx.fill();
      sCtx.beginPath();
      sCtx.ellipse(0, 0, size * 0.15, size * 0.15, 0, 0, Math.PI * 2);
      sCtx.fillStyle = '#ffffff'; sCtx.fill();
    }
    cometSpriteRef.current = cSprite;
  }, []);

  useEffect(() => {
    const handleResize = () => {
      let w = window.innerWidth;
      let h = window.innerHeight;
      if (w > MAX_WIDTH) { h = (MAX_WIDTH / w) * h; w = MAX_WIDTH; }
      if (h > MAX_HEIGHT) { w = (MAX_HEIGHT / h) * w; h = MAX_HEIGHT; }
      dimensionsRef.current = { w, h };
      
      const gCanvas = globeCanvasRef.current;
      const fCanvas = fxCanvasRef.current;
      if (gCanvas && fCanvas) {
        gCanvas.width = w * GLOBE_RENDER_SCALE; 
        gCanvas.height = h * GLOBE_RENDER_SCALE;
        fCanvas.width = w; fCanvas.height = h;
        const gCtx = gCanvas.getContext('2d', { alpha: false });
        if (gCtx) {
           gCtx.imageSmoothingEnabled = true;
           gradients.current = {};
        }
      }

      // Radius: 10% bigger than previous small size (~0.11 total viewport height)
      const minDim = Math.min(w, h);
      const radius = minDim * 0.11; 
      const cx = w > 768 ? w * 0.78 : w / 2;
      const cy = h / 2;

      projectionRef.current.scale(radius * GLOBE_RENDER_SCALE).translate([(cx * GLOBE_RENDER_SCALE), (cy * GLOBE_RENDER_SCALE)]);

      const sCanvas = document.createElement('canvas');
      sCanvas.width = w; sCanvas.height = h;
      const sCtx = sCanvas.getContext('2d');
      if (sCtx) {
        sCtx.fillStyle = '#000105';
        sCtx.fillRect(0, 0, w, h);
        for (let i = 0; i < 120; i++) {
          sCtx.fillStyle = `rgba(255, 255, 255, ${0.05 + Math.random() * 0.1})`;
          sCtx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
        }
      }
      starsCanvasRef.current = sCanvas;
    };

    window.addEventListener('resize', handleResize);
    handleResize(); 
    return () => window.removeEventListener('resize', handleResize);
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
    const gCanvas = globeCanvasRef.current;
    const fCanvas = fxCanvasRef.current;
    if (!gCanvas || !fCanvas) return;
    const gCtx = gCanvas.getContext('2d', { alpha: false });
    const fCtx = fCanvas.getContext('2d');
    if (!gCtx || !fCtx) return;

    let animId: number;
    const projection = projectionRef.current;
    const path = d3.geoPath(projection, gCtx);

    const render = (time: number) => {
      const { w, h } = dimensionsRef.current;
      const minDim = Math.min(w, h);
      const r = (minDim * 0.11) * GLOBE_RENDER_SCALE;
      const cx = (w > 768 ? w * 0.78 : w / 2) * GLOBE_RENDER_SCALE;
      const cy = (h / 2) * GLOBE_RENDER_SCALE;

      // 1. Effects layer
      fCtx.clearRect(0, 0, w, h);
      if (starsCanvasRef.current) fCtx.drawImage(starsCanvasRef.current, 0, 0);

      if (cometSpriteRef.current) {
        if (comets.current.length < 4) {
          comets.current.push({
            x: Math.random() * w, y: Math.random() * h,
            vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60,
            rot: Math.random() * Math.PI * 2, rv: (Math.random() - 0.5) * 0.02,
            size: 6 + Math.random() * 6, alpha: 0
          });
        }
        comets.current.forEach((c, idx) => {
          c.x += c.vx * 0.016; c.y += c.vy * 0.016; c.rot += c.rv;
          c.alpha = Math.min(c.alpha + 0.01, 0.2);
          if (c.x < -100 || c.x > w + 100 || c.y < -100 || c.y > h + 100) {
            comets.current.splice(idx, 1); return;
          }
          fCtx.save();
          fCtx.globalAlpha = c.alpha;
          fCtx.translate(c.x, c.y); fCtx.rotate(c.rot);
          fCtx.drawImage(cometSpriteRef.current!, -c.size, -c.size, c.size * 2, c.size * 2);
          fCtx.restore();
        });
      }

      // 2. Globe rendering (Optimized 50% Res)
      if (geoDataRef.current) {
        const rotation = (time * 0.001 * AUTO_ROTATION_SPEED) % 360;
        projection.rotate([rotation, INITIAL_PHI, 0]);

        gCtx.fillStyle = '#000105';
        gCtx.fillRect(0, 0, w * GLOBE_RENDER_SCALE, h * GLOBE_RENDER_SCALE);

        // Water Gradient with depth
        if (!gradients.current.ocean) {
          gradients.current.ocean = gCtx.createRadialGradient(cx - r * 0.4, cy - r * 0.4, 0, cx, cy, r);
          gradients.current.ocean.addColorStop(0, COLORS.OCEAN_BRIGHT);
          gradients.current.ocean.addColorStop(1, COLORS.OCEAN_DEEP);
        }
        gCtx.fillStyle = gradients.current.ocean!;
        gCtx.beginPath(); gCtx.arc(cx, cy, r, 0, Math.PI * 2); gCtx.fill();

        // Land
        gCtx.beginPath(); path(geoDataRef.current);
        gCtx.fillStyle = COLORS.LAND; gCtx.fill();

        // Country Birth Flashes
        const timeNow = Date.now();
        activeFlashes.current.forEach((flashTime, id) => {
          const feature = featuresMapRef.current.get(id);
          if (feature) {
            const t = Math.min((timeNow - flashTime) / 800, 1);
            if (t >= 1) { activeFlashes.current.delete(id); }
            else {
              const distance = d3.geoDistance(feature.centroid, [-rotation, -INITIAL_PHI]);
              if (distance < 1.57) { 
                gCtx.beginPath(); path(feature);
                gCtx.fillStyle = d3.interpolateRgb(COLORS.YELLOW_SOLID, COLORS.LAND)(t);
                gCtx.fill();
              }
            }
          }
        });

        // Gloss / Specular Lighting (Visual Depth)
        if (!gradients.current.spec) {
          gradients.current.spec = gCtx.createRadialGradient(cx - r * 0.4, cy - r * 0.4, 0, cx - r * 0.4, cy - r * 0.4, r * 1.5);
          gradients.current.spec.addColorStop(0, COLORS.SPECULAR);
          gradients.current.spec.addColorStop(1, 'rgba(0,0,0,0)');
        }
        gCtx.fillStyle = gradients.current.spec!;
        gCtx.beginPath(); gCtx.arc(cx, cy, r, 0, Math.PI * 2); gCtx.fill();

        // Atmosphere Halo
        if (!gradients.current.atmo) {
          gradients.current.atmo = gCtx.createRadialGradient(cx, cy, r, cx, cy, r * 1.12);
          gradients.current.atmo.addColorStop(0, COLORS.ATMOSPHERE);
          gradients.current.atmo.addColorStop(1, 'rgba(0,0,0,0)');
        }
        gCtx.fillStyle = gradients.current.atmo!;
        gCtx.beginPath(); gCtx.arc(cx, cy, r * 1.12, 0, Math.PI * 2); gCtx.fill();
      }
      animId = requestAnimationFrame(render);
    };
    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  const renderFormattedTotal = (val: number) => {
    const str = val.toLocaleString('en-US').replace(/,/g, '.');
    return str.split('').map((char, i) => (
      <span key={i} className={char === '.' ? "px-[1px]" : ""}>{char}</span>
    ));
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-black flex flex-col font-sans select-none">
      <canvas 
        ref={globeCanvasRef} 
        className="absolute inset-0 z-0" 
        style={{ 
          pointerEvents: 'none', 
          transform: `scale(${1 / GLOBE_RENDER_SCALE})`, 
          transformOrigin: '0 0',
          width: `${GLOBE_RENDER_SCALE * 100}%`,
          height: `${GLOBE_RENDER_SCALE * 100}%`,
        }} 
      />
      <canvas ref={fxCanvasRef} className="absolute inset-0 z-10 w-full h-full pointer-events-none mix-blend-screen" />

      {/* Brand */}
      <div className="absolute top-8 left-8 md:top-12 md:left-16 z-40 pointer-events-none opacity-40">
        <div className="flex flex-col items-start w-fit">
          <div className="flex items-baseline font-black tracking-tighter text-[0.7rem] md:text-[1.4rem] leading-none text-white">
            M&CC
          </div>
          <div className="w-full h-[1px] bg-white mt-1"></div>
        </div>
      </div>

      {/* Minimized HUD (Reduced size by 60% and tightened) */}
      <div className="absolute inset-y-0 left-0 z-40 flex flex-col justify-center pl-10 md:pl-20 pointer-events-none w-full max-w-[800px]">
        <div className="flex flex-col items-start w-full translate-y-[-5%]">
          <div className="mb-0.5">
            <span className="font-bold uppercase tracking-[0.4em] text-[0.4rem] md:text-[0.55rem] opacity-50" style={{ color: COLORS.HEADER_BLUE }}>Global birth count today</span>
          </div>
          
          <div className="mb-0 relative">
            <span className="text-[5.5vw] md:text-[76px] font-normal leading-none tabular-nums bg-clip-text text-transparent bg-gradient-to-b from-white via-yellow-200 to-yellow-500 tracking-[0.02em]" 
              style={{ fontFamily: "'Bebas Neue', cursive", filter: `drop-shadow(0 0 15px rgba(250, 204, 21, 0.15))` }}>
              {renderFormattedTotal(total)}
            </span>
          </div>

          <div className="w-[30%] md:w-[25%] relative mt-2">
            <div className="flex justify-between items-end mb-1 relative h-3">
              <span className="text-white/30 font-bold uppercase tracking-[0.4em] text-[0.35rem] md:text-[0.45rem]">Daily Progress</span>
              <span className="text-white/20 font-mono text-[8px] md:text-[10px] tabular-nums font-bold tracking-widest">{Math.floor(timeState.pct)}%</span>
            </div>

            <div className="h-[2px] w-full bg-white/5 rounded-full overflow-hidden relative">
              <div 
                className="h-full rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${timeState.pct}%`, background: `linear-gradient(90deg, #1e293b 0%, #facc15 100%)` }} 
              />
            </div>

            <div 
              className="absolute top-3 transition-all duration-1000 ease-linear z-50"
              style={{ left: `${timeState.pct}%`, transform: 'translateX(-50%)' }}
            >
              <div className="flex flex-col items-center">
                <div className="px-1.5 py-0.5 bg-black/80 border border-white/5 rounded shadow-lg">
                    <span className="font-mono text-[0.5rem] md:text-[0.65rem] font-bold tracking-[0.1em] text-white/60 tabular-nums">
                      {timeState.label}
                    </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none z-10 bg-gradient-to-r from-black/70 via-black/10 to-transparent" />
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
