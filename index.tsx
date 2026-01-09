
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';

// --- Configuration ---
const BIRTHS_PER_SECOND = 4.352; 
const AUTO_ROTATION_SPEED = 0.12; // Slightly slowed for smoother perceived motion
const FRICTION = 0.98; // Less friction for longer, smoother coasting
const INITIAL_PHI = -25; 
const COLORS = {
  LAND: '#1e293b',      
  LAND_LIT: '#475569',  
  ICE: '#ffffff',       
  OCEAN_DEEP: '#08132b', 
  OCEAN_SHALLOW: '#1e3a8a', 
  OCEAN_BRIGHT: '#3b82f6',  
  SPECULAR: 'rgba(255, 255, 255, 0.35)', 
  GOLD_SOLID: '#facc15', 
  GOLD_DEEP: '#a16207',
  GOLD_GLOW: 'rgba(250, 204, 21, 0.8)', 
  BLUE_ATMOSPHERE: '#0ea5e9', 
  ATMOSPHERE_INNER: 'rgba(56, 189, 248, 0.4)', 
};

// --- Background Stars ---
const STAR_COUNT = 400; 
const STARS = Array.from({ length: STAR_COUNT }).map((_, i) => ({
  id: i,
  top: `${Math.random() * 100}%`,
  left: `${Math.random() * 100}%`,
  size: Math.random() * 2.2 + 0.5, 
  delay: `${Math.random() * 5}s`,
  duration: `${4 + Math.random() * 6}s`,
  opacity: 0.4 + Math.random() * 0.5,
}));

// --- Comet Data (Mixed Philips Teats & New Lavender Pacifiers) ---
const COMET_COUNT = 12; // Increased slightly since they are smaller
const COMET_DATA = Array.from({ length: COMET_COUNT }).map((_, i) => ({
  id: i,
  type: Math.random() > 0.5 ? 'teat' : 'pacifier',
  size: 14 + Math.random() * 12, // Reduced size as requested
  duration: 20 + Math.random() * 25,
  delay: Math.random() * -30,
  orbitRadiusX: 22 + Math.random() * 20, 
  orbitRadiusY: 12 + Math.random() * 28, 
  rotationSpeed: (Math.random() - 0.5) * 3, 
  initialTilt: Math.random() * 360, 
  randomAxis: Math.random() > 0.5 ? 'reverse' : 'normal', 
  startAngle: Math.random() * 360,
  clockwise: Math.random() > 0.5,
}));

// --- Philips Natural Teat SVG ---
const TeatSVG = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.9))' }}>
    <defs>
      <linearGradient id="t-silicone" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="rgba(255,255,255,1)" />
        <stop offset="60%" stopColor="rgba(255,255,255,0.7)" />
        <stop offset="100%" stopColor="rgba(220,240,255,0.5)" />
      </linearGradient>
    </defs>
    <path d="M10,85 Q50,98 90,85 L92,78 Q50,91 8,78 Z" fill="url(#t-silicone)" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
    <path d="M22,75 Q50,65 78,75 C78,55 65,48 62,38 C62,22 58,10 50,10 C42,10 38,22 38,38 C35,48 22,55 22,75 Z" fill="rgba(255,255,255,0.5)" stroke="rgba(255,255,255,0.8)" strokeWidth="1" />
    <ellipse cx="50" cy="58" rx="10" ry="5" fill="rgba(255,255,255,0.3)" />
    <path d="M44,14 Q50,11 56,14" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
  </svg>
);

// --- Philips Avent Ultra Air Pacifier (Lavender) SVG ---
const PacifierSVG = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 140 120" style={{ filter: 'drop-shadow(0 0 8px rgba(210,192,255,0.8))' }}>
    <defs>
      <linearGradient id="shieldLavender" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#efebff" />
        <stop offset="100%" stopColor="#dcd0ff" />
      </linearGradient>
      <radialGradient id="nippleGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="rgba(255,255,255,1)" />
        <stop offset="100%" stopColor="rgba(255,255,255,0.4)" />
      </radialGradient>
    </defs>
    
    <path 
      d="M10,60 C10,35 45,30 70,30 C95,30 130,35 130,60 C130,100 100,115 70,115 C40,115 10,100 10,60 Z" 
      fill="url(#shieldLavender)" 
      stroke="rgba(255,255,255,0.7)"
      strokeWidth="2"
    />
    
    <path d="M25,55 C25,45 50,45 55,50 L55,85 C50,95 25,95 25,80 Z" fill="#fff" opacity="0.3" />
    <path d="M115,55 C115,45 90,45 85,50 L85,85 C90,95 115,95 115,80 Z" fill="#fff" opacity="0.3" />

    <ellipse cx="70" cy="65" rx="32" ry="28" fill="#e9e1ff" stroke="#ffffff" strokeWidth="2" />
    
    <path 
      d="M50,45 Q70,25 90,45 C90,15 80,5 70,5 C60,5 50,15 50,45 Z" 
      fill="url(#nippleGrad)" 
      stroke="rgba(255,255,255,0.8)"
      strokeWidth="1"
    />
    
    <path d="M50,45 Q70,35 90,45" fill="none" stroke="#ffffff" strokeWidth="3" opacity="0.6" strokeLinecap="round" />
  </svg>
);

