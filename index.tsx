import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';

// --- Constants ---
const BIRTHS_PER_SECOND = 4.35;
const FLASH_BURST_COLOR = "#FFFFFF";
const FLASH_BLOOM_COLOR = "#fbbf24";
const LAND_COLOR = "#4b5563";
const OCEAN_COLOR = "#050814";
const GLOBE_ROTATION_SPEED = 0.5;

// --- Helper: Generate Stars ---
const generateStars = (count: number) => {
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    top: `${Math.random() * 100}%`,
    left: `${Math.random() * 100}%`,
    size: Math.random() * 4 + 1.5,
    duration: `${Math.random() * 3 + 2}s`,
    delay: `${Math.random() * -10}s`
  }));
};

const SpaceBackground: React.FC = () => {
  const stars = useMemo(() => generateStars(600), []);
  const [comets, setComets] = useState<{ id: number, startX: number, startY: number }[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.6) {
        const id = Date.now();
        setComets(prev => [...prev, { id, startX: Math.random() * 100, startY: Math.random() * -10 }]);
        setTimeout(() => setComets(p => p.filter(c => c.id !== id)), 5000);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden bg-[#000005]" style={{ zIndex: -1 }}>
      <div className="absolute top-1/2 left-1/2 w-[200vmax] h-[200vmax]" 
           style={{ animation: 'space-rotate 1000s linear infinite', zIndex: -2 }}>
        <div className="absolute inset-0 opacity-40" 
             style={{ 
               background: 'radial-gradient(circle at 70% 30%, rgba(37, 99, 235, 0.25) 0%, transparent 50%), radial-gradient(circle at 30% 70%, rgba(126, 34, 206, 0.2) 0%, transparent 50%)',
               filter: 'blur(100px)' 
             }} />
        {stars.map(s => (
          <div key={s.id} 
               className="absolute rounded-full bg-white"
               style={{
                 top: s.top,
                 left: s.left,
                 width: `${s.size}px`,
                 height: `${s.size}px`,
                 boxShadow: '0 0 15px rgba(255,255,255,0.9)',
                 animation: `twinkle ${s.duration} ease-in-out infinite`,
                 animationDelay: s.delay
               }} />
        ))}
      </div>
      <div className="absolute inset-0">
        {comets.map(c => (
          <div key={c.id} 
               className="absolute w-1 h-1 bg-white rounded-full shadow-[0_0_20px_6px_rgba(255,255,255,0.8)]"
               style={{
                 left: `${c.startX}%`,
                 top: `${c.startY}%`,
                 animation: 'comet-fly 5s linear forwards'
               }}>
            <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[250px] h-[2px]" 
                 style={{ background: 'linear-gradient(to left, #fff, transparent)' }} />
          </div>
        ))}
      </div>
    </div>
  );
};

const WorldGlobe: React.FC<{ lastBirth: { countryId: string } | null }> = ({ lastBirth }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef<[number, number]>([0, -10]);
  const flashesRef = useRef<Map<string, number>>(new Map());
  const geoDataRef = useRef<any>(null);

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson')
      .then(res => res.json())
      .then(data => { geoDataRef.current = data; });
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;
    const dpr = window.devicePixelRatio || 1;

    const render = () => {
      if (!geoDataRef.current) {
        requestAnimationFrame(render);
        return;
      }
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const radius = Math.min(w, h) * 0.46;
      const cx = w * 0.58; 
      const cy = h * 0.5;

      context.clearRect(0, 0, w, h);
      rotationRef.current[0] += GLOBE_ROTATION_SPEED;
      const projection = d3.geoOrthographic().scale(radius).translate([cx, cy]).rotate(rotationRef.current).clipAngle(90);
      const path = d3.geoPath(projection, context);

      const bloom = context.createRadialGradient(cx, cy, radius, cx, cy, radius + 180);
      bloom.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
      bloom.addColorStop(1, 'transparent');
      context.fillStyle = bloom;
      context.beginPath(); context.arc(cx, cy, radius + 180, 0, Math.PI * 2); context.fill();

      context.beginPath(); context.arc(cx, cy, radius, 0, Math.PI * 2);
      context.fillStyle = OCEAN_COLOR; context.fill();

      const now = Date.now();
      geoDataRef.current.features.forEach((f: any) => {
        const centroid = d3.geoCentroid(f);
        const isVisible = d3.geoDistance(centroid, [-rotationRef.current[0], -rotationRef.current[1]]) < Math.PI/2.05;
        if (isVisible) {
          context.beginPath(); path(f);
          const flashStart = flashesRef.current.get(f.id);
          if (flashStart) {
            const age = now - flashStart;
            if (age > 1400) {
              flashesRef.current.delete(f.id);
              context.fillStyle = LAND_COLOR;
            } else {
              const t = age / 1400;
              context.fillStyle = age < 80 ? FLASH_BURST_COLOR : d3.interpolateRgb(FLASH_BLOOM_COLOR, LAND_COLOR)(t);
              context.shadowBlur = 60 * (1 - t);
              context.shadowColor = FLASH_BLOOM_COLOR;
            }
          } else {
            context.fillStyle = LAND_COLOR;
            context.shadowBlur = 0;
          }
          context.fill();
          context.strokeStyle = 'rgba(255,255,255,0.2)';
          context.lineWidth = 0.5;
          context.stroke();
        }
      });

      requestAnimationFrame(render);
    };

    const handleResize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      context.scale(dpr, dpr);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    const animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, []);

  useEffect(() => {
    if (lastBirth) flashesRef.current.set(lastBirth.countryId, Date.now());
  }, [lastBirth]);

  return <canvas ref={canvasRef} className="absolute inset-0 z-10 pointer-events-none" />;
};

