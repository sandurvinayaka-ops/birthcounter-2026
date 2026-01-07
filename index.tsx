import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';

// --- Configuration ---
const BIRTHS_PER_SECOND = 4.35;
const COLORS = {
  LAND: '#334155',      
  ICE: '#ffffff',       
  OCEAN_DEEP: '#01040a',
  OCEAN_SHALLOW: '#1a3275',
  GOLD: '#FFD700',
  BLUE: '#3b82f6',      // User requested Blue for header
  FLASH_BURST: '#ffffff',
  FLASH_GLOW: '#FFD700', 
  ATMOSPHERE_INNER: 'rgba(56, 189, 248, 0.12)', 
  GRATICULE: 'rgba(255, 255, 255, 0.02)'
};

// --- Star Generator ---
const generateStars = (count: number) => {
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2.2 + 1.0, 
    duration: Math.random() * 2 + 1.5,
    delay: Math.random() * 5
  }));
};

const SpaceBackground: React.FC = () => {
  const stars = useMemo(() => generateStars(900), []);
  
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-black">
      <div className="absolute inset-0">
        <div className="nebula absolute top-[-5%] right-[-5%] w-[80vw] h-[80vw] bg-blue-900/10 rounded-full animate-pulse" />
      </div>
      <div 
        className="absolute top-1/2 left-1/2 w-[300vmax] h-[300vmax]"
        style={{ animation: 'rotate-bg 1500s linear infinite' }}
      >
        {stars.map(s => (
          <div 
            key={s.id}
            className="star"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              animation: `star-twinkle ${s.duration}s ease-in-out infinite`,
              animationDelay: `${s.delay}s`
            }}
          />
        ))}
      </div>
    </div>
  );
};

const Globe: React.FC<{ lastFlash: string | null }> = ({ lastFlash }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const geoDataRef = useRef<any>(null);
  const rotationRef = useRef<[number, number]>([0, -15]);
  const activeFlashes = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson')
      .then(res => res.json())
      .then(data => { geoDataRef.current = data; });
  }, []);

  useEffect(() => {
    if (lastFlash) {
      activeFlashes.current.set(lastFlash, Date.now());
    }
  }, [lastFlash]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    let animId: number;

    const render = () => {
      if (!geoDataRef.current) {
        animId = requestAnimationFrame(render);
        return;
      }

      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      
      // Radius and center refined for "Full visibility" across all aspect ratios
      // Uses safe boundaries to never cut off the globe sphere.
      const radius = Math.min(w * 0.32, h * 0.40);
      const cx = w * 0.68; 
      const cy = h * 0.5;

      ctx.clearRect(0, 0, w, h);
      rotationRef.current[0] += 0.08;

      const projection = d3.geoOrthographic()
        .scale(radius)
        .translate([cx, cy])
        .rotate(rotationRef.current)
        .clipAngle(90);

      const path = d3.geoPath(projection, ctx);
      const graticule = d3.geoGraticule();

      const glow = ctx.createRadialGradient(cx, cy, radius, cx, cy, radius + 110);
      glow.addColorStop(0, COLORS.ATMOSPHERE_INNER);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 110, 0, Math.PI * 2);
      ctx.fill();

      const oceanGrad = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx, cy, radius);
      oceanGrad.addColorStop(0, COLORS.OCEAN_SHALLOW);
      oceanGrad.addColorStop(1, COLORS.OCEAN_DEEP);
      ctx.fillStyle = oceanGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      path(graticule());
      ctx.strokeStyle = COLORS.GRATICULE;
      ctx.lineWidth = 0.5;
      ctx.stroke();

      const now = Date.now();
      geoDataRef.current.features.forEach((d: any) => {
        const centroid = d3.geoCentroid(d);
        const distance = d3.geoDistance(centroid, [-rotationRef.current[0], -rotationRef.current[1]]);
        
        if (distance < Math.PI / 2) {
          ctx.beginPath();
          path(d);
          
          const isIce = (d.id === 'ATA' || d.id === 'GRL');
          const flashStart = activeFlashes.current.get(d.id);
          
          if (flashStart) {
            const elapsed = now - flashStart;
            if (elapsed > 1000) {
              activeFlashes.current.delete(d.id);
              ctx.fillStyle = isIce ? COLORS.ICE : COLORS.LAND;
            } else {
              const t = elapsed / 1000;
              const flashColor = elapsed < 60 ? '#fff' : d3.interpolateRgb(COLORS.GOLD, isIce ? COLORS.ICE : COLORS.LAND)(t);
              ctx.fillStyle = flashColor;
              ctx.shadowBlur = 45 * (1 - t);
              ctx.shadowColor = COLORS.GOLD;
            }
          } else {
            ctx.fillStyle = isIce ? COLORS.ICE : COLORS.LAND;
            ctx.shadowBlur = 0;
          }

          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = 'rgba(255,255,255,0.12)';
          ctx.lineWidth = 0.4;
          ctx.stroke();
        }
      });

      animId = requestAnimationFrame(render);
    };

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
    };

    window.addEventListener('resize', resize);
    resize();
    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 z-10 pointer-events-none opacity-95" />;
};

