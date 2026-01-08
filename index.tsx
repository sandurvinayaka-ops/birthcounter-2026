import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';

// --- Configuration ---
const BIRTHS_PER_SECOND = 4.35;
const AUTO_ROTATION_SPEED = 0.05; // Slightly reduced for a more serene, high-end cinematic pace
const FRICTION = 0.997; // Increased for even more silky, long-lasting momentum
const PRECESSION_SPEED = 0.0002; // Slower, more subtle frequency for organic wobble
const COLORS = {
  LAND: '#3d4a5e',      
  ICE: '#ffffff',       
  OCEAN_DEEP: '#010409',
  OCEAN_SHALLOW: '#0e2a63',
  OCEAN_BRIGHT: '#1d4ed8',
  GOLD: '#FFD700',
  BLUE: '#60a5fa',      
  ATMOSPHERE_INNER: 'rgba(96, 165, 250, 0.45)', 
  PACIFIER_MINT: '#d1fae5',
  PACIFIER_BLUE: '#bfdbfe',
  BOTTLE_GLASS: 'rgba(255, 255, 255, 0.2)',
  BOTTLE_LOGO: '#1e40af'
};

const generateStars = (count: number) => {
  const starColors = ['#ffffff', '#bae6fd', '#fef9c3', '#fef3c7', '#e0f2fe', '#fecaca', '#fff0f0'];
  return Array.from({ length: count }).map((_, i) => {
    const isSupernova = Math.random() > 0.94; 
    const isDistant = Math.random() > 0.5;
    return {
      id: i,
      x: Math.random() * 260 - 80, 
      y: Math.random() * 260 - 80, 
      size: isSupernova ? Math.random() * 4.2 + 2.5 : (isDistant ? Math.random() * 0.9 + 0.3 : Math.random() * 2.5 + 0.8), 
      duration: Math.random() * 1.8 + 0.3, 
      delay: Math.random() * 10,
      opacity: isDistant ? Math.random() * 0.6 + 0.2 : Math.random() * 1.0 + 0.6,
      glow: Math.random() > 0.3,
      color: starColors[Math.floor(Math.random() * starColors.length)],
      type: isSupernova ? 'cross' : 'circle'
    };
  });
};

