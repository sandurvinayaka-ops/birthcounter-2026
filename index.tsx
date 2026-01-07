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
  ATMOSPHERE_INNER: 'rgba(56, 189, 248, 0.28)', 
  GRATICULE: 'rgba(255, 255, 255, 0.02)',
  PACIFIER_MINT: '#d1fae5',
  PACIFIER_BLUE: '#bfdbfe',
  BOTTLE_WHITE: '#ffffff',
  BOTTLE_BLUE: '#1e40af'
};

const generateStars = (count: number) => {
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    x: Math.random() * 240 - 70, 
    y: Math.random() * 240 - 70, 
    size: Math.random() * 2.2 + 0.6, 
    duration: Math.random() * 4 + 2,
    delay: Math.random() * 10,
    opacity: Math.random() * 0.8 + 0.2,
    glow: Math.random() > 0.8 
  }));
};

const generateSpaceObjects = (count: number) => {
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    type: Math.random() > 0.4 ? 'PACIFIER' : 'BOTTLE',
    delay: Math.random() * -20,
    duration: Math.random() * 15 + 25,
    size: Math.random() * 15 + 25,
    startX: Math.random() * 100,
    startY: Math.random() * 100,
    rotation: Math.random() * 360,
    color: Math.random() > 0.5 ? COLORS.PACIFIER_MINT : COLORS.PACIFIER_BLUE
  }));
};

const PacifierIcon: React.FC<{ color: string, size: number }> = ({ color, size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ filter: `drop-shadow(0 0 12px ${color})` }}>
    <circle cx="50" cy="80" r="15" fill="none" stroke={color} strokeWidth="8" opacity="0.9" />
    <rect x="15" y="40" width="70" height="30" rx="15" fill={color} />
    <circle cx="50" cy="30" r="20" fill="white" opacity="0.6" />
    <circle cx="50" cy="55" r="6" fill="rgba(0,0,0,0.15)" />
  </svg>
);

const BottleIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size * 1.5} viewBox="0 0 100 150" style={{ filter: 'drop-shadow(0 0 15px rgba(255,255,255,0.3))' }}>
    {/* Nipple */}
    <path d="M35 20 Q50 0 65 20 L65 35 Q50 45 35 35 Z" fill="#fef3c7" opacity="0.9" />
    {/* Cap Ring */}
    <rect x="25" y="35" width="50" height="15" rx="5" fill="#f8fafc" />
    <rect x="20" y="50" width="60" height="10" rx="2" fill="#e2e8f0" />
    {/* Body */}
    <path d="M25 60 L75 60 Q85 60 85 75 L85 130 Q85 145 70 145 L30 145 Q15 145 15 130 L15 75 Q15 60 25 60" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
    {/* Liquid inside */}
    <path d="M17 100 L83 100 L83 130 Q83 143 70 143 L30 143 Q17 143 17 130 Z" fill="rgba(255,255,255,0.4)" />
    {/* Logo area */}
    <text x="50" y="115" fontSize="8" fontWeight="900" textAnchor="middle" fill="#1e40af" fontFamily="sans-serif">PHILIPS</text>
    <text x="50" y="130" fontSize="12" fontWeight="900" textAnchor="middle" fill="#1e40af" fontFamily="sans-serif">AVENT</text>
  </svg>
);

