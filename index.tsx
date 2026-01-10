
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
  ATMOSPHERE_OUTER: 'rgba(56, 189, 248, 0.1)',
  PACIFIER_TEAL: '#009b9b',
  PACIFIER_BEIGE: '#f5e6cc',
  TEAT_CLEAR: 'rgba(255, 255, 255, 0.6)',
  TEAT_HIGHLIGHT: 'rgba(255, 255, 255, 0.9)',
  TEAT_SHADOW: 'rgba(200, 200, 200, 0.4)',
};

/**
 * TV-Optimized Auto-Adjust Globe Logic
 * Reduced scaleFactor to 0.40 to ensure "Action Safe" visibility on all TVs.
 */
const getGlobePosition = (w: number, h: number) => {
  const minDim = Math.min(w, h);
  // 0.40 scale factor means the globe takes up 80% of the screen height/width.
  // This leaves a 10% margin on all sides, well within standard TV safe zones.
  let scaleFactor = 0.40;
  const radius = minDim * scaleFactor;
  const cx = w / 2;
  const cy = h / 2; 
  return { cx, cy, radius };
};

// --- Comet Logic ---
interface Comet {
  type: 'pacifier' | 'teat';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  rotation: number;
  rv: number;
  size: number;
  opacity: number;
  history: {x: number, y: number}[];
}

const PacifierComets: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cometsRef = useRef<Comet[]>([]);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    const dpr = window.devicePixelRatio || 1;
    let animId: number;

    const createComet = (w: number, h: number): Comet => ({
      type: Math.random() > 0.5 ? 'pacifier' : 'teat',
      x: Math.random() * w,
      y: Math.random() * h,
      z: Math.random() * 0.5 + 0.5,
      vx: (Math.random() - 0.5) * 2.0,
      vy: (Math.random() - 0.5) * 2.0,
      rotation: Math.random() * Math.PI * 2,
      rv: (Math.random() - 0.5) * 0.05,
      size: 15 + Math.random() * 20,
      opacity: 0,
      history: []
    });

    const drawPacifier = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, rotation: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.scale(scale, scale);

      ctx.beginPath();
      ctx.moveTo(-10, -8);
      ctx.bezierCurveTo(-18, -12, -22, 0, -18, 10);
      ctx.bezierCurveTo(-14, 16, -4, 12, 0, 8);
      ctx.bezierCurveTo(4, 12, 14, 16, 18, 10);
      ctx.bezierCurveTo(22, 0, 18, -12, 10, -8);
      ctx.closePath();
      
      const shieldGrad = ctx.createLinearGradient(-20, -10, 20, 10);
      shieldGrad.addColorStop(0, COLORS.PACIFIER_TEAL);
      shieldGrad.addColorStop(1, '#006d6d');
      ctx.fillStyle = shieldGrad;
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 8, 0, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.PACIFIER_BEIGE;
      ctx.fill();
      
      ctx.strokeStyle = 'rgba(0, 155, 155, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(-3, -1, 2, 0, Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(3, -1, 2, 0, Math.PI);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 10, 12, Math.PI * 0.2, Math.PI * 0.8);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.restore();
    };

    const drawTeat = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, rotation: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.scale(scale * 1.5, scale * 1.5);

      ctx.beginPath();
      ctx.moveTo(-15, 10);
      ctx.bezierCurveTo(-15, 5, -8, 2, -5, -8);
      ctx.bezierCurveTo(-5, -15, -4, -18, 0, -18);
      ctx.bezierCurveTo(4, -18, 5, -15, 5, -8);
      ctx.bezierCurveTo(8, 2, 15, 5, 15, 10);
      ctx.lineTo(-15, 10);
      ctx.closePath();

      const teatGrad = ctx.createRadialGradient(0, -5, 0, 0, 0, 15);
      teatGrad.addColorStop(0, COLORS.TEAT_HIGHLIGHT);
      teatGrad.addColorStop(0.5, COLORS.TEAT_CLEAR);
      teatGrad.addColorStop(1, COLORS.TEAT_SHADOW);
      ctx.fillStyle = teatGrad;
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-4, -12);
      ctx.quadraticCurveTo(0, -10, 4, -12);
      ctx.moveTo(-4, -8);
      ctx.quadraticCurveTo(0, -6, 4, -8);
      ctx.stroke();

      ctx.restore();
    };

    const render = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const dt = time - lastTimeRef.current;
      lastTimeRef.current = time;
      const timeFactor = Math.min(dt / 16.667, 3);

      const w = window.innerWidth;
      const h = window.innerHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      if (cometsRef.current.length < 16) {
        cometsRef.current.push(createComet(w, h));
      }

      ctx?.clearRect(0, 0, w, h);
      if (!ctx) return;

      cometsRef.current.forEach((c, i) => {
        c.x += c.vx * timeFactor;
        c.y += c.vy * timeFactor;
        c.rotation += c.rv * timeFactor;
        c.opacity = Math.min(c.opacity + 0.01 * timeFactor, 0.7);

        c.history.unshift({x: c.x, y: c.y});
        if (c.history.length > 10) c.history.pop();

        if (c.history.length > 1) {
          ctx.beginPath();
          ctx.moveTo(c.history[0].x, c.history[0].y);
          for(let j = 1; j < c.history.length; j++) {
            ctx.lineTo(c.history[j].x, c.history[j].y);
          }
          
          const alpha = c.opacity * 0.3;
          const trailColorStart = c.type === 'pacifier' 
            ? `rgba(0, 155, 155, ${alpha})` 
            : `rgba(255, 255, 255, ${alpha})`;
            
          const trailGrad = ctx.createLinearGradient(c.history[0].x, c.history[0].y, c.history[c.history.length-1].x, c.history[c.history.length-1].y);
          trailGrad.addColorStop(0, trailColorStart);
          trailGrad.addColorStop(1, 'transparent');
          ctx.strokeStyle = trailGrad;
          ctx.lineWidth = c.size * 0.25;
          ctx.lineCap = 'round';
          ctx.stroke();
        }

        if (c.type === 'pacifier') {
          drawPacifier(ctx, c.x, c.y, (c.size / 40) * c.z, c.rotation);
        } else {
          drawTeat(ctx, c.x, c.y, (c.size / 40) * c.z, c.rotation);
        }

        if (c.x < -200 || c.x > w + 200 || c.y < -200 || c.y > h + 200) {
          cometsRef.current[i] = createComet(w, h);
        }
      });

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 z-[5] pointer-events-none opacity-40" style={{ willChange: 'transform' }} />;
};