const generateSpaceObjects = (count: number) => {
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    type: Math.random() > 0.5 ? 'PACIFIER' : 'BOTTLE',
    delay: Math.random() * -30,
    duration: Math.random() * 30 + 35,
    size: Math.random() * 12 + 25,
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
  const stars = useMemo(() => generateStars(3500), []); 
  const spaceObjects = useMemo(() => generateSpaceObjects(12), []);
  
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-[#000105]">
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
          0%, 100% { 
            opacity: 0.1; 
            transform: scale(0.5); 
            filter: brightness(0.2) blur(0.5px); 
          }
          50% { 
            opacity: 1; 
            transform: scale(2.4); 
            filter: brightness(15) blur(1.5px); 
          }
        }
        @keyframes star-twinkle-cross {
          0%, 100% { transform: rotate(0deg) scale(0.6); opacity: 0.3; filter: brightness(0.5); }
          50% { transform: rotate(90deg) scale(2.2); opacity: 1; filter: brightness(10) drop-shadow(0 0 15px white); }
        }
      `}</style>
      
      <div className="absolute top-1/2 left-1/2 w-[240vw] h-[240vw]" style={{ animation: 'rotate-bg 1200s linear infinite' }}>
        {stars.map(s => (
          <div key={s.id} style={{
            position: 'absolute',
            left: `${s.x}%`, top: `${s.y}%`, 
            width: `${s.size}px`, height: `${s.size}px`,
            backgroundColor: s.color,
            borderRadius: s.type === 'circle' ? '50%' : '0%',
            opacity: s.opacity,
            boxShadow: s.glow ? `0 0 ${s.size * 8}px ${s.color}, 0 0 ${s.size * 25}px ${s.color}cc, 0 0 ${s.size * 40}px ${s.color}33` : 'none',
            animation: s.type === 'circle' ? `star-twinkle ${s.duration}s ease-in-out infinite` : `star-twinkle-cross ${s.duration * 2}s ease-in-out infinite`,
            animationDelay: `${s.delay}s`,
            clipPath: s.type === 'cross' ? 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' : 'none'
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
  const rotationRef = useRef<[number, number, number]>([0, -15, 0]); // [lambda, phi, gamma]
  const velocityRef = useRef<[number, number]>([0, 0]);
  const isDraggingRef = useRef(false);
  const lastTimeRef = useRef<number>(performance.now());
  const activeFlashes = useRef<Map<string, number>>(new Map());
  const smoothedDtRef = useRef<number>(16.67);

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
        velocityRef.current = [0, 0];
      })
      .on('drag', (event) => {
        const dx = (event.dx / dpr);
        const dy = (event.dy / dpr);
        // Direct manipulation for tactile control
        rotationRef.current[0] += dx * 0.42;
        rotationRef.current[1] -= dy * 0.42;
        // Seed velocity for natural inertia
        velocityRef.current = [dx * 0.5, dy * 0.5];
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
      
      const rawDt = time - lastTimeRef.current;
      lastTimeRef.current = time;
      
      // Precision delta-time smoothing using a low-pass filter to eliminate jitter
      const clampedDt = Math.min(Math.max(rawDt, 1), 60);
      smoothedDtRef.current = smoothedDtRef.current * 0.85 + clampedDt * 0.15;
      const dt = smoothedDtRef.current;
      
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const isMobile = w < 768;
      
      const radius = isMobile 
        ? Math.min(w * 0.38, h * 0.24) 
        : Math.min(w * 0.30, h * 0.40);
      
      const cx = isMobile ? w * 0.5 : w * 0.75; 
      const cy = isMobile ? h * 0.44 : h * 0.5;

      ctx.clearRect(0, 0, w, h);
      
      // PHYSICS UPDATE: Sub-pixel precision integration
      if (!isDraggingRef.current) {
        const timeFactor = dt / 16.67;

        // 1. Accumulate auto-rotation at a statelier pace
        rotationRef.current[0] += AUTO_ROTATION_SPEED * dt;

        // 2. Gentle organic axial wobble (Precession)
        const wobble = Math.sin(time * PRECESSION_SPEED) * 1.8;
        const targetPhi = -15 + wobble;

        // 3. Apply inertia from drag with extreme cinematic decay
        rotationRef.current[0] += velocityRef.current[0] * timeFactor;
        rotationRef.current[1] += velocityRef.current[1] * timeFactor;

        // Velocity damping
        const decay = Math.pow(FRICTION, timeFactor);
        velocityRef.current[0] *= decay;
        velocityRef.current[1] *= decay;
        
        // 4. Elastic return to viewing baseline
        const snapFactor = 1 - Math.pow(0.992, timeFactor);
        rotationRef.current[1] += (targetPhi - rotationRef.current[1]) * snapFactor;
      }

      const projection = d3.geoOrthographic()
        .scale(radius)
        .translate([cx, cy])
        .rotate([rotationRef.current[0], rotationRef.current[1], rotationRef.current[2]])
        .clipAngle(90);
        
      const path = d3.geoPath(projection, ctx);
      
      // Atmosphere Glow
      const glowRadiusOuter = radius + (isMobile ? 60 : 110);
      const glowRadiusInner = radius + (isMobile ? 20 : 40);
      
      const glowOuter = ctx.createRadialGradient(cx, cy, radius, cx, cy, glowRadiusOuter);
      glowOuter.addColorStop(0, COLORS.ATMOSPHERE_INNER);
      glowOuter.addColorStop(0.5, 'rgba(96, 165, 250, 0.04)');
      glowOuter.addColorStop(1, 'transparent');
      ctx.fillStyle = glowOuter; ctx.beginPath(); ctx.arc(cx, cy, glowRadiusOuter, 0, Math.PI * 2); ctx.fill();

      const glowInner = ctx.createRadialGradient(cx, cy, radius * 0.9, cx, cy, glowRadiusInner);
      glowInner.addColorStop(0, 'rgba(96, 165, 250, 0.18)');
      glowInner.addColorStop(1, 'transparent');
      ctx.fillStyle = glowInner; ctx.beginPath(); ctx.arc(cx, cy, glowRadiusInner, 0, Math.PI * 2); ctx.fill();

      // Deep Ocean Shader
      const oceanGrad = ctx.createRadialGradient(cx - radius * 0.4, cy - radius * 0.4, 0, cx, cy, radius);
      oceanGrad.addColorStop(0, COLORS.OCEAN_BRIGHT);
      oceanGrad.addColorStop(0.5, COLORS.OCEAN_SHALLOW);
      oceanGrad.addColorStop(0.9, COLORS.OCEAN_DEEP);
      oceanGrad.addColorStop(1, '#000');
      ctx.fillStyle = oceanGrad; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();

      // Landmass Rendering
      const now = Date.now();
      geoDataRef.current.features.forEach((d: any) => {
        const centroid = d3.geoCentroid(d);
        const distance = d3.geoDistance(centroid, [-rotationRef.current[0], -rotationRef.current[1]]);
        
        if (distance < Math.PI / 1.5) { 
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
              ctx.shadowBlur = (isMobile ? 35 : 70) * (1 - t); ctx.shadowColor = COLORS.GOLD;
            }
          } else {
            ctx.fillStyle = isIce ? COLORS.ICE : COLORS.LAND;
            ctx.shadowBlur = 0;
          }
          ctx.fill(); 
          
          ctx.strokeStyle = 'rgba(255,255,255,0.06)'; 
          ctx.lineWidth = 0.5; 
          ctx.stroke();
        }
      });

      // Lighting Overlays
      const rimGrad = ctx.createRadialGradient(cx, cy, radius * 0.75, cx, cy, radius);
      rimGrad.addColorStop(0, 'transparent');
      rimGrad.addColorStop(0.9, 'rgba(0,0,0,0.6)');
      rimGrad.addColorStop(1, 'rgba(0,0,0,0.9)');
      ctx.fillStyle = rimGrad; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();

      const specGrad = ctx.createRadialGradient(cx - radius * 0.5, cy - radius * 0.5, radius * 0.05, cx - radius * 0.5, cy - radius * 0.5, radius * 0.9);
      specGrad.addColorStop(0, 'rgba(255,255,255,0.18)');
      specGrad.addColorStop(0.4, 'rgba(255,255,255,0.05)');
      specGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = specGrad; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();

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

  const formattedTotal = total.toLocaleString('en-US').replace(/,/g, '.');

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-black flex flex-col font-sans">
      <SpaceBackground />
      <Globe lastFlash={flashId} />
      
      <div className="absolute inset-0 z-20 flex flex-col justify-center px-6 md:px-24 pointer-events-none">
        <div className="w-full max-w-[90vw] md:max-w-[650px] flex flex-col items-center md:items-start gap-0">
          <h1 className="font-black tracking-[0.1em] md:tracking-[0.2em] text-[26px] md:text-[42px] opacity-100 mb-4 uppercase leading-[0.95] text-center md:text-left" style={{ color: COLORS.BLUE }}>
            Global Births<br />Today
          </h1>
          
          <div className="relative flex flex-row items-baseline justify-center md:justify-start text-center md:text-left mb-4">
            <span 
              className="text-[16vw] md:text-[8.5vw] font-black tabular-nums leading-none block" 
              style={{ 
                color: COLORS.GOLD, 
                textShadow: '0 0 60px rgba(255,215,0,0.5)',
                fontFamily: "'Anton', sans-serif",
                letterSpacing: '0.08em'
              }}
            >
              {formattedTotal}
            </span>
          </div>

          <div className="w-full relative flex flex-col gap-0.5 mt-2">
             <div className="h-4 w-full bg-white/5 rounded-full overflow-hidden border border-white/10 relative">
                <div className="absolute inset-0 opacity-10" style={{ backgroundColor: COLORS.GOLD }} />
                <div 
                  className="h-full rounded-full transition-all duration-1000 ease-linear relative z-10 shadow-[0_0_25px_rgba(255,215,0,0.8)]" 
                  style={{ 
                    width: `${timeState.pct}%`,
                    backgroundColor: COLORS.GOLD 
                  }} 
                />
             </div>

             <div className="h-14 w-full relative">
                <div 
                  className="absolute top-1 flex flex-col items-center transition-all duration-1000 ease-linear" 
                  style={{ 
                    left: `${timeState.pct}%`, 
                    transform: 'translateX(-50%)' 
                  }}
                >
                  <div className="w-px h-4 bg-white/40"></div>
                  <div className="bg-[#0f172a] border border-white/20 px-4 py-2 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.7)] flex items-center justify-center min-w-[95px]">
                    <span className="text-white font-mono text-[14px] md:text-[18px] font-bold tracking-tight">{timeState.label}</span>
                  </div>
                </div>
             </div>
          </div>
        </div>
      </div>

      <div className="absolute top-8 left-8 md:top-12 md:left-24 z-30 pointer-events-none opacity-90">
        <div className="flex items-center gap-2">
          <p className="font-black text-lg md:text-3xl tracking-tighter" style={{ color: COLORS.GOLD }}>
            M&C<span className="text-white">C</span>
          </p>
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
