import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';

// --- Configuration ---
const BIRTHS_PER_SECOND = 4.35;
const COLORS = {
  LAND: '#334155',      
  ICE: '#f8fafc',       
  OCEAN_DEEP: '#020617',
  OCEAN_SHALLOW: '#1e3a8a',
  OCEAN_BRIGHT: '#3b82f6',
  GOLD: '#FFD700',
  BLUE: '#3b82f6',      
  ATMOSPHERE_INNER: 'rgba(56, 189, 248, 0.22)', 
  PACIFIER_MINT: '#d1fae5',
  PACIFIER_BLUE: '#bfdbfe',
  BOTTLE_GLASS: 'rgba(255, 255, 255, 0.2)',
  BOTTLE_LOGO: '#1e40af'
};

const generateStars = (count: number) => {
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    x: Math.random() * 260 - 80, 
    y: Math.random() * 260 - 80, 
    size: Math.random() * 2.2 + 0.5, 
    duration: Math.random() * 4 + 2,
    delay: Math.random() * 10,
    opacity: Math.random() * 0.7 + 0.2,
    glow: Math.random() > 0.85 
  }));
};

const generateSpaceObjects = (count: number) => {
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    type: Math.random() > 0.35 ? 'PACIFIER' : 'BOTTLE',
    delay: Math.random() * -30,
    duration: Math.random() * 20 + 25,
    size: Math.random() * 12 + 20,
    startX: Math.random() * 100,
    startY: Math.random() * 100,
    rotation: Math.random() * 360,
    color: Math.random() > 0.5 ? COLORS.PACIFIER_MINT : COLORS.PACIFIER_BLUE
  }));
};

const PacifierIcon: React.FC<{ color: string, size: number }> = ({ color, size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ filter: `drop-shadow(0 0 10px ${color})` }}>
    <circle cx="50" cy="80" r="15" fill="none" stroke={color} strokeWidth="8" opacity="0.8" />
    <rect x="15" y="40" width="70" height="30" rx="15" fill={color} />
    <circle cx="50" cy="30" r="20" fill="white" opacity="0.5" />
    <circle cx="50" cy="55" r="6" fill="rgba(0,0,0,0.1)" />
  </svg>
);

const BottleIcon: React.FC<{ size?: number; className?: string; style?: React.CSSProperties }> = ({ size, className, style }) => (
  <svg 
    width={size ? size : undefined} 
    height={size ? size * 1.5 : undefined} 
    viewBox="0 0 100 150" 
    className={className} 
    style={{ ...style, filter: 'drop-shadow(0 0 15px rgba(255,255,255,0.2))' }}
  >
    <path d="M30 35 Q50 0 70 35 L75 55 L25 55 Z" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
    <path d="M45 10 Q50 0 55 10 L55 20 Q50 25 45 20 Z" fill="rgba(255,255,255,0.4)" />
    <rect x="20" y="55" width="60" height="15" rx="4" fill="#ffffff" />
    <rect x="18" y="68" width="64" height="4" rx="1" fill="#e2e8f0" />
    <path d="M22 72 L78 72 Q88 72 88 85 L88 135 Q88 148 72 148 L28 148 Q12 148 12 135 L12 85 Q12 72 22 72" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
    <g transform="translate(35, 95) scale(0.6)">
       <path d="M10 40 Q20 40 25 30 L35 30 Q45 30 45 45 L45 55 Q45 65 35 65 L15 65 Q5 65 5 55 L5 45 Q5 40 10 40" fill="#84cc16" />
       <circle cx="15" cy="48" r="3" fill="white" />
       <circle cx="15" cy="48" r="1.5" fill="black" />
       <path d="M45 45 Q55 35 60 45" fill="none" stroke="#84cc16" strokeWidth="4" />
       <path d="M20 65 L18 75 M30 65 L32 75" stroke="#84cc16" strokeWidth="3" />
    </g>
    <path d="M14 110 L86 110 L86 135 Q86 146 72 146 L28 146 Q14 146 14 135 Z" fill="rgba(255,255,255,0.3)" />
  </svg>
);

