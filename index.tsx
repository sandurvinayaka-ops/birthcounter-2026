
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';

// --- Configuration ---
const BIRTHS_PER_SECOND = 4.352;
const AUTO_ROTATION_SPEED = 0.12;
const FRICTION = 0.985;
const INITIAL_PHI = -25;
const COLORS = {
  LAND: '#1e293b',
  LAND_LIT: '#475569',
  OCEAN_DEEP: '#08132b',
  OCEAN_SHALLOW: '#1e3a8a',
  OCEAN_BRIGHT: '#3b82f6',
  SPECULAR: 'rgba(255, 255, 255, 0.35)',
  GOLD_SOLID: '#facc15',
  GOLD_DEEP: '#a16207',
  ATMOSPHERE_INNER: 'rgba(56, 189, 248, 0.4)',
};

// --- Shared Helper for Responsive Globe Placement ---
const getGlobePosition = (w: number, h: number) => {
  const isLarge = w > 1024;
  const hScale = isLarge ? 0.35 : 0.32;
  const radius = h * hScale;
  const boundaryX = w * 0.28;
  const gap = w * 0.04;
  let cx = boundaryX + radius + gap;
  const safeRightMargin = w * 0.08;
  const maxCX = w - radius - safeRightMargin;
  if (cx > maxCX) cx = maxCX;
  if (!isLarge) cx = w / 2;
  const verticalOffset = isLarge ? 40 : 70;
  const cy = (h / 2) - verticalOffset;
  return { cx, cy, radius };
};

// --- Premium Philips Asset SVGs ---
const TeatSVG = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>
    <defs>
      <radialGradient id="teatGloss" cx="40%" cy="30%" r="50%">
        <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
        <stop offset="60%" stopColor="rgba(255,255,255,0.4)" />
        <stop offset="100%" stopColor="rgba(200,220,255,0.15)" />
      </radialGradient>
      <linearGradient id="baseRing" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
        <stop offset="100%" stopColor="rgba(255,255,255,0.1)" />
      </linearGradient>
    </defs>
    {/* Base ring */}
    <ellipse cx="50" cy="85" rx="35" ry="8" fill="url(#baseRing)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
    {/* Teat body with "natural" shape */}
    <path 
      d="M32,82 C32,62 38,58 40,42 C40,20 45,5 50,5 C55,5 60,20 60,42 C62,58 68,62 68,82 Z" 
      fill="url(#teatGloss)" 
      stroke="rgba(255,255,255,0.4)" 
      strokeWidth="0.5" 
    />
    {/* Inner detail for the nipple opening */}
    <path d="M46,12 Q50,9 54,12" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const PacifierSVG = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 140 120" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.4))' }}>
    <defs>
      <linearGradient id="shieldMain" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f8f6ff" />
        <stop offset="50%" stopColor="#e5dfff" />
        <stop offset="100%" stopColor="#d1c5ff" />
      </linearGradient>
      <radialGradient id="centerBtn" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="100%" stopColor="#e9e4ff" />
      </radialGradient>
    </defs>
    {/* Philips Ultra Air Shield */}
    <path 
      d="M10,60 C10,30 45,25 70,25 C95,25 130,30 130,60 C130,100 100,115 70,115 C40,115 10,100 10,60 Z" 
      fill="url(#shieldMain)" 
      stroke="rgba(255,255,255,0.9)" 
      strokeWidth="1.5" 
    />
    {/* Air Ventilation Holes */}
    <rect x="25" y="55" width="25" height="40" rx="12" fill="rgba(0,0,0,0.06)" />
    <rect x="90" y="55" width="25" height="40" rx="12" fill="rgba(0,0,0,0.06)" />
    {/* Front Button / Grip */}
    <circle cx="70" cy="70" r="28" fill="url(#centerBtn)" stroke="rgba(255,255,255,0.8)" strokeWidth="1" />
    <circle cx="70" cy="70" r="22" fill="none" stroke="rgba(168,128,255,0.3)" strokeWidth="1" />
    {/* Nipple silhouette through shield */}
    <path d="M55,30 Q70,5 85,30" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="8" strokeLinecap="round" opacity="0.3" />
  </svg>
);

