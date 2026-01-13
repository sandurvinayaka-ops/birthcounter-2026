
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';

// --- Configuration ---
const BIRTHS_PER_SECOND = 4.352;
const AUTO_ROTATION_SPEED = 12.0; 
const INITIAL_PHI = -15;

const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;
const GLOBE_RENDER_SCALE = 1.0; 

const COLORS = {
  LAND: '#cbd5e1', 
  LAND_BRIGHT: '#ffffff',
  OCEAN_DEEP: '#010409',
  OCEAN_BRIGHT: '#0f172a', 
  YELLOW_SOLID: '#facc15',
  FLASH_PEAK: '#ffffff', 
  ATMOSPHERE: 'rgba(56, 189, 248, 0.45)', 
  SPECULAR: 'rgba(255, 255, 255, 0.2)', 
  HEADER_BLUE: '#3b82f6', 
  PACIFIER_GLOW: '#60a5fa',
};

interface Pacifier {
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
  const pacifierSpriteRef = useRef<HTMLCanvasElement | null>(null);
  
  const geoDataRef = useRef<any>(null);
  const featuresMapRef = useRef<Map<string, any>>(new Map());
  const activeFlashes = useRef<Map<string, number>>(new Map());
  const pacifiers = useRef<Pacifier[]>([]);
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