const SpaceBackground: React.FC = () => {
  const stars = useMemo(() => generateStars(1000), []);
  const spaceObjects = useMemo(() => generateSpaceObjects(10), []);
  
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-black">
      <style>{`
        @keyframes drift-move {
          0% { transform: translate(-30vw, -30vh) rotate(var(--start-rot)); opacity: 0; }
          10% { opacity: 0.7; }
          90% { opacity: 0.7; }
          100% { transform: translate(130vw, 130vh) rotate(calc(var(--start-rot) + 360deg)); opacity: 0; }
        }
        .space-object {
          position: absolute;
          animation: drift-move linear infinite;
        }
        @keyframes rotate-bg {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes star-twinkle {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.2); }
        }
      `}</style>
      
      <div className="absolute top-1/2 left-1/2 w-[240vw] h-[240vw]" style={{ animation: 'rotate-bg 800s linear infinite' }}>
        {stars.map(s => (
          <div key={s.id} style={{
            position: 'absolute',
            left: `${s.x}%`, top: `${s.y}%`, 
            width: `${s.size}px`, height: `${s.size}px`,
            backgroundColor: '#fff',
            borderRadius: '50%',
            opacity: s.opacity,
            boxShadow: s.glow ? `0 0 ${s.size * 4}px rgba(255, 255, 255, 0.8)` : 'none',
            animation: `star-twinkle ${s.duration}s ease-in-out infinite`,
            animationDelay: `${s.delay}s`
          }} />
        ))}
      </div>

      {spaceObjects.map(obj => (
        <div 
          key={obj.id} 
          className="space-object flex items-center justify-center"
          style={{
            left: `${obj.startX}%`,
            top: `${obj.startY}%`,
            animationDuration: `${obj.duration}s`,
            animationDelay: `${obj.delay}s`,
            '--start-rot': `${obj.rotation}deg`
          } as any}
        >
          {obj.type === 'PACIFIER' ? (
            <PacifierIcon color={obj.color} size={obj.size} />
          ) : (
            <BottleIcon size={obj.size * 1.2} />
          )}
        </div>
      ))}
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
      .then(data => { geoDataRef.current = data; })
      .catch(err => console.error("Globe data error:", err));
  }, []);

  useEffect(() => {
    if (lastFlash) activeFlashes.current.set(lastFlash, Date.now());
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
      const isMobile = w < 768;
      
      const radius = isMobile 
        ? Math.min(w * 0.44, h * 0.28) 
        : Math.min(w * 0.32, h * 0.42);
      
      // SHIFT GLOBE TO THE RIGHT ON DESKTOP
      const cx = isMobile ? w * 0.5 : w * 0.65; 
      const cy = isMobile ? h * 0.44 : h * 0.5;

      ctx.clearRect(0, 0, w, h);
      rotationRef.current[0] += 0.4;

      const projection = d3.geoOrthographic()
        .scale(radius)
        .translate([cx, cy])
        .rotate(rotationRef.current)
        .clipAngle(90);
        
      const path = d3.geoPath(projection, ctx);
      
      // Atmosphere
      const glowRadius = radius + (isMobile ? 50 : 80);
      const glow = ctx.createRadialGradient(cx, cy, radius, cx, cy, glowRadius);
      glow.addColorStop(0, COLORS.ATMOSPHERE_INNER);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2); ctx.fill();

      // Ocean
      const oceanGrad = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx, cy, radius);
      oceanGrad.addColorStop(0, COLORS.OCEAN_BRIGHT);
      oceanGrad.addColorStop(0.4, COLORS.OCEAN_SHALLOW);
      oceanGrad.addColorStop(1, COLORS.OCEAN_DEEP);
      ctx.fillStyle = oceanGrad; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();

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
            if (elapsed > 1500) {
              activeFlashes.current.delete(d.id);
              ctx.fillStyle = isIce ? COLORS.ICE : COLORS.LAND;
            } else {
              const t = elapsed / 1500;
              ctx.fillStyle = elapsed < 50 ? '#fff' : d3.interpolateRgb(COLORS.GOLD, isIce ? COLORS.ICE : COLORS.LAND)(t);
              ctx.shadowBlur = (isMobile ? 25 : 50) * (1 - t); ctx.shadowColor = COLORS.GOLD;
            }
          } else {
            ctx.fillStyle = isIce ? COLORS.ICE : COLORS.LAND;
            ctx.shadowBlur = 0;
          }
          ctx.fill(); 
          ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 0.5; ctx.stroke();
        }
      });

      // Shadow
      const rimGrad = ctx.createRadialGradient(cx, cy, radius * 0.75, cx, cy, radius);
      rimGrad.addColorStop(0, 'transparent');
      rimGrad.addColorStop(1, 'rgba(0,0,0,0.65)');
      ctx.fillStyle = rimGrad; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();

      animId = requestAnimationFrame(render);
    };

    const resize = () => {
      canvas.width = window.innerWidth * dpr; 
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    window.addEventListener('resize', resize); resize(); render();
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(animId); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 z-10 pointer-events-none" />;
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
      setTimeState({ label: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }), pct });
    };
    
    updateProgress();
    const clockInterval = setInterval(updateProgress, 1000);
    
    let spawnTimeoutId: any;
    const spawn = () => {
      spawnTimeoutId = setTimeout(() => {
        countRef.current += 1; 
        setTotal(countRef.current);
        const countries = ['IND', 'CHN', 'NGA', 'PAK', 'IDN', 'BRA', 'USA', 'BGD', 'ETH', 'MEX', 'PHL', 'COD', 'EGY', 'RUS', 'VNM', 'TUR', 'IRN', 'THA', 'FRA', 'GBR', 'DEU', 'ITA', 'ZAF', 'COL', 'ESP', 'ARG', 'CAN', 'AUS'];
        setFlashId(countries[Math.floor(Math.random() * countries.length)]);
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
      
      {/* UI Overlay */}
      <div className="absolute inset-0 z-20 flex flex-col justify-center px-6 md:px-24 pointer-events-none">
        <div className="w-fit flex flex-col items-center md:items-start gap-0">
          <h1 className="font-black tracking-[0.1em] md:tracking-[0.2em] text-[24px] md:text-[38px] opacity-100 mb-4 uppercase leading-[0.95] text-center md:text-left" style={{ color: COLORS.BLUE }}>
            Global Births<br />Today
          </h1>
          
          <div className="relative flex flex-row items-baseline justify-center md:justify-start text-center md:text-left mb-4">
            <span 
              className="text-[18vw] md:text-[11vw] font-black tabular-nums tracking-[-0.03em] leading-none" 
              style={{ 
                color: COLORS.GOLD, 
                textShadow: '0 0 40px rgba(255,215,0,0.3)',
                fontFamily: "'Anton', sans-serif"
              }}
            >
              {total.toLocaleString('en-US').replace(/,/g, '.')}
            </span>
          </div>

          {/* Progress Bar UI - Width matches the numbers container above */}
          <div className="w-full relative flex flex-col gap-0.5">
             {/* Single Color Progress Bar */}
             <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 relative">
                <div className="absolute inset-0 opacity-10" style={{ backgroundColor: COLORS.GOLD }} />
                <div 
                  className="h-full rounded-full transition-all duration-1000 ease-linear relative z-10 shadow-[0_0_20px_rgba(255,215,0,0.5)]" 
                  style={{ 
                    width: `${timeState.pct}%`,
                    backgroundColor: COLORS.GOLD 
                  }} 
                />
             </div>

             {/* HH:MM Tooltip Below Bar */}
             <div className="h-12 w-full relative">
                <div 
                  className="absolute top-1 flex flex-col items-center transition-all duration-1000 ease-linear" 
                  style={{ 
                    left: `${timeState.pct}%`, 
                    transform: 'translateX(-50%)' 
                  }}
                >
                  <div className="w-px h-3 bg-white/20"></div>
                  <div className="bg-[#111827] border border-white/10 px-4 py-2 rounded-xl shadow-2xl flex items-center justify-center min-w-[85px]">
                    <span className="text-white font-mono text-[14px] md:text-[16px] font-bold tracking-tight">{timeState.label}</span>
                  </div>
                </div>
             </div>
          </div>
        </div>
      </div>

      <div className="absolute top-8 left-8 md:top-12 md:left-24 z-30 pointer-events-none opacity-80">
        <div className="flex items-center gap-2">
          <p className="font-black text-base md:text-2xl tracking-tighter text-white">EARTH<span style={{ color: COLORS.GOLD }}>PULSE</span></p>
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