const App: React.FC = () => {
  const [total, setTotal] = useState<number>(0);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [timeState, setTimeState] = useState({ label: "00:00", pct: 0 });
  const countRef = useRef(0);

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

    const spawn = () => {
      const wait = -Math.log(Math.random()) * (1000 / BIRTHS_PER_SECOND);
      setTimeout(() => {
        countRef.current += 1;
        setTotal(countRef.current);
        
        const countries = ['IND', 'CHN', 'NGA', 'PAK', 'IDN', 'BRA', 'USA', 'BGD', 'ETH', 'MEX', 'PHL', 'COD', 'EGY', 'RUS', 'VNM', 'TUR', 'IRN', 'THA', 'FRA', 'GBR', 'DEU', 'ITA', 'ZAF', 'COL', 'ESP', 'ARG', 'CAN', 'AUS'];
        setFlashId(countries[Math.floor(Math.random() * countries.length)]);
        spawn();
      }, wait);
    };
    spawn();

    return () => clearInterval(clockInterval);
  }, []);

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-black flex">
      <SpaceBackground />
      <Globe lastFlash={flashId} />

      {/* Main UI Container */}
      <div className="absolute left-0 inset-y-0 z-20 w-[60%] flex flex-col justify-center px-20 pointer-events-none">
        <div className="flex flex-col gap-0 drop-shadow-2xl">
          <h1 
            className="font-bold uppercase tracking-[0.5em] text-[12px] ml-2"
            style={{ color: COLORS.BLUE }}
          >
            Total birth count today
          </h1>
          
          <div className="relative">
            <span 
              className={`text-[8vw] font-black tabular-nums tracking-tighter`}
              style={{ color: COLORS.GOLD, textShadow: '0 0 50px rgba(255,215,0,0.4)' }}
            >
              {total.toLocaleString('de-DE')}
            </span>
          </div>

          {/* Progress Section: Width matched to counter visual footprint (35vw) */}
          <div className="w-full max-w-[35vw] mt-2 relative">
             {/* Time Tag */}
             <div className="h-8 w-full relative mb-1">
                <div 
                  className="absolute bottom-0 -translate-x-1/2 flex flex-col items-center transition-all duration-1000 linear"
                  style={{ left: `${timeState.pct}%` }}
                >
                  <div className="bg-white/10 backdrop-blur-3xl border border-white/20 px-2 py-0.5 rounded shadow-2xl">
                    <span className="text-white font-mono text-[10px] font-black tracking-wider">{timeState.label}</span>
                  </div>
                  <div className="w-px h-2 bg-white/40 mt-0.5" />
                </div>
             </div>

             {/* Progress Bar Container: Sleek height h-2 */}
             <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 backdrop-blur-md">
                <div 
                  className="h-full bg-gradient-to-r from-blue-600 via-amber-400 to-rose-600 rounded-full transition-all duration-1000 linear shadow-[0_0_15px_rgba(255,215,0,0.2)]"
                  style={{ width: `${timeState.pct}%` }}
                />
             </div>
             
             <div className="flex justify-between items-start mt-2 px-1">
                <span className="text-white/20 font-mono text-[8px] uppercase tracking-[0.4em]">Global Rotation</span>
             </div>
          </div>
        </div>
      </div>

      {/* Brand Watermark */}
      <div className="absolute top-10 left-20 z-30 pointer-events-none opacity-50">
        <p className="font-black text-xl tracking-tighter text-white">
          EARTH<span style={{ color: COLORS.GOLD }}>PULSE</span>
        </p>
      </div>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}