  // Generate ultra-glowing Pacifier Sprite
  useEffect(() => {
    const pSprite = document.createElement('canvas');
    const size = 64;
    pSprite.width = size * 2; pSprite.height = size * 2;
    const sCtx = pSprite.getContext('2d');
    if (sCtx) {
      sCtx.translate(size, size);
      sCtx.shadowBlur = 25;
      sCtx.shadowColor = COLORS.PACIFIER_GLOW;

      sCtx.beginPath();
      sCtx.arc(0, 14, 10, 0, Math.PI * 2);
      sCtx.strokeStyle = '#fff';
      sCtx.lineWidth = 4;
      sCtx.stroke();

      sCtx.beginPath();
      sCtx.ellipse(0, 0, 18, 8, 0, 0, Math.PI * 2);
      sCtx.fillStyle = COLORS.PACIFIER_GLOW;
      sCtx.fill();
      sCtx.strokeStyle = '#fff';
      sCtx.lineWidth = 1.5;
      sCtx.stroke();

      sCtx.beginPath();
      sCtx.arc(0, -10, 9, 0, Math.PI * 2);
      sCtx.fillStyle = 'rgba(255, 255, 255, 1.0)';
      sCtx.fill();
    }
    pacifierSpriteRef.current = pSprite;
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

      const minDim = Math.min(w, h);
      const radius = minDim * 0.33; 
      const cx = w > 768 ? w * 0.65 : w / 2;
      const cy = h / 2;

      projectionRef.current.scale(radius * GLOBE_RENDER_SCALE).translate([(cx * GLOBE_RENDER_SCALE), (cy * GLOBE_RENDER_SCALE)]);
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
          const countries = ['IND', 'CHN', 'NGA', 'PAK', 'IDN', 'BRA', 'USA', 'BGD', 'ETH', 'MEX', 'PHL', 'COD', 'EGY', 'RUS', 'VNM', 'TUR', 'THA', 'FRA', 'DEU', 'GBR'];
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
      const r = (minDim * 0.33) * GLOBE_RENDER_SCALE;
      const cx = (w > 768 ? w * 0.65 : w / 2) * GLOBE_RENDER_SCALE;
      const cy = (h / 2) * GLOBE_RENDER_SCALE;

      fCtx.clearRect(0, 0, w, h);
      
      // Rendering glowing pacifiers
      if (pacifierSpriteRef.current) {
        if (pacifiers.current.length < 5) {
          pacifiers.current.push({
            x: Math.random() * w, y: Math.random() * h,
            vx: (Math.random() - 0.5) * 104, vy: (Math.random() - 0.5) * 104,
            rot: Math.random() * Math.PI * 2, rv: (Math.random() - 0.5) * 0.05,
            size: 20 + Math.random() * 16,
            alpha: 0
          });
        }
        pacifiers.current.forEach((p, idx) => {
          p.x += p.vx * 0.016; p.y += p.vy * 0.016; p.rot += p.rv;
          p.alpha = Math.min(p.alpha + 0.02, 0.4);
          if (p.x < -200 || p.x > w + 200 || p.y < -200 || p.y > h + 200) {
            pacifiers.current.splice(idx, 1); return;
          }
          fCtx.save();
          fCtx.globalAlpha = p.alpha;
          fCtx.translate(p.x, p.y); fCtx.rotate(p.rot);
          fCtx.drawImage(pacifierSpriteRef.current!, -p.size, -p.size, p.size * 2, p.size * 2);
          fCtx.restore();
        });
      }

      if (geoDataRef.current) {
        const rotation = (time * 0.001 * AUTO_ROTATION_SPEED) % 360;
        projection.rotate([rotation, INITIAL_PHI, 0]);

        // Background
        gCtx.fillStyle = '#000000';
        gCtx.fillRect(0, 0, w * GLOBE_RENDER_SCALE, h * GLOBE_RENDER_SCALE);

        // 1. Ocean Shading
        if (!gradients.current.ocean) {
          gradients.current.ocean = gCtx.createRadialGradient(cx - r * 0.4, cy - r * 0.4, 0, cx, cy, r);
          gradients.current.ocean.addColorStop(0, COLORS.OCEAN_BRIGHT);
          gradients.current.ocean.addColorStop(1, COLORS.OCEAN_DEEP);
        }
        gCtx.fillStyle = gradients.current.ocean!;
        gCtx.beginPath(); gCtx.arc(cx, cy, r, 0, Math.PI * 2); gCtx.fill();

        // 2. Graticule REMOVED for clean appearance

        // 3. Landmass Rendering
        gCtx.beginPath(); path(geoDataRef.current);
        gCtx.fillStyle = COLORS.LAND; 
        gCtx.fill();
        gCtx.strokeStyle = "rgba(255,255,255,0.2)";
        gCtx.lineWidth = 0.5;
        gCtx.stroke();

        // 4. Rim Shadow
        if (!gradients.current.rimShadow) {
          gradients.current.rimShadow = gCtx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r);
          gradients.current.rimShadow.addColorStop(0, 'rgba(0,0,0,0)');
          gradients.current.rimShadow.addColorStop(1, 'rgba(0,0,0,0.6)');
        }
        gCtx.fillStyle = gradients.current.rimShadow!;
        gCtx.beginPath(); gCtx.arc(cx, cy, r, 0, Math.PI * 2); gCtx.fill();

        // 5. Flash Logic (Enhanced for Visibility)
        const timeNow = Date.now();
        activeFlashes.current.forEach((flashTime, id) => {
          const feature = featuresMapRef.current.get(id);
          if (feature) {
            const duration = 1500; // Increased duration
            const t = Math.min((timeNow - flashTime) / duration, 1);
            if (t >= 1) { activeFlashes.current.delete(id); }
            else {
              const distance = d3.geoDistance(feature.centroid, [-rotation, -INITIAL_PHI]);
              if (distance < 1.57) { 
                gCtx.beginPath(); path(feature);
                // Sharp peak, then slow fade
                const intensity = Math.pow(1 - t, 0.6);
                const flashColor = d3.interpolateRgb(
                    d3.interpolateRgb(COLORS.FLASH_PEAK, COLORS.YELLOW_SOLID)(t * 1.5),
                    COLORS.LAND
                )(t);
                gCtx.fillStyle = flashColor;
                gCtx.fill();
                
                // Brighter, thick stroke for clarity
                gCtx.strokeStyle = `rgba(255, 255, 255, ${intensity})`;
                gCtx.lineWidth = 3 * intensity; 
                gCtx.stroke();
              }
            }
          }
        });

        // 6. Specular Highlight
        if (!gradients.current.spec) {
          gradients.current.spec = gCtx.createRadialGradient(cx - r * 0.4, cy - r * 0.4, 0, cx - r * 0.4, cy - r * 0.4, r * 1.5);
          gradients.current.spec.addColorStop(0, COLORS.SPECULAR);
          gradients.current.spec.addColorStop(1, 'rgba(0,0,0,0)');
        }
        gCtx.fillStyle = gradients.current.spec!;
        gCtx.beginPath(); gCtx.arc(cx, cy, r, 0, Math.PI * 2); gCtx.fill();

        // 7. Atmospheric Glow
        if (!gradients.current.atmo) {
          gradients.current.atmo = gCtx.createRadialGradient(cx, cy, r, cx, cy, r * 1.15);
          gradients.current.atmo.addColorStop(0, COLORS.ATMOSPHERE);
          gradients.current.atmo.addColorStop(0.3, 'rgba(56, 189, 248, 0.15)');
          gradients.current.atmo.addColorStop(1, 'rgba(0,0,0,0)');
        }
        gCtx.fillStyle = gradients.current.atmo!;
        gCtx.beginPath(); gCtx.arc(cx, cy, r * 1.15, 0, Math.PI * 2); gCtx.fill();
      }
      animId = requestAnimationFrame(render);
    };
    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  const renderFormattedTotal = (val: number) => {
    const str = val.toLocaleString('en-US').replace(/,/g, '.');
    return str.split('').map((char, i) => (
      <span key={i} className={char === '.' ? "px-[1.5px]" : ""}>{char}</span>
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

      {/* Brand Logo */}
      <div className="absolute top-8 left-8 md:top-12 md:left-16 z-40 pointer-events-none">
        <div className="flex flex-col items-start w-fit">
          <div className="flex items-baseline font-black tracking-tighter text-[1rem] md:text-[2rem] leading-none" style={{ color: COLORS.HEADER_BLUE }}>
            M&CC
          </div>
          <div className="w-full h-[2px] md:h-[4px] mt-1" style={{ backgroundColor: COLORS.YELLOW_SOLID }}></div>
        </div>
      </div>

      {/* Data HUD */}
      <div className="absolute inset-y-0 left-0 z-40 flex flex-col justify-center pl-10 md:pl-20 pointer-events-none w-full max-w-[900px]">
        <div className="flex flex-col items-start w-full translate-y-[-5%]">
          <div className="mb-0.5">
            <span className="font-bold uppercase tracking-[0.4em] text-[0.4rem] md:text-[0.6rem] opacity-90" style={{ color: COLORS.YELLOW_SOLID }}>Global birth count today</span>
          </div>
          
          <div className="mb-2 relative">
            <span className="text-[6vw] md:text-[88px] font-normal leading-none tabular-nums tracking-[0.02em]" 
              style={{ fontFamily: "'Bebas Neue', cursive", color: COLORS.YELLOW_SOLID, filter: `drop-shadow(0 0 15px rgba(250, 204, 21, 0.4))` }}>
              {renderFormattedTotal(total)}
            </span>
          </div>

          <div className="w-[35%] md:w-[32%] relative mt-4">
            <div className="flex justify-between items-end mb-2 relative h-4">
              <span className="font-bold uppercase tracking-[0.4em] text-[0.4rem] md:text-[0.5rem]" style={{ color: COLORS.YELLOW_SOLID }}>Daily Progress</span>
              <span className="font-mono text-[9px] md:text-[12px] tabular-nums font-bold tracking-widest" style={{ color: COLORS.YELLOW_SOLID }}>{Math.floor(timeState.pct)}%</span>
            </div>

            <div className="h-[3px] w-full bg-white/10 rounded-full overflow-hidden relative backdrop-blur-md">
              <div 
                className="h-full rounded-full transition-all duration-1000 ease-linear shadow-[0_0_10px_rgba(250,204,21,0.5)]"
                style={{ width: `${timeState.pct}%`, background: `linear-gradient(90deg, #334155 0%, ${COLORS.YELLOW_SOLID} 100%)` }} 
              />
            </div>

            <div 
              className="absolute top-6 transition-all duration-1000 ease-linear"
              style={{ left: `${timeState.pct}%`, transform: 'translateX(-50%)' }}
            >
              <div className="flex flex-col items-center">
                <div className="w-[1px] h-3 mb-1" style={{ backgroundColor: COLORS.YELLOW_SOLID }}></div>
                <div className="px-2.5 py-1 bg-black/60 backdrop-blur-xl border border-white/10 rounded shadow-2xl">
                    <span className="font-mono text-[0.7rem] md:text-[1rem] font-black tracking-[0.1em] tabular-nums" style={{ color: COLORS.YELLOW_SOLID }}>
                      {timeState.label}
                    </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none z-10 bg-gradient-to-r from-black/80 via-black/10 to-transparent" />
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