const SpaceBackground: React.FC = () => {
  const stars = useMemo(() => generateStars(800), []);
  const spaceObjects = useMemo(() => generateSpaceObjects(12), []);
  
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-black">
      <style>{`
        @keyframes drift-move {
          0% { transform: translate(-30vw, -30vh) rotate(var(--start-rot)); opacity: 0; }
          15% { opacity: 0.7; }
          85% { opacity: 0.7; }
          100% { transform: translate(130vw, 130vh) rotate(calc(var(--start-rot) + 360deg)); opacity: 0; }
        }
        .space-object {
          position: absolute;
          animation: drift-move linear infinite;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        @keyframes rotate-bg {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes star-twinkle {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.3); }
        }
      `}</style>
      
      <div className="absolute inset-0">
        <div className="absolute top-[-15%] right-[-10%] w-[110vw] h-[110vw] bg-blue-900/10 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute bottom-[-15%] left-[-15%] w-[90vw] h-[90vw] bg-purple-900/10 rounded-full blur-[120px]" />
      </div>
      
      <div className="absolute top-1/2 left-1/2 w-[240vw] h-[240vw]" style={{ animation: 'rotate-bg 600s linear infinite' }}>
        {stars.map(s => (
          <div key={s.id} style={{
            position: 'absolute',
            left: `${s.x}%`, 
            top: `${s.y}%`, 
            width: `${s.size}px`, 
            height: `${s.size}px`,
            backgroundColor: s.glow ? '#e0f2fe' : '#ffffff',
            borderRadius: '50%',
            opacity: s.opacity,
            boxShadow: s.glow ? `0 0 ${s.size * 4}px rgba(255, 255, 255, 1)` : 'none',
            animation: `star-twinkle ${s.duration}s ease-in-out infinite`,
            animationDelay: `${s.delay}s`
          }} />
        ))}
      </div>

      {spaceObjects.map(obj => (
        <div 
          key={obj.id} 
          className="space-object"
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
            <BottleIcon size={obj.size * 1.3} />
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
      // Responsive scale: prioritize filling space but keeping center
      const radius = isMobile 
        ? Math.min(w * 0.42, h * 0.3) 
        : Math.min(w * 0.28, h * 0.38);
      
      const cx = w * 0.5; 
      // Offset cy slightly higher on mobile to make room for text below if needed
      const cy = isMobile ? h * 0.45 : h * 0.5;

      ctx.clearRect(0, 0, w, h);
      rotationRef.current[0] += 0.45;

      const projection = d3.geoOrthographic()
        .scale(radius)
        .translate([cx, cy])
        .rotate(rotationRef.current)
        .clipAngle(90);
        
      const path = d3.geoPath(projection, ctx);
      
      // Atmospheric Glow
      const glowRadius = radius + (isMobile ? 60 : 100);
      const glow = ctx.createRadialGradient(cx, cy, radius, cx, cy, glowRadius);
      glow.addColorStop(0, COLORS.ATMOSPHERE_INNER);
      glow.addColorStop(0.3, 'rgba(56, 189, 248, 0.08)');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2); ctx.fill();

      // Ocean Base
      const oceanGrad = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx, cy, radius);
      oceanGrad.addColorStop(0, COLORS.OCEAN_BRIGHT);
      oceanGrad.addColorStop(0.3, COLORS.OCEAN_SHALLOW);
      oceanGrad.addColorStop(0.8, COLORS.OCEAN_DEEP);
      oceanGrad.addColorStop(1, '#000000');
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
            if (elapsed > 1200) {
              activeFlashes.current.delete(d.id);
              ctx.fillStyle = isIce ? COLORS.ICE : COLORS.LAND;
            } else {
              const t = elapsed / 1200;
              ctx.fillStyle = elapsed < 60 ? '#fff' : d3.interpolateRgb(COLORS.GOLD, isIce ? COLORS.ICE : COLORS.LAND)(t);
              ctx.shadowBlur = (isMobile ? 30 : 60) * (1 - t); ctx.shadowColor = COLORS.GOLD;
            }
          } else {
            ctx.fillStyle = isIce ? COLORS.ICE : COLORS.LAND;
            ctx.shadowBlur = 0;
          }
          ctx.fill(); 
          
          ctx.shadowBlur = 0;
          ctx.strokeStyle = 'rgba(255,255,255,0.05)'; 
          ctx.lineWidth = 0.5; 
          ctx.stroke();
        }
      });

      // Shading / Depth
      const rimGrad = ctx.createRadialGradient(cx, cy, radius * 0.7, cx, cy, radius);
      rimGrad.addColorStop(0, 'transparent');
      rimGrad.addColorStop(1, 'rgba(0,0,0,0.6)');
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
    <div className="relative w-full h-full select-none overflow-hidden bg-black flex flex-col">
      <SpaceBackground />
      <Globe lastFlash={flashId} />
      
      <div className="absolute inset-0 z-20 flex flex-col justify-center px-6 md:px-20 pointer-events-none">
        <div className="w-full md:w-[45%] flex flex-col items-center md:items-start gap-0 drop-shadow-2xl">
          <h1 className="font-bold tracking-[0.4em] md:tracking-[0.6em] text-[10px] md:text-[11px] opacity-70 mb-2 uppercase" style={{ color: COLORS.BLUE }}>
            Birth count today
          </h1>
          
          <div className="relative flex flex-col text-center md:text-left">
            <span className="text-[14vw] md:text-[6.5vw] font-black tabular-nums tracking-tighter leading-none" style={{ color: COLORS.GOLD, textShadow: '0 0 40px rgba(255,215,0,0.15)' }}>
              {total.toLocaleString('de-DE')}
            </span>
          </div>

          <div className="w-full max-w-[85vw] md:max-w-[24vw] mt-8 relative">
             <div className="h-8 w-full relative mb-1">
                <div className="absolute bottom-0 -translate-x-1/2 flex flex-col items-center transition-all duration-1000 linear" style={{ left: `${timeState.pct}%` }}>
                  <div className="bg-white/5 backdrop-blur-3xl border border-white/10 px-2 py-0.5 rounded shadow-xl">
                    <span className="text-white font-mono text-[9px] font-black tracking-widest">{timeState.label}</span>
                  </div>
                </div>
             </div>
             
             <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 backdrop-blur-sm">
                <div className="h-full bg-gradient-to-r from-blue-500 via-amber-300 to-rose-500 rounded-full transition-all duration-1000 linear" style={{ width: `${timeState.pct}%` }} />
             </div>
          </div>
        </div>
      </div>

      <div className="absolute top-6 left-6 md:top-10 md:left-20 z-30 pointer-events-none opacity-60">
        <div className="flex items-center gap-3">
          <p className="font-black text-sm md:text-xl tracking-tighter text-white">EARTH<span style={{ color: COLORS.GOLD }}>PULSE</span></p>
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