const CometRenderer = ({ type, size, rotationSpeed, initialTilt, direction }: { type: string, size: number, rotationSpeed: number, initialTilt: number, direction: string }) => (
  <div style={{ 
    position: 'relative', 
    width: size, 
    height: size, 
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    transform: `rotate(${initialTilt}deg)`
  }}>
    {/* Cinematic Glowing Comet Trail */}
    <div style={{
      position: 'absolute',
      width: '180%',
      height: '400%',
      top: '50%',
      background: `radial-gradient(ellipse at center, rgba(255,255,255,0.6) 0%, rgba(14,165,233,0.3) 40%, transparent 80%)`,
      filter: 'blur(15px)',
      opacity: 0.7,
      borderRadius: '50% 50% 0 0',
      transform: 'rotate(180deg) translateY(10%)'
    }} />
    
    <div className="animate-spin-custom" style={{ 
      animationDuration: `${10 + Math.abs(rotationSpeed) * 12}s`,
      animationDirection: direction === 'reverse' ? 'reverse' : 'normal'
    }}>
       {type === 'pacifier' ? <PacifierSVG size={size} /> : <TeatSVG size={size} />}
    </div>
  </div>
);

const CometForeground: React.FC<{ globeCenter: { x: number, y: number } }> = ({ globeCenter }) => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[20]">
      <style>{`
        @keyframes orbit {
          from { transform: translate(-50%, -50%) rotate(var(--startAngle)) translateX(var(--radiusX)) rotate(calc(-1 * var(--startAngle))); }
          to { transform: translate(-50%, -50%) rotate(calc(var(--startAngle) + var(--direction))) translateX(var(--radiusX)) rotate(calc(-1 * (var(--startAngle) + var(--direction)))); }
        }
        @keyframes spin-custom {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .comet-orbit-wrapper {
          position: absolute;
          animation: orbit var(--duration) linear infinite;
        }
        .animate-spin-custom {
          animation: spin-custom linear infinite;
        }
      `}</style>
      {COMET_DATA.map((c) => (
        <div
          key={c.id}
          className="comet-orbit-wrapper"
          style={{
            left: `${globeCenter.x}px`,
            top: `${globeCenter.y}px`,
            // @ts-ignore
            '--radiusX': `${c.orbitRadiusX}vw`,
            '--duration': `${c.duration}s`,
            '--startAngle': `${c.startAngle}deg`,
            '--direction': c.clockwise ? '360deg' : '-360deg'
          }}
        >
          <CometRenderer 
            type={c.type}
            size={c.size} 
            rotationSpeed={c.rotationSpeed} 
            initialTilt={c.initialTilt}
            direction={c.randomAxis}
          />
        </div>
      ))}
    </div>
  );
};

