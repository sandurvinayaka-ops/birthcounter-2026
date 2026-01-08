import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';

// --- Configuration ---
const BIRTHS_PER_SECOND = 4.35;
// Optimized for TV: A dynamic but steady cruise speed
const AUTO_ROTATION_SPEED = 0.45; 
const FRICTION = 0.985; 
const PRECESSION_SPEED = 0.00008; 
const MEDITERRANEAN_LATITUDE = -38; // Adjusted for better global visibility on wide screens
const COLORS = {
  LAND: '#2c3e50',      // Slightly lighter slate for better visibility
  LAND_LIT: '#5d6d7e',  
  ICE: '#ffffff',       // Pure white for ice
  OCEAN_DEEP: '#01040a',
  OCEAN_SHALLOW: '#081a3d',
  OCEAN_BRIGHT: '#1e40af',
  GOLD: '#fbbf24',      // Golden color for the counter
  BLUE: '#38bdf8',      
  ATMOSPHERE_INNER: 'rgba(56, 189, 248, 0.6)', 
};

const generateStars = (count: number) => {
  const starColors = ['#ffffff', '#bae6fd', '#fef9c3', '#fef3c7', '#e0f2fe'];
  return Array.from({ length: count }).map((_, i) => {
    const isSupernova = Math.random() > 0.98; 
    return {
      id: i,
      x: Math.random() * 260 - 80, 
      y: Math.random() * 260 - 80, 
      size: isSupernova ? Math.random() * 3.5 + 1.5 : Math.random() * 1.5 + 0.2, 
      duration: Math.random() * 3 + 1, 
      delay: Math.random() * 10,
      opacity: Math.random() * 0.7 + 0.3,
      glow: Math.random() > 0.5,
      color: starColors[Math.floor(Math.random() * starColors.length)],
      type: isSupernova ? 'cross' : 'circle'
    };
  });
};

