import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';

// --- Configuration ---
const BIRTHS_PER_SECOND = 4.35;
const COLORS = {
  LAND: '#334155',
  OCEAN: '#030712',
  FLASH_BURST: '#ffffff',
  FLASH_GLOW: '#fbbf24', // Amber-400
  ATMOSPHERE: 'rgba(37, 99, 235, 0.15)' // Blue-600
};

// --- Star Generator ---
const generateStars = (count: number) => {
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 1.8 + 0.5,
    duration: Math.random() * 4 + 3,
    delay: Math.random() * 10
  }));
};

const SpaceBackground: React.FC = () => {
  const stars = useMemo(() => generateStars(500), []);
  
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-black">
      {/* Nebulas */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="nebula absolute -top-[10%] -left-[10%] w-[70vw] h-[70vw] bg-blue-900 rounded-full animate-pulse" />
        <div className="nebula absolute -bottom-[10%] -right-[10%] w-[60vw] h-[60vw] bg-purple-900 rounded-full animate-pulse" style={{ animationDelay: '3s' }} />
      </div>

      {/* Rotating Star Field */}
      <div 
        className="absolute top-1/2 left-1/2 w-[300vmax] h-[300vmax]"
        style={{ animation: 'rotate-bg 1200s linear infinite' }}
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
  const rotationRef = useRef<[number, number]>([0, -10]);
  const activeFlashes = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    // Load world data
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
      
      // Responsive sizing: Ensure globe is fully visible and nicely centered
      const isMobile = w < 768;
      const radius = isMobile ? Math.min(w, h) * 0.35 : Math.min(w, h) * 0.42;
      const cx = isMobile ? w * 0.5 : w * 0.65; // Offset to the right on desktop to leave room for UI
      const cy = h * 0.5;

      ctx.clearRect(0, 0, w, h);
      rotationRef.current[0] += 0.25; // Gentle rotation

      const projection = d3.geoOrthographic()
        .scale(radius)
        .translate([cx, cy])
        .rotate(rotationRef.current)
        .clipAngle(90);

      const path = d3.geoPath(projection, ctx);

      // 1. Atmosphere Glow (Radial Gradient behind the globe)
      const grad = ctx.createRadialGradient(cx, cy, radius, cx, cy, radius + 150);
      grad.addColorStop(0, COLORS.ATMOSPHERE);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 150, 0, Math.PI * 2);
      ctx.fill();

      // 2. Base Ocean Disc
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.OCEAN;
      ctx.fill();

      // 3. Draw Geography and Active Birth Flashes
      const now = Date.now();
      geoDataRef.current.features.forEach((d: any) => {
        const centroid = d3.geoCentroid(d);
        const distance = d3.geoDistance(centroid, [-rotationRef.current[0], -rotationRef.current[1]]);
        
        // Only render features on the visible hemisphere
        if (distance < Math.PI / 2) {
          ctx.beginPath();
          path(d);
          
          const flashStart = activeFlashes.current.get(d.id);
          if (flashStart) {
            const elapsed = now - flashStart;
            if (elapsed > 1800) {
              activeFlashes.current.delete(d.id);
              ctx.fillStyle = COLORS.LAND;
            } else {
              const t = elapsed / 1800;
              // Initial burst is pure white, then fades to amber, then back to land color
              const flashColor = elapsed < 100 
                ? COLORS.FLASH_BURST 
                : d3.interpolateRgb(COLORS.FLASH_GLOW, COLORS.LAND)(t);
              ctx.fillStyle = flashColor;
              ctx.shadowBlur = 50 * (1 - t);
              ctx.shadowColor = COLORS.FLASH_GLOW;
            }
          } else {
            ctx.fillStyle = COLORS.LAND;
            ctx.shadowBlur = 0;
          }

          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.1)';
          ctx.lineWidth = 0.5;
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

  return <canvas ref={canvasRef} className="absolute inset-0 z-10 pointer-events-none" />;
};

const App: React.FC = () => {
  const [total, setTotal] = useState<number>(0);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [timeState, setTimeState] = useState({ label: "00:00", pct: 0 });
  const countRef = useRef(0);

  useEffect(() => {
    // Initial clock and progress sync
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
    const interval = setInterval(updateProgress, 1000);

    // Poisson-like birth spawner
    const spawn = () => {
      const wait = -Math.log(Math.random()) * (1000 / BIRTHS_PER_SECOND);
      setTimeout(() => {
        countRef.current += 1;
        setTotal(countRef.current);
        
        // Pool of country IDs that exist in the GeoJSON
        const countryPool = ['IND', 'CHN', 'NGA', 'USA', 'PAK', 'IDN', 'BRA', 'ETH', 'BGD', 'COD', 'MEX', 'EGY', 'PHL', 'VNM', 'TUR', 'RUS', 'JPN', 'DEU', 'FRA', 'GBR'];
        const randomCountry = countryPool[Math.floor(Math.random() * countryPool.length)];
        setFlashId(randomCountry);
        
        spawn();
      }, wait);
    };
    spawn();

    return () => clearInterval(interval);
  }, []);

  // Format count as string for safe rendering
  const displayCount = total.toLocaleString('de-DE');

  return (
    <div className="relative w-full h-full select-none">
      <SpaceBackground />
      <Globe lastFlash={flashId} />

      {/* Hero UI Overlay */}
      <div className="absolute inset-0 z-20 flex items-center px-8 md:px-24 pointer-events-none">
        <div className="flex flex-col items-start w-full max-w-3xl pointer-events-auto">
          
          <header className="mb-6">
            <h2 className="text-blue-500 font-black uppercase tracking-[0.5em] text-[10px] md:text-xs mb-1">
              Live Galactic Feed
            </h2>
            <h1 className="text-white text-lg md:text-xl font-bold tracking-tight opacity-70">
              Global Human Expansion Pulse
            </h1>
          </header>
          
          <div className="flex flex-col mb-16">
            <span className="text-[14vw] md:text-[120px] font-black text-amber-400 leading-none tabular-nums drop-shadow-[0_0_40px_rgba(251,191,36,0.5)]">
              {displayCount}
            </span>
            <span className="text-blue-100/50 text-sm md:text-lg font-medium tracking-widest uppercase mt-2">
              Estimated births since midnight
            </span>
          </div>

          {/* Time Tracking Progress Bar */}
          <div className="w-full max-w-md relative py-12">
            <div 
              className="absolute top-0 flex flex-col items-center -translate-x-1/2 transition-all duration-1000 linear"
              style={{ left: `${timeState.pct}%` }}
            >
              <div className="bg-white/5 backdrop-blur-xl px-4 py-1.5 rounded-full border border-white/20 mb-3 shadow-2xl">
                <span className="text-white font-mono font-black text-sm tracking-widest">{timeState.label}</span>
              </div>
              <div className="w-px h-8 bg-gradient-to-b from-white to-transparent" />
            </div>

            <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/10 p-0.5">
              <div 
                className="h-full bg-gradient-to-r from-blue-700 via-amber-400 to-orange-600 rounded-full shadow-[0_0_25px_rgba(251,191,36,0.6)] transition-all duration-1000 linear"
                style={{ width: `${timeState.pct}%` }}
              />
            </div>
            
            <div className="flex justify-between mt-4 text-[9px] text-white/30 font-black uppercase tracking-[0.2em]">
              <span>Midnight</span>
              <span>Noon</span>
              <span>Next Cycle</span>
            </div>
          </div>

          <footer className="mt-10 flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-green-500/10 border border-green-500/20">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <p className="text-green-400 text-[10px] font-black uppercase tracking-widest">
                Real-time Sync
              </p>
            </div>
            <p className="text-blue-100/40 text-[10px] font-bold uppercase tracking-widest">
              Avg Frequency: {BIRTHS_PER_SECOND} / Sec
            </p>
          </footer>
        </div>
      </div>

      {/* Branding / Credit */}
      <div className="absolute bottom-12 right-12 z-30 opacity-30 hover:opacity-100 transition-all duration-500 group">
        <p className="text-right font-black text-2xl tracking-tighter text-white">
          EARTH<span className="text-amber-500 group-hover:text-blue-500 transition-colors">PULSE</span>
        </p>
        <p className="text-right text-[8px] font-bold tracking-[0.4em] uppercase text-white/40 mt-1">
          Planetary Vital Stats 2025
        </p>
      </div>
    </div>
  );
};

// standard root rendering
const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}