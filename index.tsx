
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';

// --- Configuration ---
const BIRTHS_PER_SECOND = 4.352; 
const AUTO_ROTATION_SPEED = 0.18; 
const FRICTION = 0.98; 
const INITIAL_PHI = -25; 
const COLORS = {
  LAND: '#1e293b',      
  LAND_LIT: '#475569',  
  ICE: '#ffffff',       
  OCEAN_DEEP: '#08132b', 
  OCEAN_SHALLOW: '#1e3a8a', 
  OCEAN_BRIGHT: '#3b82f6',  
  SPECULAR: 'rgba(255, 255, 255, 0.5)', 
  GOLD_SOLID: '#facc15', 
  GOLD_DEEP: '#a16207',
  GOLD_GLOW: 'rgba(250, 204, 21, 0.8)', 
  BLUE_ATMOSPHERE: '#0ea5e9', 
  ATMOSPHERE_INNER: 'rgba(56, 189, 248, 0.55)', 
};

const STAR_COUNT = 350; 
const STARS = Array.from({ length: STAR_COUNT }).map((_, i) => ({
  id: i,
  top: `${Math.random() * 100}%`,
  left: `${Math.random() * 100}%`,
  size: Math.random() * 1.4 + 0.2,
  delay: `${Math.random() * 5}s`,
  duration: `${5 + Math.random() * 8}s`,
  opacity: 0.1 + Math.random() * 0.4,
}));

const SpaceBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-[#000103]">
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; transform: scale(0.9); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
        .star {
          position: absolute;
          background: white;
          border-radius: 50%;
          animation: twinkle var(--duration) ease-in-out infinite;
          animation-delay: var(--delay);
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
};

const Globe: React.FC<{ lastFlash: string | null }> = ({ lastFlash }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const geoDataRef = useRef<any>(null);
  const rotationRef = useRef<[number, number, number]>([0, INITIAL_PHI, 0]); 
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
      .on('start', () => { isDraggingRef.current = true; canvas.style.cursor = 'grabbing'; })
      .on('drag', (event) => {
        rotationRef.current[0] += (event.dx / dpr) * 0.25;
        rotationRef.current[1] -= (event.dy / dpr) * 0.25;
        velocityRef.current = [(event.dx / dpr) * 0.3, (event.dy / dpr) * 0.3];
      })
      .on('end', () => { isDraggingRef.current = false; canvas.style.cursor = 'grab'; });

    d3.select(canvas).call(drag);

    const render = (time: number) => {
      if (!geoDataRef.current) {
        animId = requestAnimationFrame(render);
        return;
      }
      
      const dt = Math.min(time - lastTimeRef.current, 100); 
      lastTimeRef.current = time;
      const timeFactor = dt / 16.666; 
      
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const isLarge = w > 1024;
      
      const radius = h * 0.33;
      const boundaryX = w * 0.28; 
      const gap = w * 0.02; 
      let cx = boundaryX + radius + gap;
      
      const maxCX = w - radius - (w * 0.02);
      if (cx > maxCX) cx = maxCX;

      if (!isLarge) {
        cx = w / 2;
      }

      const verticalOffset = 75; 
      const cy = (h / 2) - verticalOffset;
      
      ctx.clearRect(0, 0, w, h);
      
      if (!isDraggingRef.current) {
        velocityRef.current[0] += (AUTO_ROTATION_SPEED - velocityRef.current[0]) * 0.04 * timeFactor;
        rotationRef.current[0] += velocityRef.current[0] * timeFactor;
        rotationRef.current[1] += (INITIAL_PHI - rotationRef.current[1]) * 0.01 * timeFactor;
        velocityRef.current[0] *= Math.pow(FRICTION, timeFactor);
        velocityRef.current[1] *= Math.pow(FRICTION, timeFactor);
      }

      const projection = d3.geoOrthographic()
        .scale(radius)
        .translate([cx, cy])
        .rotate([rotationRef.current[0], rotationRef.current[1], rotationRef.current[2]])
        .clipAngle(90);
        
      const path = d3.geoPath(projection, ctx);
      
      const auraRadius = radius * 1.35;
      const aura = ctx.createRadialGradient(cx, cy, radius, cx, cy, auraRadius);
      aura.addColorStop(0, COLORS.ATMOSPHERE_INNER);
      aura.addColorStop(0.3, 'rgba(56, 189, 248, 0.25)');
      aura.addColorStop(0.7, 'rgba(56, 189, 248, 0.05)');
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
          ctx.strokeStyle = `rgba(255,255,255, ${Math.max(0.12, 0.3 - edgeFade * 0.2)})`; 
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
        const countries = ['IND', 'CHN', 'NGA', 'PAK', 'IDN', 'BRA', 'USA', 'BGD', 'ETH', 'MEX', 'PHL', 'COD', 'EGY', 'RUS'];
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
      <Globe lastFlash={flashId} />
      
      {/* Logo Branding - White with Blue Underline */}
      <div className="absolute top-8 left-10 md:top-10 md:left-14 z-30 pointer-events-none">
        <div className="flex flex-col items-start w-fit">
          <div className="flex items-baseline font-black tracking-tighter text-2xl md:text-3xl lg:text-4xl leading-none">
            <span className="text-white">M</span>
            <span className="text-white">&</span>
            <span className="text-white">CC</span>
          </div>
          <div className="w-full h-[3px] bg-sky-500 mt-1.5 shadow-[0_0_12px_rgba(14,165,233,0.7)]"></div>
        </div>
      </div>

      <div className="absolute inset-y-0 left-0 z-20 flex flex-col justify-center pl-10 md:pl-16 pointer-events-none w-full max-w-[34%]">
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
                textShadow: `0 3px 0 ${COLORS.GOLD_DEEP}, 0 8px 20px rgba(0,0,0,0.9), 0 0 10px rgba(250,204,21,0.2)`
              }}
            >
              {total.toLocaleString('en-US').replace(/,/g, '.')}
            </span>
          </div>

          <div className="w-full max-w-[420px] relative">
            <div className="flex justify-between items-end mb-1 px-1">
              <span className="text-sky-400 font-black uppercase tracking-[0.15em] text-[8px] md:text-[11px] opacity-70">Daily Pulse Cycle</span>
              <span className="text-white/40 font-mono text-[8px] md:text-[11px] tabular-nums font-bold tracking-widest">{Math.floor(timeState.pct)}%</span>
            </div>
            
            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden relative border border-white/5 shadow-inner">
              <div 
                className="h-full rounded-full transition-all duration-1000 ease-linear"
                style={{ 
                  width: `${timeState.pct}%`,
                  background: `linear-gradient(90deg, ${COLORS.GOLD_DEEP} 0%, ${COLORS.GOLD_SOLID} 100%)`,
                  boxShadow: '0 0 6px rgba(250,204,21,0.2)'
                }}
              />
            </div>

            {/* HH:MM Clock - Positioned under progress bar at current time indicator */}
            <div 
              className="absolute mt-2 transition-all duration-1000 ease-linear"
              style={{ left: `${timeState.pct}%`, transform: 'translateX(-50%)' }}
            >
              <div className="flex flex-col items-center">
                 {/* Tiny arrow pointing up to the bar */}
                <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[4px] border-b-sky-500/50 mb-0.5"></div>
                <span className="font-mono text-[9px] md:text-[11px] font-bold tracking-[0.1em] tabular-nums text-white/90 bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-sm border border-white/5">
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