const SpaceBackground: React.FC = () => {
  const stars = useMemo(() => generateStars(2500), []); 
  
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-[#000105]">
      <style>{`
        @keyframes rotate-bg {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes star-twinkle {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
      
      <div className="absolute top-1/2 left-1/2 w-[240vw] h-[240vw]" style={{ animation: 'rotate-bg 1800s linear infinite' }}>
        {stars.map(s => (
          <div key={s.id} style={{
            position: 'absolute',
            left: `${s.x}%`, top: `${s.y}%`, 
            width: `${s.size}px`, height: `${s.size}px`,
            backgroundColor: s.color,
            borderRadius: s.type === 'circle' ? '50%' : '0%',
            opacity: s.opacity,
            boxShadow: s.glow ? `0 0 ${s.size * 5}px ${s.color}` : 'none',
            animation: `star-twinkle ${s.duration}s ease-in-out infinite`,
            animationDelay: `${s.delay}s`,
            clipPath: s.type === 'cross' ? 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' : 'none'
          }} />
        ))}
      </div>
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
      
      const dt = Math.min(time - lastTimeRef.current, 60);
      lastTimeRef.current = time;
      const timeFactor = dt / 16.67;
      
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      
      const isLarge = w > 1200;
      const radius = isLarge ? h * 0.45 : h * 0.38;
      const cx = isLarge ? w * 0.65 : w * 0.5;
      const cy = h * 0.5;

      ctx.clearRect(0, 0, w, h);
      
      if (!isDraggingRef.current) {
        velocityRef.current[0] += (AUTO_ROTATION_SPEED - velocityRef.current[0]) * 0.03 * timeFactor;
        const wave = Math.sin(time * 0.0003) * 3;
        const targetPhi = MEDITERRANEAN_LATITUDE + wave;
        rotationRef.current[0] += velocityRef.current[0] * timeFactor;
        rotationRef.current[1] += (targetPhi - rotationRef.current[1]) * 0.01 * timeFactor;
        velocityRef.current[0] *= Math.pow(FRICTION, timeFactor);
        velocityRef.current[1] *= Math.pow(FRICTION, timeFactor);
      }

      const projection = d3.geoOrthographic()
        .scale(radius)
        .translate([cx, cy])
        .rotate([rotationRef.current[0], rotationRef.current[1], rotationRef.current[2]])
        .clipAngle(90);
        
      const path = d3.geoPath(projection, ctx);
      
      const aura = ctx.createRadialGradient(cx, cy, radius, cx, cy, radius + 160);
      aura.addColorStop(0, COLORS.ATMOSPHERE_INNER);
      aura.addColorStop(0.4, 'rgba(56, 189, 248, 0.2)');
      aura.addColorStop(1, 'transparent');
      ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(cx, cy, radius + 160, 0, Math.PI * 2); ctx.fill();

      const ocean = ctx.createRadialGradient(cx - radius * 0.2, cy - radius * 0.2, 0, cx, cy, radius);
      ocean.addColorStop(0, COLORS.OCEAN_BRIGHT);
      ocean.addColorStop(0.5, COLORS.OCEAN_SHALLOW);
      ocean.addColorStop(1, COLORS.OCEAN_DEEP);
      ctx.fillStyle = ocean; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();

      const now = Date.now();
      geoDataRef.current.features.forEach((d: any) => {
        const centroid = d3.geoCentroid(d);
        const distance = d3.geoDistance(centroid, [-rotationRef.current[0], -rotationRef.current[1]]);
        
        if (distance < Math.PI / 1.5) { 
          ctx.beginPath(); 
          path(d);
          const isIce = (d.id === 'ATA' || d.id === 'GRL');
          const flashStart = activeFlashes.current.get(d.id);
          const edgeFade = Math.pow(Math.max(0, (distance - (Math.PI / 3.2)) * 3.5), 1.5);
          
          if (flashStart) {
            const elapsed = now - flashStart;
            if (elapsed > 1800) {
              activeFlashes.current.delete(d.id);
              ctx.fillStyle = isIce ? COLORS.ICE : COLORS.LAND;
            } else {
              const t = elapsed / 1800;
              const flashCol = d3.interpolateRgb('#ffffff', isIce ? COLORS.ICE : COLORS.LAND)(t);
              ctx.fillStyle = flashCol;
              ctx.shadowBlur = 60 * (1 - t); 
              ctx.shadowColor = COLORS.GOLD;
            }
          } else {
            const shading = 1 - Math.pow(distance / (Math.PI / 1.6), 1.2);
            const landBase = d3.interpolateRgb(COLORS.LAND, COLORS.LAND_LIT)(shading);
            ctx.fillStyle = d3.interpolateRgb(isIce ? COLORS.ICE : landBase, COLORS.OCEAN_DEEP)(edgeFade);
            ctx.shadowBlur = 0;
          }
          ctx.fill(); 
          ctx.strokeStyle = `rgba(255,255,255, ${Math.max(0.01, 0.12 - edgeFade * 0.1)})`; 
          ctx.lineWidth = 0.5; 
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      });

      const rim = ctx.createRadialGradient(cx, cy, radius * 0.85, cx, cy, radius);
      rim.addColorStop(0, 'transparent');
      rim.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();

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
  const [timeState, setTimeState] = useState({ label: "00:00:00", pct: 0 });
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
        label: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }), 
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
      
      {/* Broadcast UI Overlays */}
      <div className="absolute inset-0 z-20 flex flex-col justify-end p-12 md:p-24 pointer-events-none">
        <div className="w-full max-w-[1200px] flex flex-col items-start gap-4">
          
          {/* Main Title Block */}
          <div className="flex flex-col gap-0 mb-4">
            <span className="text-sky-400 font-bold uppercase tracking-[0.3em] text-lg md:text-2xl ml-2">Total Births Today</span>
            <div className="flex items-baseline gap-4">
              <span className="text-[14vw] md:text-[10vw] font-black leading-none drop-shadow-[0_0_50px_rgba(251,191,36,0.25)]" style={{ fontFamily: "'Anton', sans-serif", color: COLORS.GOLD }}>
                {total.toLocaleString('en-US').replace(/,/g, '.')}
              </span>
            </div>
          </div>

          {/* Timeline & Stats */}
          <div className="w-full max-w-[600px] mt-12 relative h-16">
            {/* Time Marker that follows progress */}
            <div 
              className="absolute -top-12 flex flex-col items-center transition-all duration-1000 ease-linear"
              style={{ left: `${timeState.pct}%`, transform: 'translateX(-50%)' }}
            >
              <div className="bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2 rounded-lg shadow-2xl">
                <span className="text-white font-mono text-xl md:text-2xl font-bold tracking-tighter whitespace-nowrap">
                  {timeState.label}
                </span>
              </div>
              <div className="w-px h-4 bg-sky-400/60 mt-1 shadow-[0_0_8px_rgba(56,189,248,0.8)]"></div>
            </div>
            
            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden relative border border-white/5">
              <div 
                className="h-full bg-gradient-to-r from-sky-500 to-amber-400 transition-all duration-1000 ease-linear shadow-[0_0_15px_rgba(56,189,248,0.5)]"
                style={{ width: `${timeState.pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Branding Logo */}
      <div className="absolute top-12 left-12 z-30 pointer-events-none">
        <div className="flex flex-col">
          <span className="text-5xl font-black tracking-tighter drop-shadow-lg">
            <span className="text-sky-500">M&C</span>
            <span className="text-white">C</span>
          </span>
        </div>
      </div>

      {/* Bottom Subtle Overlay */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-sky-500/20 to-transparent z-40"></div>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
