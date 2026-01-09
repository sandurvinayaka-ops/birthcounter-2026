import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';

// --- Configuration ---
const BIRTHS_PER_SECOND = 4.35;
const AUTO_ROTATION_SPEED = 0.15; 
const FRICTION = 0.96; 
const MEDITERRANEAN_LATITUDE = -38; 
const COLORS = {
  LAND: '#4b7ea2',      
  LAND_LIT: '#d0f0ff',  
  ICE: '#ffffff',       
  OCEAN_DEEP: '#00040d',
  OCEAN_SHALLOW: '#0a215e',
  OCEAN_BRIGHT: '#1a4fc2',
  SPECULAR: 'rgba(255, 255, 255, 0.5)', 
  // PREMIUM STABLE GOLD PALETTE
  GOLD_PREMIUM: '#FFD700', 
  GOLD_DEEP: '#996515', 
  GOLD_BRIGHT: '#FFF9C4', 
  GOLD_SHINE: '#FFFFFF', 
  GOLD_GLOW: 'rgba(255, 215, 0, 0.6)',
  GOLD_GLOW_SOFT: 'rgba(218, 165, 32, 0.3)',
  BLUE: '#38bdf8',      
  ATMOSPHERE_INNER: 'rgba(56, 189, 248, 0.3)', 
};

const STAR_COUNT = 400; 
const STARS = Array.from({ length: STAR_COUNT }).map((_, i) => ({
  id: i,
  top: `${Math.random() * 100}%`,
  left: `${Math.random() * 100}%`,
  size: Math.random() * 1.5 + 0.3,
  delay: `${Math.random() * 5}s`,
  duration: `${3 + Math.random() * 7}s`,
  opacity: 0.15 + Math.random() * 0.4,
}));

// Increased count and size for better visibility
const PACIFIERS = Array.from({ length: 16 }).map((_, i) => ({
  id: i,
  startX: Math.random() * 100,
  startY: Math.random() * 100,
  size: 16 + Math.random() * 18, // Bigger size
  duration: 15 + Math.random() * 20, // Slower, clearer movement
  driftX: (Math.random() - 0.5) * 140, 
  driftY: (Math.random() - 0.5) * 140,
  rotation: Math.random() * 360,
  rotationSpeed: (Math.random() - 0.5) * 300, 
}));

const PacifierIcon = ({ size, color }: { size: number, color: string }) => (
  <div style={{ position: 'relative', width: size, height: size }}>
    {/* Concentrated, clearer Glow Aura */}
    <div style={{
      position: 'absolute',
      inset: '-15px',
      background: `radial-gradient(circle, ${color}CC 0%, ${color}33 50%, transparent 80%)`,
      borderRadius: '50%',
      filter: 'blur(6px)',
      animation: 'pacifierPulse 6s ease-in-out infinite'
    }} />
    {/* Bright core aura */}
    <div style={{
      position: 'absolute',
      inset: '-6px',
      background: `radial-gradient(circle, white 0%, transparent 70%)`,
      borderRadius: '50%',
      filter: 'blur(3px)',
      opacity: 0.6,
      animation: 'pacifierPulse 6s ease-in-out infinite reverse'
    }} />
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      style={{ 
        filter: `drop-shadow(0 0 10px ${color})`,
        opacity: 1.0 // Fully opaque for visibility
      }}
    >
      <defs>
        <linearGradient id="pacifierGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="50%" stopColor={color} />
          <stop offset="100%" stopColor="#0EA5E9" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="22" r="16" fill="none" stroke="url(#pacifierGrad)" strokeWidth="12" />
      <rect x="8" y="38" width="84" height="22" rx="11" fill="url(#pacifierGrad)" />
      <path fill="url(#pacifierGrad)" d="M35 60 C 35 60, 28 94, 50 94 C 72 94, 65 60, 65 60 Z" />
    </svg>
  </div>
);

const SpaceBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-[#000103]">
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; transform: scale(0.9); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
        @keyframes cometPath {
          0% { transform: translate(0, 0) rotate(0deg); opacity: 0; }
          10% { opacity: 0.9; }
          90% { opacity: 0.9; }
          100% { transform: translate(var(--driftX), var(--driftY)) rotate(var(--rotFull)); opacity: 0; }
        }
        @keyframes pacifierPulse {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.2); opacity: 0.9; }
        }
        @keyframes slowGoldShimmer {
          0% { background-position: 100% 0%; }
          100% { background-position: 0% 100%; }
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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(10,31,94,0.15)_0%,transparent_80%)]"></div>
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
        rotationRef.current[0] += (event.dx / dpr) * 0.25;
        rotationRef.current[1] -= (event.dy / dpr) * 0.25;
        velocityRef.current = [(event.dx / dpr) * 0.3, (event.dy / dpr) * 0.3];
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
      
      const dt = Math.min(time - lastTimeRef.current, 100); 
      lastTimeRef.current = time;
      const timeFactor = dt / 16.67;
      
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      
      const isLarge = w > 1200;
      const cx = isLarge ? w * 0.72 : w * 0.50; 
      const cy = h * 0.50; 
      
      const maxWidthForGlobe = isLarge ? w * 0.54 : w * 0.95;
      const radius = Math.min((maxWidthForGlobe / 2) - 30, (h / 2) - 50);

      ctx.clearRect(0, 0, w, h);
      
      if (!isDraggingRef.current) {
        velocityRef.current[0] += (AUTO_ROTATION_SPEED - velocityRef.current[0]) * 0.04 * timeFactor;
        const targetPhi = MEDITERRANEAN_LATITUDE;
        rotationRef.current[0] += velocityRef.current[0] * timeFactor;
        rotationRef.current[1] += (targetPhi - rotationRef.current[1]) * 0.015 * timeFactor;
        
        velocityRef.current[0] *= Math.pow(FRICTION, timeFactor);
        velocityRef.current[1] *= Math.pow(FRICTION, timeFactor);
      }

      const projection = d3.geoOrthographic()
        .scale(radius)
        .translate([cx, cy])
        .rotate([rotationRef.current[0], rotationRef.current[1], rotationRef.current[2]])
        .clipAngle(90);
        
      const path = d3.geoPath(projection, ctx);
      
      const aura = ctx.createRadialGradient(cx, cy, radius, cx, cy, radius + 85);
      aura.addColorStop(0, COLORS.ATMOSPHERE_INNER);
      aura.addColorStop(0.4, 'rgba(56, 189, 248, 0.05)');
      aura.addColorStop(1, 'transparent');
      ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(cx, cy, radius + 85, 0, Math.PI * 2); ctx.fill();

      const ocean = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx, cy, radius);
      ocean.addColorStop(0, COLORS.OCEAN_BRIGHT);
      ocean.addColorStop(0.6, COLORS.OCEAN_SHALLOW);
      ocean.addColorStop(1, COLORS.OCEAN_DEEP);
      ctx.fillStyle = ocean; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();

      const specular = ctx.createRadialGradient(cx - radius * 0.4, cy - radius * 0.4, 0, cx - radius * 0.4, cy - radius * 0.4, radius * 1.0);
      specular.addColorStop(0, COLORS.SPECULAR);
      specular.addColorStop(1, 'transparent');
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = specular; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      const now = Date.now();
      
      geoDataRef.current.features.forEach((d: any) => {
        const centroid = d3.geoCentroid(d);
        const distance = d3.geoDistance(centroid, [-rotationRef.current[0], -rotationRef.current[1]]);
        
        if (distance < Math.PI / 1.6) { 
          ctx.beginPath(); 
          path(d);
          
          const flashStart = activeFlashes.current.get(d.id);
          const edgeFade = Math.pow(Math.max(0, (distance - (Math.PI / 3.4)) * 3.5), 1.6);
          const shading = 1 - Math.pow(distance / (Math.PI / 1.6), 1.1); 
          
          const isIce = d.id === 'ATA' || d.id === 'GRL';
          const landBase = isIce 
            ? d3.interpolateRgb(COLORS.ICE, '#eef2f7')(1 - shading) 
            : d3.interpolateRgb(COLORS.LAND, COLORS.LAND_LIT)(shading);

          if (flashStart) {
            const elapsed = now - flashStart;
            if (elapsed > 2000) {
              activeFlashes.current.delete(d.id);
              ctx.fillStyle = landBase;
            } else {
              const t = elapsed / 2000;
              const flashCol = d3.interpolateRgb(COLORS.GOLD_PREMIUM, landBase)(t);
              ctx.fillStyle = flashCol;
              ctx.shadowBlur = 45 * (1 - t); 
              ctx.shadowColor = COLORS.GOLD_PREMIUM;
            }
          } else {
            ctx.fillStyle = d3.interpolateRgb(landBase, COLORS.OCEAN_DEEP)(edgeFade);
            ctx.shadowBlur = 0;
          }
          ctx.fill(); 
          
          ctx.strokeStyle = `rgba(255,255,255, ${Math.max(0.2, 0.5 - edgeFade * 0.3)})`; 
          ctx.lineWidth = 1.5; 
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
      <div className="absolute top-10 left-12 md:top-14 md:left-20 z-30 pointer-events-none">
        <div className="flex flex-col items-start w-fit">
          <div className="flex items-baseline font-black tracking-tighter text-3xl md:text-5xl leading-none">
            <span className="text-white">M</span>
            <span className="text-sky-500">&</span>
            <span className="text-white">CC</span>
          </div>
          <div className="w-full h-[3px] md:h-[4px] bg-sky-500 mt-2 shadow-[0_0_15px_rgba(56,189,248,0.6)]"></div>
        </div>
      </div>

      <div className="absolute inset-y-0 left-0 z-20 flex flex-col justify-center pl-12 md:pl-24 pointer-events-none w-full max-w-[45%] transform translate-y-12">
        <div className="flex flex-col items-start gap-1">
          <div className="flex flex-col gap-0 max-w-full">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-3 h-3 rounded-full bg-red-600 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.9)]"></div>
              <span className="text-sky-400 font-bold uppercase tracking-[0.6em] text-[11px] md:text-lg opacity-80">Birth Count Today</span>
            </div>
            
            <div className="flex items-baseline overflow-visible">
              <span 
                className="text-[9vw] font-black leading-none transition-all duration-300 tabular-nums select-all inline-block" 
                style={{ 
                  fontFamily: "'Anton', sans-serif", 
                  // REFINED STABLE GOLD (Removed fast flashing)
                  background: `linear-gradient(to bottom, 
                    ${COLORS.GOLD_BRIGHT} 0%, 
                    ${COLORS.GOLD_PREMIUM} 45%, 
                    ${COLORS.GOLD_DEEP} 100%
                  )`,
                  backgroundSize: '100% 100%',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  // SOLID METALLIC SHADOWS
                  filter: `drop-shadow(0 0 10px ${COLORS.GOLD_GLOW})`
                }}
              >
                {total.toLocaleString('en-US').replace(/,/g, '.')}
              </span>
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="w-full max-w-[480px] mt-1 relative">
            <div className="flex justify-between items-end mb-1 px-1">
              <span className="text-sky-400 font-bold uppercase tracking-widest text-[9px] md:text-[13px] opacity-60">Daily Cycle</span>
              <span className="text-white/40 font-mono text-[10px] md:text-[12px] tabular-nums">{Math.floor(timeState.pct)}%</span>
            </div>
            
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden relative border border-white/10">
              <div 
                className="h-full transition-all duration-1000 ease-linear shadow-[0_0_15px_rgba(255,215,0,0.3)]"
                style={{ 
                  width: `${timeState.pct}%`,
                  background: `linear-gradient(90deg, ${COLORS.GOLD_DEEP} 0%, ${COLORS.GOLD_PREMIUM} 50%, #FFD700 100%)`
                }}
              />
            </div>
            
            {/* Time Marker - Simple White */}
            <div 
              className="absolute top-full flex flex-col items-center transition-all duration-1000 ease-linear"
              style={{ left: `${timeState.pct}%`, transform: 'translateX(-50%)' }}
            >
              <div className="w-px h-1.5 bg-white/40"></div>
              <div className="bg-black/90 backdrop-blur-2xl border border-white/10 px-2.5 py-1 rounded flex items-center shadow-2xl">
                <span className="font-mono text-[10px] md:text-[15px] font-bold tracking-tight whitespace-nowrap tabular-nums text-white">
                  {timeState.label}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Decorative Overlays */}
      <div className="absolute top-0 left-0 w-full h-48 bg-gradient-to-b from-black/100 via-black/40 to-transparent z-10 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-full h-64 bg-gradient-to-t from-black/100 via-black/40 to-transparent z-10 pointer-events-none"></div>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
