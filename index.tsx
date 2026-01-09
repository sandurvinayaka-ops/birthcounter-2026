
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';

// --- Configuration ---
const BIRTHS_PER_SECOND = 4.352;
const AUTO_ROTATION_SPEED = 0.25; 
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

      // Atmosphere
      const aura = ctx.createRadialGradient(cx, cy, radius, cx, cy, radius * 1.18);
      aura.addColorStop(0, COLORS.ATMOSPHERE_INNER);
      aura.addColorStop(1, 'transparent');
      ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(cx, cy, radius * 1.18, 0, Math.PI * 2); ctx.fill();

      // Ocean
      const ocean = ctx.createRadialGradient(cx - radius * 0.2, cy - radius * 0.2, 0, cx, cy, radius);
      ocean.addColorStop(0, COLORS.OCEAN_BRIGHT);
      ocean.addColorStop(0.6, COLORS.OCEAN_SHALLOW);
      ocean.addColorStop(1, COLORS.OCEAN_DEEP);
      ctx.fillStyle = ocean; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();

      // Land
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
          ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 0.5; ctx.stroke();
          ctx.shadowBlur = 0;
        }
      });

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 z-10 pointer-events-none">
      <canvas ref={canvasRef} className="absolute inset-0 z-10 pointer-events-auto cursor-grab active:cursor-grabbing" />
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
    duration: `${4 + Math.random() * 8}s`,
  })), []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-[#000103]">
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 0.8; transform: scale(1.1); }
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
            <div className="w-3 h-3 rounded-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.8)] animate-pulse"></div>
            <span className="text-sky-400 font-bold uppercase tracking-[0.3em] text-[10px] md:text-base opacity-90">Live Global Births</span>
          </div>
          <div className="flex items-baseline mb-6">
            <span className="text-[9vw] md:text-[80px] font-black leading-none tabular-nums" 
              style={{ 
                fontFamily: "'Anton', sans-serif", 
                color: COLORS.GOLD_SOLID,
                textShadow: `0 3px 0 ${COLORS.GOLD_DEEP}, 0 8px 24px rgba(0,0,0,0.95), 0 0 12px rgba(250,204,21,0.25)`
              }}>
              {total.toLocaleString('en-US').replace(/,/g, '.')}
            </span>
          </div>
          <div className="w-full relative">
            <div className="flex justify-between items-end mb-1">
              <span className="text-sky-400 font-black uppercase tracking-[0.15em] text-[10px]">Day Progress</span>
              <span className="text-white/40 font-mono text-[10px] tabular-nums">{Math.floor(timeState.pct)}%</span>
            </div>
            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden relative border border-white/5">
              <div className="h-full rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${timeState.pct}%`, background: `linear-gradient(90deg, ${COLORS.GOLD_DEEP}, ${COLORS.GOLD_SOLID})` }} />
            </div>
            <div className="absolute mt-2 transition-all duration-1000 ease-linear" style={{ left: `${timeState.pct}%`, transform: 'translateX(-50%)' }}>
              <span className="font-mono text-[11px] font-bold tracking-widest text-white bg-black/80 px-2 py-0.5 rounded border border-white/10 backdrop-blur-md">
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
