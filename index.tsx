import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';

// --- Configuration ---
const BIRTHS_PER_SECOND = 4.35;
const AUTO_ROTATION_SPEED = 0.45; 
const FRICTION = 0.985; 
const MEDITERRANEAN_LATITUDE = -38; 
const COLORS = {
  LAND: '#3e5c76',      
  LAND_LIT: '#748cab',  
  OCEAN_DEEP: '#01040a',
  OCEAN_SHALLOW: '#0a1d47',
  OCEAN_BRIGHT: '#1e40af',
  GOLD: '#fbbf24',      
  BLUE: '#38bdf8',      
  ATMOSPHERE_INNER: 'rgba(56, 189, 248, 0.4)', 
};

const STAR_COUNT = 300;
const STARS = Array.from({ length: STAR_COUNT }).map((_, i) => ({
  id: i,
  top: `${Math.random() * 100}%`,
  left: `${Math.random() * 100}%`,
  size: Math.random() * 2.5 + 1,
  delay: `${Math.random() * 5}s`,
  duration: `${2 + Math.random() * 4}s`,
  opacity: 0.3 + Math.random() * 0.7,
}));

const PACIFIER_COUNT = 16;
const PACIFIERS = Array.from({ length: PACIFIER_COUNT }).map((_, i) => ({
  id: i,
  startX: Math.random() * 100,
  startY: Math.random() * 100,
  size: 40 + Math.random() * 50, 
  duration: 10 + Math.random() * 15, 
  driftX: (Math.random() - 0.5) * 100,
  driftY: (Math.random() - 0.5) * 100,
  rotation: Math.random() * 360,
  rotationSpeed: (Math.random() - 0.5) * 1800, 
}));