const GlobalCanvas: React.FC<{ lastFlashId: string | null }> = ({ lastFlashId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const geoDataRef = useRef<any>(null);
  const rotationRef = useRef<[number, number, number]>([0, INITIAL_PHI, 0]);
  const velocityRef = useRef<[number, number]>([0, 0]);
  const isDraggingRef = useRef(false);
  const lastTimeRef = useRef<number>(0);
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
      if (!lastTimeRef.current) lastTimeRef.current = time;
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

      const aura = ctx.createRadialGradient(cx, cy, radius, cx, cy, radius * 1.12);
      aura.addColorStop(0, COLORS.ATMOSPHERE_INNER);
      aura.addColorStop(1, 'transparent');
      ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(cx, cy, radius * 1.12, 0, Math.PI * 2); ctx.fill();

      const ocean = ctx.createRadialGradient(cx - radius * 0.2, cy - radius * 0.2, 0, cx, cy, radius);
      ocean.addColorStop(0, COLORS.OCEAN_BRIGHT);
      ocean.addColorStop(0.6, COLORS.OCEAN_SHALLOW);
      ocean.addColorStop(1, COLORS.OCEAN_DEEP);
      ctx.fillStyle = ocean; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();

      const now = Date.now();
      geoDataRef.current.features.forEach((d: any) => {
        const centroid = d3.geoCentroid(d);
        const distance = d3.geoDistance(centroid, [-rotationRef.current[0], -rotationRef.current[1]]);
        
        if (distance < 1.7) { 
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
            const shading = 1 - Math.pow(distance / 1.7, 1.2);
            ctx.fillStyle = d3.interpolateRgb(COLORS.LAND, COLORS.LAND_LIT)(shading);
            ctx.shadowBlur = 0;
          }
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 0.5; ctx.stroke();
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
      <canvas ref={canvasRef} className="absolute inset-0 z-10 pointer-events-auto cursor-grab active:cursor-grabbing" style={{ willChange: 'transform' }} />
    </div>
  );
};

const SpaceBackground: React.FC = () => {
  const stars = useMemo(() => Array.from({ length: 450 }).map((_, i) => ({
    id: i,
    top: `${Math.random() * 100}%`,
    left: `${Math.random() * 100}%`,
    size: Math.random() * 1.5 + 0.4,
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
          will-change: opacity;
        }
      `}</style>
      {stars.map(star => (
        <div key={star.id} className="star" style={{ top: star.top, left: star.left, width: star.size, height: star.size, // @ts-ignore
          '--delay': star.delay, '--duration': star.duration }} />
      ))}
      <div className="absolute inset-0 opacity-10" style={{ background: 'radial-gradient(circle at 30% 20%, #1e3a8a 0%, transparent 60%), radial-gradient(circle at 70% 80%, #1e1b4b 0%, transparent 60%)' }} />
    </div>
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
      const nextDelay = -Math.log(Math.random()) * (1000 / BIRTHS_PER_SECOND);
      spawnTimeoutId = setTimeout(() => {
        countRef.current += 1; 
        setTotal(countRef.current);
        const countries = ['IND', 'CHN', 'NGA', 'PAK', 'IDN', 'BRA', 'USA', 'BGD', 'ETH', 'MEX', 'PHL', 'COD', 'EGY', 'RUS', 'FRA', 'DEU', 'TUR', 'VNM', 'IRN', 'THA'];
        const target = countries[Math.floor(Math.random() * countries.length)];
        setFlashId(target + Math.random());
        spawn();
      }, nextDelay);
    };
    spawn();
    
    return () => { clearInterval(clockInterval); clearTimeout(spawnTimeoutId); };
  }, []);

  const pureFlashId = flashId ? flashId.substring(0, 3) : null;

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-black flex flex-col font-sans">
      <SpaceBackground />
      <PacifierComets />
      <GlobalCanvas lastFlashId={pureFlashId} />

      <div className="absolute top-12 left-12 md:top-20 md:left-20 z-40 pointer-events-none">
        <div className="flex flex-col items-start w-fit">
          <div className="flex items-baseline font-black tracking-tighter text-xl md:text-2xl lg:text-3xl leading-none">
            <span className="text-white">M</span>
            <span className="text-white">&</span>
            <span className="text-white">CC</span>
          </div>
          <div className="w-full h-[3px] bg-sky-500 mt-1.5 shadow-[0_0_12px_rgba(14,165,233,0.7)]"></div>
        </div>
      </div>

      <div className="absolute inset-y-0 left-0 z-40 flex flex-col justify-center pl-12 md:pl-20 pointer-events-none w-full max-w-[400px]">
        <div className="flex flex-col items-start">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.8)] animate-pulse"></div>
            <span className="text-sky-400 font-bold uppercase tracking-[0.3em] text-[10px] md:text-sm opacity-90">Live Global Births</span>
          </div>
          <div className="flex items-baseline mb-8">
            <span className="text-[7vw] md:text-[72px] font-black leading-none tabular-nums" 
              style={{ 
                fontFamily: "'Anton', sans-serif", 
                color: COLORS.GOLD_SOLID,
                textShadow: `0 3px 0 ${COLORS.GOLD_DEEP}, 0 8px 32px rgba(0,0,0,1), 0 0 16px rgba(250,204,21,0.3)`
              }}>
              {total.toLocaleString('en-US').replace(/,/g, '.')}
            </span>
          </div>
          <div className="w-full relative pr-8">
            <div className="flex justify-between items-end mb-2">
              <span className="text-sky-400 font-black uppercase tracking-[0.15em] text-[10px]">Day Progress</span>
              <span className="text-white/40 font-mono text-[10px] tabular-nums">{Math.floor(timeState.pct)}%</span>
            </div>
            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden relative border border-white/5">
              <div className="h-full rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${timeState.pct}%`, background: `linear-gradient(90deg, ${COLORS.GOLD_DEEP}, ${COLORS.GOLD_SOLID})` }} />
            </div>
            <div className="absolute mt-3 transition-all duration-1000 ease-linear" style={{ left: `${timeState.pct}%`, transform: 'translateX(-50%)' }}>
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