const SpaceBackground: React.FC = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-[#000103]">
    <style>{`
      @keyframes twinkle {
        0%, 100% { opacity: 0.4; transform: scale(0.9); }
        50% { opacity: 0.95; transform: scale(1.1); }
      }
      .star {
        position: absolute;
        background: white;
        border-radius: 50%;
        animation: twinkle var(--duration) ease-in-out infinite;
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
  </div>
);

const Globe: React.FC<{ lastFlash: string | null, onPositionUpdate: (pos: {x: number, y: number}) => void }> = ({ lastFlash, onPositionUpdate }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const geoDataRef = useRef<any>(null);
  const rotationRef = useRef<[number, number, number]>([0, INITIAL_PHI, 0]); 
  const velocityRef = useRef<[number, number]>([0, 0]); 
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
      .on('start', () => { isDraggingRef.current = true; canvas.style.cursor = 'grabbing'; })
      .on('drag', (event) => {
        rotationRef.current[0] += (event.dx / dpr) * 0.25;
        rotationRef.current[1] -= (event.dy / dpr) * 0.25;
        // Boost velocity for smoother feeling throw
        velocityRef.current = [(event.dx / dpr) * 0.4, (event.dy / dpr) * 0.4];
      })
      .on('end', () => { isDraggingRef.current = false; canvas.style.cursor = 'grab'; });

    d3.select(canvas).call(drag);

    const render = (time: number) => {
      if (!geoDataRef.current) {
        animId = requestAnimationFrame(render);
        return;
      }
      
      const dt = time - lastTimeRef.current;
      lastTimeRef.current = time;
      
      // Target 60fps smoothing factor
      const timeFactor = Math.min(dt / 16.66667, 3); 
      
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const isLarge = w > 1024;
      
      const radius = h * 0.32;
      const boundaryX = w * 0.28; 
      const gap = w * 0.04; 
      let cx = boundaryX + radius + gap;
      
      const safeRightMargin = w * 0.08;
      const maxCX = w - radius - safeRightMargin;
      if (cx > maxCX) cx = maxCX;

      if (!isLarge) cx = w / 2;

      const verticalOffset = 70; 
      const cy = (h / 2) - verticalOffset;
      
      onPositionUpdate({ x: cx, y: cy });

      ctx.clearRect(0, 0, w, h);
      
      if (!isDraggingRef.current) {
        // Constant smooth rotation
        rotationRef.current[0] += AUTO_ROTATION_SPEED * timeFactor;
        
        // Momentum decay
        if (Math.abs(velocityRef.current[0]) > 0.001 || Math.abs(velocityRef.current[1]) > 0.001) {
            rotationRef.current[0] += velocityRef.current[0] * timeFactor;
            rotationRef.current[1] -= velocityRef.current[1] * timeFactor;
            velocityRef.current[0] *= Math.pow(FRICTION, timeFactor);
            velocityRef.current[1] *= Math.pow(FRICTION, timeFactor);
        }
        
        // Gentle snap back to initial vertical tilt
        const diff = INITIAL_PHI - rotationRef.current[1];
        rotationRef.current[1] += diff * 0.012 * timeFactor;
      }

      const projection = d3.geoOrthographic()
        .scale(radius)
        .translate([cx, cy])
        .rotate([rotationRef.current[0], rotationRef.current[1], rotationRef.current[2]])
        .clipAngle(90);
        
      const path = d3.geoPath(projection, ctx);
      
      const auraRadius = radius * 1.15;
      const aura = ctx.createRadialGradient(cx, cy, radius, cx, cy, auraRadius);
      aura.addColorStop(0, COLORS.ATMOSPHERE_INNER);
      aura.addColorStop(0.5, 'rgba(56, 189, 248, 0.1)'); 
      aura.addColorStop(1, 'transparent');
      ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(cx, cy, auraRadius, 0, Math.PI * 2); ctx.fill();

      const ocean = ctx.createRadialGradient(cx - radius * 0.2, cy - radius * 0.2, radius * 0.05, cx, cy, radius);
      ocean.addColorStop(0, COLORS.OCEAN_BRIGHT);
      ocean.addColorStop(0.6, COLORS.OCEAN_SHALLOW);
      ocean.addColorStop(1, COLORS.OCEAN_DEEP);
      ctx.fillStyle = ocean; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();

      const specular = ctx.createRadialGradient(cx - radius * 0.35, cy - radius * 0.35, 0, cx - radius * 0.35, cy - radius * 0.35, radius * 1.1);
      specular.addColorStop(0, COLORS.SPECULAR);
      specular.addColorStop(1, 'transparent');
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = specular; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      const now = Date.now();
      
      geoDataRef.current.features.forEach((d: any) => {
        const centroid = d3.geoCentroid(d);
        const distance = d3.geoDistance(centroid, [-rotationRef.current[0], -rotationRef.current[1]]);
        
        if (distance < Math.PI / 1.5) { 
          ctx.beginPath(); 
          path(d);
          
          const flashStart = activeFlashes.current.get(d.id);
          const edgeFade = Math.pow(Math.max(0, (distance - (Math.PI / 3.6)) * 4), 1.6);
          const shading = 1 - Math.pow(distance / (Math.PI / 1.5), 1.2); 
          
          if (flashStart) {
            const elapsed = now - flashStart;
            if (elapsed > 2000) {
              activeFlashes.current.delete(d.id);
              ctx.fillStyle = COLORS.LAND;
            } else {
              const t = elapsed / 2000;
              const flashCol = d3.interpolateRgb(COLORS.GOLD_SOLID, COLORS.LAND)(t);
              ctx.fillStyle = flashCol;
              ctx.shadowBlur = 50 * (1 - t); 
              ctx.shadowColor = COLORS.GOLD_SOLID;
            }
          } else {
            const landBase = d3.interpolateRgb(COLORS.LAND, COLORS.LAND_LIT)(shading);
            ctx.fillStyle = d3.interpolateRgb(landBase, COLORS.OCEAN_DEEP)(Math.min(1, edgeFade));
            ctx.shadowBlur = 0;
          }
          ctx.fill(); 
          ctx.strokeStyle = `rgba(255,255,255, ${Math.max(0.15, 0.35 - edgeFade * 0.2)})`; 
          ctx.lineWidth = 0.6; 
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
  }, [onPositionUpdate]);

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
  const [globeCenter, setGlobeCenter] = useState({ x: 0, y: 0 });
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
        const countries = ['IND', 'CHN', 'NGA', 'PAK', 'IDN', 'BRA', 'USA', 'BGD', 'ETH', 'MEX', 'PHL', 'COD', 'EGY', 'RUS', 'FRA', 'DEU', 'TUR', 'VNM', 'IRN', 'THA'];
        setFlashId(countries[Math.floor(Math.random() * countries.length)]);
        spawn();
      }, -Math.log(Math.random()) * (1000 / BIRTHS_PER_SECOND));
    };
    spawn();
    
    return () => { clearInterval(clockInterval); clearTimeout(spawnTimeoutId); };
  }, []);

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-black flex flex-col font-sans">
      <SpaceBackground />
      <Globe lastFlash={flashId} onPositionUpdate={setGlobeCenter} />
      <CometForeground globeCenter={globeCenter} />
      
      {/* Branding */}
      <div className="absolute top-8 left-10 md:top-10 md:left-14 z-40 pointer-events-none">
        <div className="flex flex-col items-start w-fit">
          <div className="flex items-baseline font-black tracking-tighter text-2xl md:text-3xl lg:text-4xl leading-none">
            <span className="text-white">M</span>
            <span className="text-white">&</span>
            <span className="text-white">CC</span>
          </div>
          <div className="w-full h-[3px] bg-sky-500 mt-1.5 shadow-[0_0_12px_rgba(14,165,233,0.7)]"></div>
        </div>
      </div>

      <div className="absolute inset-y-0 left-0 z-40 flex flex-col justify-center pl-10 md:pl-16 pointer-events-none w-full max-w-[34%]">
        <div className="flex flex-col items-start gap-0">
          
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.8)] animate-pulse"></div>
            <span className="text-sky-400 font-bold uppercase tracking-[0.3em] text-[10px] md:text-base opacity-90">Live Birth Count</span>
          </div>
          
          <div className="flex items-baseline mb-4">
            <span 
              className="text-[8vw] font-black leading-none tabular-nums inline-block" 
              style={{ 
                fontFamily: "'Anton', sans-serif", 
                color: COLORS.GOLD_SOLID,
                textShadow: `0 3px 0 ${COLORS.GOLD_DEEP}, 0 8px 24px rgba(0,0,0,0.95), 0 0 12px rgba(250,204,21,0.25)`
              }}
            >
              {total.toLocaleString('en-US').replace(/,/g, '.')}
            </span>
          </div>

          <div className="w-full max-w-[420px] relative">
            <div className="flex justify-between items-end mb-1 px-1">
              <span className="text-sky-400 font-black uppercase tracking-[0.15em] text-[8px] md:text-[11px] opacity-70">DAY Progress</span>
              <span className="text-white/40 font-mono text-[8px] md:text-[11px] tabular-nums font-bold tracking-widest">{Math.floor(timeState.pct)}%</span>
            </div>
            
            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden relative border border-white/5 shadow-inner">
              <div 
                className="h-full rounded-full transition-all duration-1000 ease-linear"
                style={{ 
                  width: `${timeState.pct}%`,
                  background: `linear-gradient(90deg, ${COLORS.GOLD_DEEP} 0%, ${COLORS.GOLD_SOLID} 100%)`,
                  boxShadow: '0 0 8px rgba(250,204,21,0.3)'
                }}
              />
            </div>

            <div 
              className="absolute mt-2 transition-all duration-1000 ease-linear"
              style={{ left: `${timeState.pct}%`, transform: 'translateX(-50%)' }}
            >
              <div className="flex flex-col items-center">
                <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[4px] border-b-sky-500/50 mb-0.5"></div>
                <span className="font-mono text-[9px] md:text-[11px] font-bold tracking-[0.1em] tabular-nums text-white/90 bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-sm border border-white/10 shadow-xl">
                  {timeState.label}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-black/95 to-transparent z-10 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-full h-56 bg-gradient-to-t from-black/95 to-transparent z-10 pointer-events-none"></div>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