const PacifierIcon = ({ size, color }: { size: number, color: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 100 100" 
    style={{ 
      filter: `drop-shadow(0 0 20px ${color}) drop-shadow(0 0 8px white)`,
      opacity: 0.7
    }}
  >
    <defs>
      <linearGradient id="pacifierGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="white" />
        <stop offset="50%" stopColor={color} />
        <stop offset="100%" stopColor={color} stopOpacity="0.8" />
      </linearGradient>
    </defs>
    <circle cx="50" cy="22" r="16" fill="none" stroke="url(#pacifierGrad)" strokeWidth="8" />
    <rect x="10" y="38" width="80" height="20" rx="10" fill="url(#pacifierGrad)" />
    <path fill="url(#pacifierGrad)" d="M35 58 C 35 58, 30 92, 50 92 C 70 92, 65 58, 65 58 Z" />
  </svg>
);

const SpaceBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-[#000105]">
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes cometPath {
          0% { transform: translate(0, 0) rotate(0deg); opacity: 0; }
          15% { opacity: 0.8; }
          85% { opacity: 0.8; }
          100% { transform: translate(var(--driftX), var(--driftY)) rotate(var(--rotFull)); opacity: 0; }
        }
        .star {
          position: absolute;
          background: white;
          border-radius: 50%;
          filter: drop-shadow(0 0 2px rgba(255,255,255,0.8));
          animation: twinkle var(--duration) ease-in-out infinite;
          animation-delay: var(--delay);
        }
        .pacifier-comet {
          position: absolute;
          animation: cometPath var(--duration) linear infinite;
        }
      `}</style>

      {STARS.map((star) => (
        <div
          key={star.id}
          className="star"
          style={{
            top: star.top,
            left: star.left,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity,
            // @ts-ignore
            '--delay': star.delay,
            '--duration': star.duration,
          }}
        />
      ))}

      {PACIFIERS.map((p) => (
        <div
          key={p.id}
          className="pacifier-comet"
          style={{
            top: `${p.startY}%`,
            left: `${p.startX}%`,
            // @ts-ignore
            '--driftX': `${p.driftX}vw`,
            '--driftY': `${p.driftY}vh`,
            '--duration': `${p.duration}s`,
            '--rotFull': `${p.rotation + p.rotationSpeed}deg`,
          }}
        >
          <PacifierIcon size={p.size} color={COLORS.BLUE} />
        </div>
      ))}

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_50%,rgba(8,26,61,0.3)_0%,transparent_70%)]"></div>
    </div>
  );
};

const Globe: React.FC<{ lastFlash: string | null }> = ({ lastFlash }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const geoDataRef = useRef<any>(null);
  const rotationRef = useRef<[number, number, number]>([0, MEDITERRANEAN_LATITUDE, 0]); 
  const velocityRef = useRef<[number, number]>([AUTO_ROTATION_SPEED, 0]); 
  const isDraggingRef = useRef(false);
  const lastTimeRef = useRef<number>(performance.now());
  const activeFlashes = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson')
      .then(res => res.json())
      .then(data => { geoDataRef.current = data; })
      .catch(err => console.error("Globe data error:", err));
  }, []);

  useEffect(() => {
    if (lastFlash) activeFlashes.current.set(lastFlash, Date.now());
  }, [lastFlash]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    let animId: number;

    const drag = d3.drag<HTMLCanvasElement, unknown>()
      .on('start', () => { 
        isDraggingRef.current = true; 
        canvas.style.cursor = 'grabbing'; 
      })
      .on('drag', (event) => {
        rotationRef.current[0] += (event.dx / dpr) * 0.3;
        rotationRef.current[1] -= (event.dy / dpr) * 0.3;
        velocityRef.current = [(event.dx / dpr) * 0.4, (event.dy / dpr) * 0.4];
      })
      .on('end', () => { 
        isDraggingRef.current = false; 
        canvas.style.cursor = 'grab'; 
      });

    d3.select(canvas).call(drag);

    const render = (time: number) => {
      if (!geoDataRef.current) {
        animId = requestAnimationFrame(render);
        return;
      }
      
      const dt = Math.min(time - lastTimeRef.current, 60);
      lastTimeRef.current = time;
      const timeFactor = dt / 16.67;
      
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      
      const radius = h * 0.48; 
      const cx = w * 0.62;
      const cy = h * 0.48;

      ctx.clearRect(0, 0, w, h);
      
      if (!isDraggingRef.current) {
        velocityRef.current[0] += (AUTO_ROTATION_SPEED - velocityRef.current[0]) * 0.03 * timeFactor;
        const wave = Math.sin(time * 0.0003) * 3;
        const targetPhi = MEDITERRANEAN_LATITUDE + wave;
        rotationRef.current[0] += velocityRef.current[0] * timeFactor;
        rotationRef.current[1] += (targetPhi - rotationRef.current[1]) * 0.01 * timeFactor;
        velocityRef.current[0] *= Math.pow(FRICTION, timeFactor);
        velocityRef.current[1] *= Math.pow(FRICTION, timeFactor);
      }

      const projection = d3.geoOrthographic()
        .scale(radius)
        .translate([cx, cy])
        .rotate([rotationRef.current[0], rotationRef.current[1], rotationRef.current[2]])
        .clipAngle(90);
        
      const path = d3.geoPath(projection, ctx);
      
      const aura = ctx.createRadialGradient(cx, cy, radius, cx, cy, radius + 200);
      aura.addColorStop(0, COLORS.ATMOSPHERE_INNER);
      aura.addColorStop(0.5, 'rgba(56, 189, 248, 0.15)');
      aura.addColorStop(1, 'transparent');
      ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(cx, cy, radius + 200, 0, Math.PI * 2); ctx.fill();

      const ocean = ctx.createRadialGradient(cx - radius * 0.2, cy - radius * 0.2, 0, cx, cy, radius);
      ocean.addColorStop(0, COLORS.OCEAN_BRIGHT);
      ocean.addColorStop(0.5, COLORS.OCEAN_SHALLOW);
      ocean.addColorStop(1, COLORS.OCEAN_DEEP);
      ctx.fillStyle = ocean; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();

      const now = Date.now();
      geoDataRef.current.features.forEach((d: any) => {
        const centroid = d3.geoCentroid(d);
        const distance = d3.geoDistance(centroid, [-rotationRef.current[0], -rotationRef.current[1]]);
        
        if (distance < Math.PI / 1.5) { 
          ctx.beginPath(); 
          path(d);
          const flashStart = activeFlashes.current.get(d.id);
          const edgeFade = Math.pow(Math.max(0, (distance - (Math.PI / 3.2)) * 3.5), 1.5);
          
          const shading = 1 - Math.pow(distance / (Math.PI / 1.6), 1.2);
          const landBase = d3.interpolateRgb(COLORS.LAND, COLORS.LAND_LIT)(shading);

          if (flashStart) {
            const elapsed = now - flashStart;
            if (elapsed > 1800) {
              activeFlashes.current.delete(d.id);
              ctx.fillStyle = landBase;
            } else {
              const t = elapsed / 1800;
              const flashCol = d3.interpolateRgb(COLORS.GOLD, landBase)(t);
              ctx.fillStyle = flashCol;
              ctx.shadowBlur = 60 * (1 - t); 
              ctx.shadowColor = COLORS.GOLD;
            }
          } else {
            ctx.fillStyle = d3.interpolateRgb(landBase, COLORS.OCEAN_DEEP)(edgeFade);
            ctx.shadowBlur = 0;
          }
          ctx.fill(); 
          
          ctx.strokeStyle = `rgba(255,255,255, ${Math.max(0.02, 0.25 - edgeFade * 0.15)})`; 
          ctx.lineWidth = 1.0; 
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      });

      const rim = ctx.createRadialGradient(cx, cy, radius * 0.85, cx, cy, radius);
      rim.addColorStop(0, 'transparent');
      rim.addColorStop(1, 'rgba(0,0,0,0.7)');
      ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();

      animId = requestAnimationFrame(render);
    };

    const resize = () => {
      canvas.width = window.innerWidth * dpr; 
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    window.addEventListener('resize', resize); resize(); 
    animId = requestAnimationFrame(render);
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(animId); };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 z-10 pointer-events-auto" 
      style={{ cursor: 'grab' }}
    />
  );
};

const App: React.FC = () => {
  const [total, setTotal] = useState<number>(0);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [timeState, setTimeState] = useState({ label: "00:00:00", pct: 0 });
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
        label: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }), 
        pct 
      });
    };
    
    updateProgress();
    const clockInterval = setInterval(updateProgress, 1000);
    
    let spawnTimeoutId: any;
    const spawn = () => {
      spawnTimeoutId = setTimeout(() => {
        countRef.current += 1; 
        setTotal(countRef.current);
        const topCountries = ['IND', 'CHN', 'NGA', 'PAK', 'IDN', 'BRA', 'USA', 'BGD', 'ETH', 'MEX', 'PHL', 'COD', 'EGY', 'RUS'];
        setFlashId(topCountries[Math.floor(Math.random() * topCountries.length)]);
        spawn();
      }, -Math.log(Math.random()) * (1000 / BIRTHS_PER_SECOND));
    };
    spawn();
    
    return () => {
      clearInterval(clockInterval);
      clearTimeout(spawnTimeoutId);
    };
  }, []);

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-black flex flex-col font-sans">
      <SpaceBackground />
      <Globe lastFlash={flashId} />
      
      {/* Cinematic Overlays Optimized for 45" TV */}
      <div className="absolute inset-0 z-20 flex flex-col justify-between p-16 md:p-24 pointer-events-none">
        
        {/* Top Header Section */}
        <div className="flex justify-between items-start w-full">
          <div className="flex flex-col">
            <span className="text-6xl md:text-8xl font-black tracking-tighter drop-shadow-[0_0_20px_rgba(56,189,248,0.5)]">
              <span className="text-sky-500">M&C</span>
              <span className="text-white">C</span>
            </span>
          </div>
          
          <div className="flex flex-col items-end">
            <div className="bg-white/5 backdrop-blur-3xl border border-white/10 px-10 py-6 rounded-2xl shadow-2xl flex flex-col items-end">
               <span className="text-sky-300 font-bold uppercase tracking-widest text-lg mb-1">Live Server Time</span>
               <span className="text-white font-mono text-5xl md:text-6xl font-black tracking-tighter tabular-nums">
                {timeState.label}
               </span>
            </div>
          </div>
        </div>

        {/* Center/Bottom Data Section */}
        <div className="w-full flex flex-col items-start gap-8">
          
          <div className="flex flex-col gap-2 max-w-full">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,1)]"></div>
              <span className="text-sky-400 font-bold uppercase tracking-[0.5em] text-2xl md:text-3xl drop-shadow-lg">Total Births Today</span>
            </div>
            
            <div className="flex items-baseline gap-6">
              <span 
                className="text-[14vw] font-black leading-none drop-shadow-[0_0_100px_rgba(251,191,36,0.4)] transition-all duration-300" 
                style={{ fontFamily: "'Anton', sans-serif", color: COLORS.GOLD, textShadow: `0 0 50px ${COLORS.GOLD}33` }}
              >
                {total.toLocaleString('en-US').replace(/,/g, '.')}
              </span>
            </div>
          </div>

          {/* Reduced Width TV-Style Progress Bar (50%) */}
          <div className="w-1/2 max-w-[600px] mt-8 relative">
            <div className="flex justify-between items-end mb-4 px-2">
              <span className="text-sky-400 font-bold uppercase tracking-widest text-lg">Daily Cycle</span>
              <span className="text-white/60 font-mono text-xl">{Math.floor(timeState.pct)}%</span>
            </div>
            
            <div className="h-6 w-full bg-white/5 rounded-full overflow-hidden relative border border-white/10 shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-sky-600 via-sky-400 to-amber-400 transition-all duration-1000 ease-linear shadow-[0_0_30px_rgba(56,189,248,0.6)]"
                style={{ width: `${timeState.pct}%` }}
              />
              {/* Grid markers */}
              <div className="absolute inset-0 flex justify-between px-1 pointer-events-none opacity-20">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="w-px h-full bg-white"></div>
                ))}
              </div>
            </div>
            
            {/* Dynamic Time Display below current progress */}
            <div 
              className="absolute top-full mt-4 flex flex-col items-center transition-all duration-1000 ease-linear"
              style={{ left: `${timeState.pct}%`, transform: 'translateX(-50%)' }}
            >
              <div className="w-px h-10 bg-sky-400 shadow-[0_0_15px_rgba(56,189,248,1)]"></div>
              <div className="bg-sky-500/10 backdrop-blur-xl border border-sky-500/30 px-6 py-3 rounded-xl shadow-2xl mt-2">
                <span className="text-sky-400 font-mono text-3xl md:text-4xl font-black tracking-tight whitespace-nowrap drop-shadow-lg">
                  {timeState.label}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* High-Resolution Aesthetic Overlays */}
      <div className="absolute inset-0 pointer-events-none z-50 mix-blend-overlay opacity-15" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/carbon-fibre.png")' }}></div>
      <div className="absolute inset-0 pointer-events-none z-50 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.5)_100%)]"></div>
      
      {/* Dashboard Frames */}
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-black/80 to-transparent z-10 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-full h-48 bg-gradient-to-t from-black/80 to-transparent z-10 pointer-events-none"></div>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