const App: React.FC = () => {
  const [totalToday, setTotalToday] = useState<number>(0);
  const [lastBirth, setLastBirth] = useState<{ countryId: string } | null>(null);
  const [timeState, setTimeState] = useState({ label: "00:00", pct: 0 });
  const birthCountRef = useRef(0);

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const elapsed = (d.getTime() - midnight) / 1000;
      const pct = (elapsed / 86400) * 100;
      setTimeState({ 
        label: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }), 
        pct 
      });
      if (birthCountRef.current === 0) {
        birthCountRef.current = Math.floor(elapsed * BIRTHS_PER_SECOND);
        setTotalToday(birthCountRef.current);
      }
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);

    const spawn = () => {
      const delay = -Math.log(Math.random()) * (1000 / BIRTHS_PER_SECOND);
      setTimeout(() => {
        birthCountRef.current++;
        setTotalToday(birthCountRef.current);
        const countries = ['IND', 'CHN', 'NGA', 'PAK', 'IDN', 'USA', 'ETH', 'BRA', 'BGD', 'COD', 'MEX', 'EGY', 'PHL', 'VNM', 'TUR'];
        setLastBirth({ countryId: countries[Math.floor(Math.random() * countries.length)] });
        spawn();
      }, delay);
    };
    spawn();

    return () => clearInterval(timer);
  }, []);

  const formattedCount = totalToday.toLocaleString('de-DE');

  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      <SpaceBackground />
      <WorldGlobe lastBirth={lastBirth} />

      <div className="absolute top-0 left-0 bottom-0 w-full flex flex-col justify-center pl-24 z-20 pointer-events-none"
           style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)' }}>
        
        <div className="pointer-events-auto flex flex-col items-start text-left">
          <div className="mb-4">
            <h2 className="text-[0.8rem] uppercase tracking-[0.6em] text-blue-400 font-black">
              Global Births Since Midnight
            </h2>
          </div>

          <div className="flex flex-col items-start max-w-fit">
            <div className="text-[11vw] font-black text-amber-400 leading-none tracking-tighter tabular-nums"
                 style={{ textShadow: '0 0 50px rgba(251, 191, 36, 0.4), 0 0 120px rgba(251, 191, 36, 0.2)' }}>
              {formattedCount}
            </div>

            <div className="relative w-full mt-14 mb-8 h-4">
              <div className="absolute bottom-full mb-5 -translate-x-1/2 transition-all duration-1000 ease-linear"
                   style={{ left: `${timeState.pct}%` }}>
                <span className="text-2xl font-black font-mono text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.9)]">
                  {timeState.label}
                </span>
              </div>
              
              <div className="w-full h-full bg-white/20 rounded-full overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,1)]">
                <div className="h-full bg-gradient-to-r from-blue-500 via-amber-400 to-orange-500 rounded-full shadow-[0_0_40px_rgba(251,191,36,0.8)] transition-all duration-1000 ease-linear"
                     style={{ width: `${timeState.pct}%` }} />
              </div>
            </div>
          </div>

          <div className="mt-6 opacity-80 text-blue-100 text-sm tracking-widest uppercase font-bold flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            Live Population Pulse • {BIRTHS_PER_SECOND} Per Second
          </div>
        </div>
      </div>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}