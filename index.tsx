import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';

// --- Configuration ---
const BIRTHS_PER_SECOND = 4.35;
const AUTO_ROTATION_SPEED = 0.35; 
const FRICTION = 0.98; 
const MEDITERRANEAN_LATITUDE = -38; 
const COLORS = {
  // Enhanced land colors for maximum contrast on TV screens
  LAND: '#7aa3c0',      
  LAND_LIT: '#c9e7f7',  
  OCEAN_DEEP: '#01040a',
  OCEAN_SHALLOW: '#0a1d47',
  OCEAN_BRIGHT: '#1e40af',
  GOLD: '#fbbf24',      
  BLUE: '#38bdf8',      
  ATMOSPHERE_INNER: 'rgba(56, 189, 248, 0.15)', 
};

const STAR_COUNT = 350; 
const STARS = Array.from({ length: STAR_COUNT }).map((_, i) => ({
  id: i,
  top: `${Math.random() * 100}%`,
  left: `${Math.random() * 100}%`,
  size: Math.random() * 1.8 + 0.4,
  delay: `${Math.random() * 5}s`,
  duration: `${4 + Math.random() * 6}s`,
  opacity: 0.2 + Math.random() * 0.5,
}));

const PACIFIER_COUNT = 15; 
const PACIFIERS = Array.from({ length: PACIFIER_COUNT }).map((_, i) => ({
  id: i,
  startX: Math.random() * 100,
  startY: Math.random() * 100,
  size: 10 + Math.random() * 15, 
  duration: 5 + Math.random() * 10, 
  driftX: (Math.random() - 0.5) * 150, 
  driftY: (Math.random() - 0.5) * 150,
  rotation: Math.random() * 360,
  rotationSpeed: (Math.random() - 0.5) * 800, 
}));

const PacifierIcon = ({ size, color }: { size: number, color: string }) => (
  <div style={{ position: 'relative', width: size, height: size }}>
    <div style={{
      position: 'absolute',
      inset: '-10px',
      background: `radial-gradient(circle, ${color}44 0%, transparent 70%)`,
      borderRadius: '50%',
      filter: 'blur(5px)',
      animation: 'pacifierPulse 3s ease-in-out infinite'
    }} />
    
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      style={{ 
        filter: `drop-shadow(0 0 10px ${color}) drop-shadow(0 0 2px white)`,
        opacity: 0.8
      }}
    >
      <defs>
        <linearGradient id="pacifierGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="white" />
          <stop offset="50%" stopColor={color} />
          <stop offset="100%" stopColor={color} stopOpacity="0.8" />
        </linearGradient>
        <linearGradient id="shineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.8)" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
        <clipPath id="pacifierClip">
          <circle cx="50" cy="22" r="16" />
          <rect x="10" y="38" width="80" height="20" rx="10" />
          <path d="M35 58 C 35 58, 30 92, 50 92 C 70 92, 65 58, 65 58 Z" />
        </clipPath>
      </defs>
      
      <circle cx="50" cy="22" r="16" fill="none" stroke="url(#pacifierGrad)" strokeWidth="8" />
      <rect x="10" y="38" width="80" height="20" rx="10" fill="url(#pacifierGrad)" />
      <path fill="url(#pacifierGrad)" d="M35 58 C 35 58, 30 92, 50 92 C 70 92, 65 58, 65 58 Z" />
      
      <g clipPath="url(#pacifierClip)">
        <rect width="200" height="200" fill="url(#shineGrad)" opacity="0.6">
          <animateTransform
            attributeName="transform"
            type="translate"
            from="-150 0"
            to="150 0"
            dur="2s"
            repeatCount="indefinite"
          />
        </rect>
      </g>

      <path d="M45 15 A 8 8 0 0 1 55 15" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <circle cx="50" cy="80" r="4" fill="white" opacity="0.4" />
    </svg>
  </div>
);

const SpaceBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-[#000105]">
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.1); }
        }
        @keyframes cometPath {
          0% { transform: translate(0, 0) rotate(0deg); opacity: 0; }
          10% { opacity: 0.8; }
          90% { opacity: 0.8; }
          100% { transform: translate(var(--driftX), var(--driftY)) rotate(var(--rotFull)); opacity: 0; }
        }
        @keyframes pacifierPulse {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.4); opacity: 0.6; }
        }
        .star {
          position: absolute;
          background: white;
          border-radius: 50%;
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

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(8,26,61,0.15)_0%,transparent_70%)]"></div>
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
      
      const dt = Math.min(time - lastTimeRef.current, 64);
      lastTimeRef.current = time;
      const timeFactor = dt / 16.67;
      
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      
      const radius = h * 0.25; 
      // MOVED LEFT (~1cm) and TOP (~2cm):
      // cx shifted from 0.54 to 0.50
      // cy shifted from 0.50 to 0.42
      const cx = w * 0.50; 
      const cy = h * 0.42; 

      ctx.clearRect(0, 0, w, h);
      
      if (!isDraggingRef.current) {
        velocityRef.current[0] += (AUTO_ROTATION_SPEED - velocityRef.current[0]) * 0.05 * timeFactor;
        const targetPhi = MEDITERRANEAN_LATITUDE;
        rotationRef.current[0] += velocityRef.current[0] * timeFactor;
        rotationRef.current[1] += (targetPhi - rotationRef.current[1]) * 0.02 * timeFactor;
        velocityRef.current[0] *= Math.pow(FRICTION, timeFactor);
        velocityRef.current[1] *= Math.pow(FRICTION, timeFactor);
      }

      const projection = d3.geoOrthographic()
        .scale(radius)
        .translate([cx, cy])
        .rotate([rotationRef.current[0], rotationRef.current[1], rotationRef.current[2]])
        .clipAngle(90);
        
      const path = d3.geoPath(projection, ctx);
      
      const aura = ctx.createRadialGradient(cx, cy, radius, cx, cy, radius + 40);
      aura.addColorStop(0, COLORS.ATMOSPHERE_INNER);
      aura.addColorStop(0.5, 'rgba(56, 189, 248, 0.01)');
      aura.addColorStop(1, 'transparent');
      ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(cx, cy, radius + 40, 0, Math.PI * 2); ctx.fill();

      const ocean = ctx.createRadialGradient(cx - radius * 0.2, cy - radius * 0.2, 0, cx, cy, radius);
      ocean.addColorStop(0, COLORS.OCEAN_BRIGHT);
      ocean.addColorStop(0.5, COLORS.OCEAN_SHALLOW);
      ocean.addColorStop(1, COLORS.OCEAN_DEEP);
      ctx.fillStyle = ocean; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();

      const now = Date.now();
      geoDataRef.current.features.forEach((d: any) => {
        const centroid = d3.geoCentroid(d);
        const distance = d3.geoDistance(centroid, [-rotationRef.current[0], -rotationRef.current[1]]);
        
        if (distance < Math.PI / 1.6) { 
          ctx.beginPath(); 
          path(d);
          const flashStart = activeFlashes.current.get(d.id);
          const edgeFade = Math.pow(Math.max(0, (distance - (Math.PI / 3.2)) * 4), 1.5);
          
          const shading = 1 - Math.pow(distance / (Math.PI / 1.7), 0.9); // Brighter shading for visibility
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
              ctx.shadowBlur = 20 * (1 - t); 
              ctx.shadowColor = COLORS.GOLD;
            }
          } else {
            ctx.fillStyle = d3.interpolateRgb(landBase, COLORS.OCEAN_DEEP)(edgeFade);
            ctx.shadowBlur = 0;
          }
          ctx.fill(); 
          
          // SIGNIFICANTLY ENHANCED STROKE for country borders
          ctx.strokeStyle = `rgba(255,255,255, ${Math.max(0.1, 0.3 - edgeFade * 0.2)})`; 
          ctx.lineWidth = 0.8; 
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      });

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
      
      {/* Branding */}
      <div className="absolute top-8 left-10 md:top-12 md:left-16 z-30 pointer-events-none">
        <div className="flex flex-col items-start w-fit">
          <div className="flex items-baseline font-black tracking-tighter text-2xl md:text-4xl leading-none">
            <span className="text-white">M</span>
            <span className="text-sky-500">&</span>
            <span className="text-white">CC</span>
          </div>
          <div className="w-full h-[2px] md:h-[3px] bg-sky-500 mt-1.5"></div>
        </div>
      </div>

      <div className="absolute inset-y-0 left-0 z-20 flex flex-col justify-center pl-12 md:pl-20 pointer-events-none w-full max-w-[35%] transform translate-y-16">
        <div className="flex flex-col items-start gap-3">
          <div className="flex flex-col gap-0.5 max-w-full">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
              <span className="text-sky-400 font-bold uppercase tracking-[0.5em] text-[10px] md:text-sm opacity-60">Birth Counter Today</span>
            </div>
            
            <div className="flex items-baseline">
              <span 
                className="text-[5.5vw] font-black leading-none transition-all duration-300" 
                style={{ fontFamily: "'Anton', sans-serif", color: COLORS.GOLD, textShadow: `0 0 20px ${COLORS.GOLD}15` }}
              >
                {total.toLocaleString('en-US').replace(/,/g, '.')}
              </span>
            </div>
          </div>

          <div className="w-full max-w-[340px] mt-8 relative">
            <div className="flex justify-between items-end mb-2 px-0.5">
              <span className="text-sky-400 font-bold uppercase tracking-widest text-[9px] opacity-40">Day Progress Cycle</span>
              <span className="text-white/20 font-mono text-[10px]">{Math.floor(timeState.pct)}%</span>
            </div>
            
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden relative border border-white/5 shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-sky-800 via-sky-600 to-amber-600 transition-all duration-1000 ease-linear"
                style={{ width: `${timeState.pct}%`, boxShadow: '0 0 8px rgba(56, 189, 248, 0.1)' }}
              />
            </div>
            
            <div 
              className="absolute top-full mt-2 flex flex-col items-center transition-all duration-1000 ease-linear"
              style={{ left: `${timeState.pct}%`, transform: 'translateX(-50%)' }}
            >
              <div className="w-px h-5 bg-sky-500/10"></div>
              <div className="bg-white/5 backdrop-blur-3xl border border-white/10 px-3 py-1.5 rounded-md mt-0.5 flex items-center shadow-2xl">
                <span className="text-white font-mono text-sm md:text-xl font-bold tracking-tight whitespace-nowrap tabular-nums opacity-90">
                  {timeState.label}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-black/90 to-transparent z-10 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-full h-48 bg-gradient-to-t from-black/90 to-transparent z-10 pointer-events-none"></div>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
