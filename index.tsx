import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';

// --- Configuration ---
const BIRTHS_PER_SECOND = 4.35;
const COLORS = {
  LAND: '#1a2233',      // Dark slate
  ICE: '#e2e8f0',       // Bright glacial white
  OCEAN_DEEP: '#020617',
  OCEAN_SHALLOW: '#1e3a8a',
  FLASH_BURST: '#ffffff',
  FLASH_GLOW: '#fbbf24', 
  ATMOSPHERE_INNER: 'rgba(56, 189, 248, 0.15)', // Cyan-400
  ATMOSPHERE_OUTER: 'rgba(30, 58, 138, 0.05)',  // Blue-900
  GRATICULE: 'rgba(255, 255, 255, 0.02)'
};

// --- Star Generator ---
const generateStars = (count: number) => {
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 1.8 + 0.5, // Slightly larger stars
    duration: Math.random() * 3 + 1, // Faster twinkle
    delay: Math.random() * 5
  }));
};

const SpaceBackground: React.FC = () => {
  const stars = useMemo(() => generateStars(700), []);
  
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-black">
      <div className="absolute inset-0">
        <div className="nebula absolute top-[-10%] right-[-10%] w-[80vw] h-[80vw] bg-blue-900/15 rounded-full animate-pulse" />
        <div className="nebula absolute bottom-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-indigo-900/10 rounded-full animate-pulse" />
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
      
      // Full globe visibility: centered on right with padding
      const radius = Math.min(w, h) * 0.35;
      const cx = w * 0.65; 
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

      // Atmosphere Outer Glow
      const outerAtmosphere = ctx.createRadialGradient(cx, cy, radius, cx, cy, radius + 120);
      outerAtmosphere.addColorStop(0, COLORS.ATMOSPHERE_INNER);
      outerAtmosphere.addColorStop(1, 'transparent');
      ctx.fillStyle = outerAtmosphere;
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 120, 0, Math.PI * 2);
      ctx.fill();

      // Deep Ocean
      const oceanGrad = ctx.createRadialGradient(
        cx - radius * 0.3, cy - radius * 0.3, 0,
        cx, cy, radius
      );
      oceanGrad.addColorStop(0, COLORS.OCEAN_SHALLOW);
      oceanGrad.addColorStop(1, COLORS.OCEAN_DEEP);
      ctx.fillStyle = oceanGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      // Grid
      ctx.beginPath();
      path(graticule());
      ctx.strokeStyle = COLORS.GRATICULE;
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Land
      const now = Date.now();
      geoDataRef.current.features.forEach((d: any) => {
        const centroid = d3.geoCentroid(d);
        const distance = d3.geoDistance(centroid, [-rotationRef.current[0], -rotationRef.current[1]]);
        
        if (distance < Math.PI / 2) {
          ctx.beginPath();
          path(d);
          
          const isIce = (d.id === 'ATA' || d.id === 'GRL' || d.properties?.name === 'Antarctica' || d.properties?.name === 'Greenland');
          const flashStart = activeFlashes.current.get(d.id);
          
          if (flashStart) {
            const elapsed = now - flashStart;
            if (elapsed > 1200) {
              activeFlashes.current.delete(d.id);
              ctx.fillStyle = isIce ? COLORS.ICE : COLORS.LAND;
            } else {
              const t = elapsed / 1200;
              const flashColor = elapsed < 80 
                ? COLORS.FLASH_BURST 
                : d3.interpolateRgb(COLORS.FLASH_GLOW, isIce ? COLORS.ICE : COLORS.LAND)(t);
              ctx.fillStyle = flashColor;
              ctx.shadowBlur = 40 * (1 - t);
              ctx.shadowColor = COLORS.FLASH_GLOW;
            }
          } else {
            ctx.fillStyle = isIce ? COLORS.ICE : COLORS.LAND;
            ctx.shadowBlur = 0;
          }

          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = 'rgba(255,255,255,0.02)';
          ctx.stroke();
        }
      });

      // Reflection
      const specGrad = ctx.createRadialGradient(
        cx - radius * 0.3, cy - radius * 0.3, 0,
        cx - radius * 0.3, cy - radius * 0.3, radius * 1.2
      );
      specGrad.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
      specGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = specGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

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

  return <canvas ref={canvasRef} className="absolute inset-0 z-10 pointer-events-none" />;
};

const App: React.FC = () => {
  const [total, setTotal] = useState<number>(0);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [pulse, setPulse] = useState(false);
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
        setPulse(true);
        setTimeout(() => setPulse(false), 200);
        
        // Distribution pool
        const countries = ['IND', 'CHN', 'NGA', 'PAK', 'IDN', 'BRA', 'USA', 'BGD', 'ETH', 'MEX', 'PHL', 'COD', 'EGY', 'RUS', 'VNM', 'TUR', 'FRA', 'DEU', 'GBR'];
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

      {/* Main UI */}
      <div className="absolute left-0 inset-y-0 z-20 w-[45%] flex flex-col justify-center px-16 pointer-events-none">
        <div className="flex flex-col gap-1">
          <h1 className="text-white/40 font-bold uppercase tracking-[0.4em] text-xs">
            Total Birth count
          </h1>
          
          <div className={`transition-colors duration-200 ${pulse ? 'text-amber-300' : 'text-white'}`}>
            <span className="text-[6vw] font-black tabular-nums tracking-tighter drop-shadow-[0_0_40px_rgba(251,191,36,0.1)] transition-none">
              {total.toLocaleString('de-DE')}
            </span>
          </div>

          {/* Progress Bar Container */}
          <div className="w-full max-w-sm mt-12 relative">
             <div className="flex justify-between items-end mb-1 px-1">
                <span className="text-white/20 font-mono text-[9px] uppercase tracking-widest">Global Timeline</span>
             </div>
             
             {/* Dynamic Time Label that follows progress */}
             <div className="h-10 w-full relative mb-1">
                <div 
                  className="absolute bottom-0 -translate-x-1/2 flex flex-col items-center transition-all duration-1000 linear"
                  style={{ left: `${timeState.pct}%` }}
                >
                  <div className="bg-white/5 backdrop-blur-sm border border-white/10 px-2 py-0.5 rounded-md">
                    <span className="text-white font-mono text-xs font-bold">{timeState.label}</span>
                  </div>
                  <div className="w-px h-2 bg-white/20 mt-1" />
                </div>
             </div>

             <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                <div 
                  className="h-full bg-gradient-to-r from-blue-600 via-amber-500 to-rose-600 rounded-full transition-all duration-1000 linear"
                  style={{ width: `${timeState.pct}%` }}
                />
             </div>
          </div>
        </div>
      </div>

      {/* Brand Overlay */}
      <div className="absolute top-10 left-16 z-30 pointer-events-none opacity-20">
        <p className="font-black text-xl tracking-tighter text-white">
          EARTH<span className="text-amber-500">PULSE</span>
        </p>
      </div>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}