// --- Space & Globe Master Component ---
const GlobalCanvas: React.FC<{ lastFlashId: string | null }> = ({ lastFlashId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const geoDataRef = useRef<any>(null);
  const rotationRef = useRef<[number, number, number]>([0, INITIAL_PHI, 0]);
  const velocityRef = useRef<[number, number]>([0, 0]);
  const isDraggingRef = useRef(false);
  const lastTimeRef = useRef<number>(performance.now());
  const activeFlashes = useRef<Map<string, number>>(new Map());

  // Generate comets with significantly slower physics
  const comets = useMemo(() => Array.from({ length: 12 }).map((_, i) => ({
    id: i,
    type: Math.random() > 0.5 ? 'teat' : 'pacifier',
    size: 16 + Math.random() * 10,
    orbitRadiusX: 20 + Math.random() * 15,
    orbitRadiusY: 15 + Math.random() * 20,
    // Extremely slow orbital speed for "drifting" feel
    speed: 0.00004 + Math.random() * 0.00006, 
    // Very subtle rotation
    rotSpeed: (Math.random() - 0.5) * 0.005,
    offset: Math.random() * Math.PI * 2,
    tilt: Math.random() * 360,
    // Smooth additive wobble params
    wobbleAmp: 10 + Math.random() * 20,
    wobbleFreq: 0.0003 + Math.random() * 0.0005,
    clockwise: Math.random() > 0.5,
  })), []);

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson')
      .then(res => res.json())
      .then(data => { geoDataRef.current = data; });
  }, []);

  useEffect(() => {
    if (lastFlashId) activeFlashes.current.set(lastFlashId, Date.now());
  }, [lastFlashId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    const dpr = window.devicePixelRatio || 1;
    let animId: number;

    const drag = d3.drag<HTMLCanvasElement, unknown>()
      .on('start', () => { isDraggingRef.current = true; canvas.style.cursor = 'grabbing'; })
      .on('drag', (event) => {
        rotationRef.current[0] += (event.dx / dpr) * 0.25;
        rotationRef.current[1] -= (event.dy / dpr) * 0.25;
        velocityRef.current = [(event.dx / dpr) * 0.45, (event.dy / dpr) * 0.45];
      })
      .on('end', () => { isDraggingRef.current = false; canvas.style.cursor = 'grab'; });

    d3.select(canvas).call(drag);

    const render = (time: number) => {
      const dt = time - lastTimeRef.current;
      lastTimeRef.current = time;
      const timeFactor = Math.min(dt / 16.667, 3);
      const w = window.innerWidth;
      const h = window.innerHeight;
      const { cx, cy, radius } = getGlobePosition(w, h);

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      ctx?.clearRect(0, 0, w, h);

      if (!ctx || !geoDataRef.current) {
        animId = requestAnimationFrame(render);
        return;
      }

      // 1. Globe Rotation
      if (!isDraggingRef.current) {
        rotationRef.current[0] += AUTO_ROTATION_SPEED * timeFactor;
        if (Math.abs(velocityRef.current[0]) > 0.001 || Math.abs(velocityRef.current[1]) > 0.001) {
          rotationRef.current[0] += velocityRef.current[0] * timeFactor;
          rotationRef.current[1] -= velocityRef.current[1] * timeFactor;
          velocityRef.current[0] *= Math.pow(FRICTION, timeFactor);
          velocityRef.current[1] *= Math.pow(FRICTION, timeFactor);
        }
        rotationRef.current[1] += (INITIAL_PHI - rotationRef.current[1]) * 0.02 * timeFactor;
      }

      const projection = d3.geoOrthographic()
        .scale(radius)
        .translate([cx, cy])
        .rotate([rotationRef.current[0], rotationRef.current[1], rotationRef.current[2]])
        .clipAngle(90);
      const path = d3.geoPath(projection, ctx);

      // 2. Atmosphere / Shadow Glow
      const aura = ctx.createRadialGradient(cx, cy, radius, cx, cy, radius * 1.22);
      aura.addColorStop(0, COLORS.ATMOSPHERE_INNER);
      aura.addColorStop(1, 'transparent');
      ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(cx, cy, radius * 1.22, 0, Math.PI * 2); ctx.fill();

      // 3. Ocean / Sphere base
      const ocean = ctx.createRadialGradient(cx - radius * 0.2, cy - radius * 0.2, 0, cx, cy, radius);
      ocean.addColorStop(0, COLORS.OCEAN_BRIGHT);
      ocean.addColorStop(0.6, COLORS.OCEAN_SHALLOW);
      ocean.addColorStop(1, COLORS.OCEAN_DEEP);
      ctx.fillStyle = ocean; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();

      // 4. Land Rendering
      const now = Date.now();
      geoDataRef.current.features.forEach((d: any) => {
        const centroid = d3.geoCentroid(d);
        const distance = d3.geoDistance(centroid, [-rotationRef.current[0], -rotationRef.current[1]]);
        if (distance < Math.PI / 1.5) {
          ctx.beginPath(); path(d);
          const flashStart = activeFlashes.current.get(d.id);
          if (flashStart) {
            const elapsed = now - flashStart;
            if (elapsed > 2000) { activeFlashes.current.delete(d.id); ctx.fillStyle = COLORS.LAND; }
            else {
              const t = elapsed / 2000;
              ctx.fillStyle = d3.interpolateRgb(COLORS.GOLD_SOLID, COLORS.LAND)(t);
              ctx.shadowBlur = 40 * (1 - t); ctx.shadowColor = COLORS.GOLD_SOLID;
            }
          } else {
            const shading = 1 - Math.pow(distance / (Math.PI / 1.5), 1.2);
            ctx.fillStyle = d3.interpolateRgb(COLORS.LAND, COLORS.LAND_LIT)(shading);
            ctx.shadowBlur = 0;
          }
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 0.5; ctx.stroke();
          ctx.shadowBlur = 0;
        }
      });

      // 5. Asset Drifting (Sync with Frame)
      const cometWrappers = containerRef.current?.querySelectorAll('.comet-item');
      if (cometWrappers) {
        comets.forEach((c, idx) => {
          const el = cometWrappers[idx] as HTMLElement;
          if (!el) return;
          
          // Pure orbital path
          const dir = c.clockwise ? 1 : -1;
          const angle = c.offset + (time * c.speed * dir);
          
          // Additive smooth wobble for organic feel
          const wobbleX = Math.sin(time * c.wobbleFreq) * c.wobbleAmp;
          const wobbleY = Math.cos(time * c.wobbleFreq * 0.7) * c.wobbleAmp;
          
          const x = cx + Math.cos(angle) * (c.orbitRadiusX * w / 100) + wobbleX;
          const y = cy + Math.sin(angle) * (c.orbitRadiusY * h / 100) + wobbleY;
          
          // Subtle spin
          const spin = (time * c.rotSpeed * 10) + c.tilt;
          
          // Mimic depth with slight scale variation based on sine of angle
          const depthScale = 0.9 + Math.sin(angle) * 0.15;
          const opacity = 0.4 + (Math.sin(angle) + 1) * 0.3; // Fade as they go "behind" or "far"
          
          el.style.transform = `translate(${x}px, ${y}px) rotate(${spin}deg) scale(${depthScale})`;
          el.style.opacity = opacity.toString();
        });
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [comets]);

  return (
    <div ref={containerRef} className="absolute inset-0 z-10 pointer-events-none">
      <canvas ref={canvasRef} className="absolute inset-0 z-10 pointer-events-auto cursor-grab active:cursor-grabbing" />
      {comets.map(c => (
        <div 
          key={c.id} 
          className="comet-item absolute top-0 left-0 flex items-center justify-center will-change-transform"
          style={{ width: c.size, height: c.size, margin: `-${c.size/2}px 0 0 -${c.size/2}px` }}
        >
          {/* Drifting Glow */}
          <div className="absolute w-[300%] h-[300%] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-40"
               style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(168,128,255,0.05) 50%, transparent 80%)', filter: 'blur(16px)' }} />
          {c.type === 'pacifier' ? <PacifierSVG size={c.size} /> : <TeatSVG size={c.size} />}
        </div>
      ))}
    </div>
  );
};

const SpaceBackground: React.FC = () => {
  const stars = useMemo(() => Array.from({ length: 450 }).map((_, i) => ({
    id: i,
    top: `${Math.random() * 100}%`,
    left: `${Math.random() * 100}%`,
    size: Math.random() * 2 + 0.4,
    delay: `${Math.random() * 5}s`,
    duration: `${6 + Math.random() * 10}s`,
  })), []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-[#000103]">
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.1; transform: scale(0.7); }
          50% { opacity: 0.7; transform: scale(1.2); }
        }
        .star {
          position: absolute;
          background: white;
          border-radius: 50%;
          animation: twinkle var(--duration) ease-in-out infinite;
          animation-delay: var(--delay);
        }
      `}</style>
      {stars.map(star => (
        <div key={star.id} className="star" style={{ top: star.top, left: star.left, width: star.size, height: star.size, // @ts-ignore
          '--delay': star.delay, '--duration': star.duration }} />
      ))}
    </div>
  );
};

// --- Main Application ---
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
        const countries = ['IND', 'CHN', 'NGA', 'PAK', 'IDN', 'BRA', 'USA', 'BGD', 'ETH', 'MEX', 'PHL', 'COD', 'EGY', 'RUS', 'FRA', 'DEU', 'TUR', 'VNM', 'IRN', 'THA'];
        const target = countries[Math.floor(Math.random() * countries.length)];
        setFlashId(target + Math.random());
        spawn();
      }, -Math.log(Math.random()) * (1000 / BIRTHS_PER_SECOND));
    };
    spawn();
    
    return () => { clearInterval(clockInterval); clearTimeout(spawnTimeoutId); };
  }, []);

  const pureFlashId = flashId ? flashId.substring(0, 3) : null;

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-black flex flex-col font-sans">
      <SpaceBackground />
      <GlobalCanvas lastFlashId={pureFlashId} />
      
      {/* M&CC Branding */}
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

      <div className="absolute inset-y-0 left-0 z-40 flex flex-col justify-center pl-10 md:pl-16 pointer-events-none w-full max-w-[400px]">
        <div className="flex flex-col items-start">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.8)] animate-pulse"></div>
            <span className="text-sky-400 font-bold uppercase tracking-[0.3em] text-[10px] md:text-xs opacity-90">Live Global Births</span>
          </div>
          <div className="flex items-baseline mb-6">
            <span className="text-[10vw] md:text-[88px] font-black leading-none tabular-nums" 
              style={{ 
                fontFamily: "'Anton', sans-serif", 
                color: COLORS.GOLD_SOLID,
                textShadow: `0 3px 0 ${COLORS.GOLD_DEEP}, 0 8px 30px rgba(0,0,0,1), 0 0 15px rgba(250,204,21,0.15)`
              }}>
              {total.toLocaleString('en-US').replace(/,/g, '.')}
            </span>
          </div>
          <div className="w-full relative">
            <div className="flex justify-between items-end mb-1">
              <span className="text-sky-400 font-black uppercase tracking-[0.15em] text-[10px]">Day Progress</span>
              <span className="text-white/40 font-mono text-[10px] tabular-nums">{Math.floor(timeState.pct)}%</span>
            </div>
            <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden relative border border-white/5">
              <div className="h-full rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${timeState.pct}%`, background: `linear-gradient(90deg, ${COLORS.GOLD_DEEP}, ${COLORS.GOLD_SOLID})` }} />
            </div>
            <div className="absolute mt-2 transition-all duration-1000 ease-linear" style={{ left: `${timeState.pct}%`, transform: 'translateX(-50%)' }}>
              <span className="font-mono text-[10px] font-bold tracking-widest text-white/90 bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm border border-white/5">
                {timeState.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-black to-transparent z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-full h-56 bg-gradient-to-t from-black to-transparent z-10 pointer-events-none" />
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
