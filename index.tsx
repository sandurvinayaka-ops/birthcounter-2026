
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';

// --- Configuration ---
const BIRTHS_PER_SECOND = 4.352;
const AUTO_ROTATION_SPEED = 14.0; 
const INITIAL_PHI = -15;
const MAX_DPR = Math.min(window.devicePixelRatio || 1.0, 2.0); 

const COLORS = {
  LAND: '#546a8c', 
  LAND_BORDER: 'rgba(255, 255, 255, 0.25)',
  OCEAN_DEEP: '#020617',
  OCEAN_BRIGHT: '#0f172a',
  YELLOW_SOLID: '#facc15',
  YELLOW_PREMIUM_TOP: '#fef9c3', 
  YELLOW_PREMIUM_MID: '#facc15', 
  YELLOW_PREMIUM_BTM: '#854d0e',
  ATMOSPHERE: 'rgba(56, 189, 248, 0.15)',
  HEADER_BLUE: '#60a5fa',
  PACIFIER_GLOW: 'rgba(165, 243, 252, 0.8)',
  GRATICULE: 'rgba(148, 163, 184, 0.1)', 
};

/**
 * TV SAFE ZONE CALIBRATION:
 * - cx: 0.60w
 * - cy: 0.36h
 */
const getGlobePosition = (w: number, h: number) => {
  const minDim = Math.min(w, h);
  const radius = minDim * 0.30; 
  const cx = w > 768 ? w * 0.60 : w / 2;
  const cy = w > 768 ? h * 0.36 : h / 2;
  return { cx, cy, radius };
};

interface Comet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  rv: number;
  wobblePhase: number;
  wobbleSpeed: number;
  size: number;
  alpha: number;
}

const GlobalApp: React.FC = () => {
  const [total, setTotal] = useState<number>(0);
  const [timeState, setTimeState] = useState({ label: "00:00", pct: 0 });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const geoDataRef = useRef<any>(null);
  const lastTimeRef = useRef<number>(0);
  const activeFlashes = useRef<Map<string, number>>(new Map());
  const comets = useRef<Comet[]>([]);
  const countRef = useRef(0);
  const dimensionsRef = useRef({ w: 0, h: 0 });
  
  // High-performance projection cache
  const projectionRef = useRef<d3.GeoProjection>(d3.geoOrthographic().clipAngle(90));

  // Load GeoJSON
  useEffect(() => {
    fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson')
      .then(res => res.json())
      .then(data => {
        if (data && data.features) {
          data.features.forEach((f: any) => { f.centroid = d3.geoCentroid(f); });
          geoDataRef.current = data;
        }
      })
      .catch(err => console.error("GeoJSON load failed", err));
  }, []);

  // Time & Counter Logic
  useEffect(() => {
    const updateProgress = () => {
      const d = new Date();
      const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const elapsed = (d.getTime() - midnight) / 1000;
      const pct = (elapsed / 86400) * 100;
      
      const currentBirths = Math.floor(elapsed * BIRTHS_PER_SECOND);
      countRef.current = currentBirths;
      setTotal(currentBirths);
      
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
        if (geoDataRef.current) {
          const countries = ['IND', 'CHN', 'NGA', 'PAK', 'IDN', 'BRA', 'USA', 'BGD', 'ETH', 'MEX', 'PHL', 'COD', 'EGY', 'RUS'];
          const target = countries[Math.floor(Math.random() * countries.length)];
          activeFlashes.current.set(target, Date.now());
        }
        spawn();
      }, nextDelay);
    };
    spawn();
    
    return () => { clearInterval(clockInterval); clearTimeout(spawnTimeoutId); };
  }, []);

  // Window Resize & Pre-rendering
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      dimensionsRef.current = { w, h };
      
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = Math.floor(w * MAX_DPR);
        canvas.height = Math.floor(h * MAX_DPR);
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(MAX_DPR, MAX_DPR);
        }
      }

      // Update projection scales only on resize
      const { cx, cy, radius } = getGlobePosition(w, h);
      projectionRef.current.scale(radius).translate([cx, cy]);

      // Pre-render bright stars
      const sCanvas = document.createElement('canvas');
      sCanvas.width = w * MAX_DPR;
      sCanvas.height = h * MAX_DPR;
      const sCtx = sCanvas.getContext('2d');
      if (sCtx) {
        sCtx.scale(MAX_DPR, MAX_DPR);
        sCtx.fillStyle = '#010208';
        sCtx.fillRect(0, 0, w, h);
        
        for (let i = 0; i < 600; i++) {
          const sx = Math.random() * w;
          const sy = Math.random() * h;
          sCtx.fillStyle = `rgba(100, 140, 255, ${Math.random() * 0.15})`;
          sCtx.fillRect(sx, sy, 1, 1);
        }

        for (let i = 0; i < 400; i++) {
          const sx = Math.random() * w;
          const sy = Math.random() * h;
          const sz = Math.random() > 0.9 ? 1.5 : 0.8;
          const op = 0.4 + Math.random() * 0.5;
          const colorType = Math.random();
          let color = `rgba(255, 255, 255, ${op})`;
          if (colorType > 0.95) color = `rgba(186, 218, 255, ${op})`;
          else if (colorType > 0.9) color = `rgba(255, 244, 214, ${op})`;
          
          sCtx.fillStyle = color;
          sCtx.fillRect(sx, sy, sz, sz);
          
          if (sz > 1.4) {
             sCtx.shadowBlur = 4;
             sCtx.shadowColor = 'white';
             sCtx.fillRect(sx, sy, sz, sz);
             sCtx.shadowBlur = 0;
          }
        }
      }
      starsCanvasRef.current = sCanvas;
    };

    window.addEventListener('resize', handleResize);
    handleResize(); 
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animId: number;
    const graticule = d3.geoGraticule10();
    const projection = projectionRef.current;
    const path = d3.geoPath(projection, ctx);

    const createComet = (w: number, h: number): Comet => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 220, 
      vy: (Math.random() - 0.5) * 220,
      rot: Math.random() * Math.PI * 2,
      rv: (Math.random() - 0.5) * 0.6,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.8 + Math.random() * 1.2,
      size: 5 + Math.random() * 5,
      alpha: 0
    });

    const drawGlowingPacifier = (ctx: CanvasRenderingContext2D, comet: Comet) => {
      const { size, alpha, wobblePhase } = comet;
      ctx.save();
      ctx.globalAlpha = alpha;
      const pulse = Math.sin(wobblePhase) * 0.5 + 0.5;
      const glowIntensity = 20 + (pulse * 15);
      ctx.shadowBlur = glowIntensity;
      ctx.shadowColor = COLORS.PACIFIER_GLOW;
      const sw = size * 1.3;
      const sh = size * 0.9;
      ctx.beginPath();
      ctx.moveTo(-sw * 0.5, -sh * 0.2);
      ctx.bezierCurveTo(-sw * 0.8, -sh * 0.8, sw * 0.8, -sh * 0.8, sw * 0.5, -sh * 0.2);
      ctx.bezierCurveTo(sw * 1.2, sh * 0.2, sw * 0.9, sh * 1.0, 0, sh * 0.7);
      ctx.bezierCurveTo(-sw * 0.9, sh * 1.0, -sw * 1.2, sh * 0.2, -sw * 0.5, -sh * 0.2);
      const shieldGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, sw);
      shieldGrad.addColorStop(0, '#ffffff');
      shieldGrad.addColorStop(0.3, '#cffafe');
      shieldGrad.addColorStop(1, '#67e8f9');
      ctx.fillStyle = shieldGrad;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(0, size * 0.25, size * 0.6, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = size * 0.1;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.35, size * 0.3, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();
    };

    const render = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const deltaTime = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;
      const safeDelta = Math.min(deltaTime, 0.033);

      const { w, h } = dimensionsRef.current;
      const { cx, cy, radius } = getGlobePosition(w, h);

      if (starsCanvasRef.current) {
        ctx.drawImage(starsCanvasRef.current, 0, 0, w, h);
      } else {
        ctx.fillStyle = '#010208';
        ctx.fillRect(0, 0, w, h);
      }

      // Render Comets with smooth physics
      if (comets.current.length < 12) comets.current.push(createComet(w, h));
      comets.current.forEach((c, idx) => {
        c.x += c.vx * safeDelta;
        c.y += c.vy * safeDelta;
        c.rot += c.rv * safeDelta;
        c.wobblePhase += c.wobbleSpeed * safeDelta;
        c.alpha = Math.min(c.alpha + 0.6 * safeDelta, 0.9);
        if (c.x < -300 || c.x > w + 300 || c.y < -300 || c.y > h + 300) {
          comets.current[idx] = createComet(w, h);
          return;
        }
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot + Math.sin(c.wobblePhase) * 0.05);
        drawGlowingPacifier(ctx, c);
        ctx.restore();
      });

      if (!geoDataRef.current) {
        animId = requestAnimationFrame(render);
        return;
      }

      // Liquid Smooth Rotation Logic
      const rotation = (time / 1000 * AUTO_ROTATION_SPEED) % 360;
      projection.rotate([rotation, INITIAL_PHI, 0]);

      // Ocean Background
      const og = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx, cy, radius);
      og.addColorStop(0, COLORS.OCEAN_BRIGHT);
      og.addColorStop(1, COLORS.OCEAN_DEEP);
      ctx.fillStyle = og;
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();

      // Graticule
      ctx.beginPath();
      path(graticule);
      ctx.strokeStyle = COLORS.GRATICULE;
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Land Rendering (Optimized with cached projection)
      ctx.beginPath();
      path(geoDataRef.current);
      ctx.fillStyle = COLORS.LAND;
      ctx.fill();

      // Shading overlay
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      const landLight = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
      landLight.addColorStop(0, 'rgba(255,255,255,0.08)');
      landLight.addColorStop(0.5, 'rgba(0,0,0,0)');
      landLight.addColorStop(1, 'rgba(0,0,0,0.25)');
      ctx.fillStyle = landLight;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      ctx.restore();

      // Land Borders
      ctx.beginPath();
      path(geoDataRef.current);
      ctx.strokeStyle = COLORS.LAND_BORDER;
      ctx.lineWidth = 0.6;
      ctx.stroke();

      // Atmosphere
      ctx.beginPath();
      const atmo = ctx.createRadialGradient(cx, cy, radius, cx, cy, radius * 1.05);
      atmo.addColorStop(0, COLORS.ATMOSPHERE);
      atmo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = atmo;
      ctx.arc(cx, cy, radius * 1.05, 0, Math.PI * 2);
      ctx.fill();

      // Flashes
      const timeNow = Date.now();
      activeFlashes.current.forEach((flashTime, id) => {
        const feature = geoDataRef.current.features.find((f: any) => 
          f.id === id || f.properties.name === id || (f.id && f.id.toString().substring(0,3) === id)
        );
        if (feature) {
          const t = Math.min((timeNow - flashTime) / 1500, 1);
          if (t >= 1) {
            activeFlashes.current.delete(id);
          } else {
            const distance = d3.geoDistance(feature.centroid, [-rotation, -INITIAL_PHI]);
            if (distance < 1.57) {
              ctx.beginPath();
              path(feature);
              ctx.fillStyle = d3.interpolateRgb(COLORS.YELLOW_SOLID, COLORS.LAND)(t);
              ctx.fill();
            }
          }
        }
      });
      animId = requestAnimationFrame(render);
    };
    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Helper to render total with round dots
  const renderFormattedTotal = (val: number) => {
    const str = val.toLocaleString('en-US').replace(/,/g, '.');
    return str.split('').map((char, i) => {
      if (char === '.') {
        return <span key={i} className="font-sans align-baseline inline-block px-[1px]" style={{ verticalAlign: 'baseline' }}>.</span>;
      }
      return char;
    });
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-black flex flex-col font-sans select-none">
      <canvas ref={canvasRef} className="absolute inset-0 z-0" style={{ opacity: 0.95 }} />

      {/* Brand Header */}
      <div className="absolute top-10 left-10 md:top-14 md:left-20 z-40 pointer-events-none">
        <div className="flex flex-col items-start w-fit">
          <div className="flex items-baseline font-black tracking-tighter text-[0.8rem] md:text-[2.2rem] leading-none">
            <span className="text-white">M</span>
            <span className="text-white">&</span>
            <span className="text-white">CC</span>
          </div>
          <div className="w-full h-[1.5px] bg-yellow-500 mt-1 opacity-60 shadow-[0_0_10px_rgba(250,204,21,0.5)]"></div>
        </div>
      </div>

      {/* Main UI Console */}
      <div className="absolute inset-y-0 left-0 z-40 flex flex-col justify-center pl-10 md:pl-20 pointer-events-none w-full max-w-[900px]">
        <div className="flex flex-col items-start w-full">
          <div className="mb-4">
            <span className="font-bold uppercase tracking-[0.45em] text-[0.6rem] md:text-[0.9rem] opacity-90 drop-shadow-md" style={{ color: COLORS.HEADER_BLUE }}>Global birth count today</span>
          </div>
          
          <div className="mb-5 relative">
            {/* Rescaled Counter: 7.2vw / 100px (80% of original) */}
            <span className="text-[7.2vw] md:text-[100px] font-normal leading-none tabular-nums bg-clip-text text-transparent bg-gradient-to-b from-[#fef9c3] via-[#facc15] to-[#854d0e] tracking-[0.05em]" 
              style={{ 
                fontFamily: "'Bebas Neue', cursive",
                filter: `drop-shadow(0 0 30px rgba(250, 204, 21, 0.15))`
              }}>
              {renderFormattedTotal(total)}
            </span>
          </div>

          <div className="w-[45%] md:w-[42%] relative mt-12">
            <div className="flex justify-between items-end mb-4 relative h-6">
              <span className="text-yellow-400 font-bold uppercase tracking-[0.45em] text-[0.55rem] md:text-[0.85rem] opacity-80">Daily Progress</span>
              <span className="text-yellow-200/40 font-mono text-[11px] md:text-[15px] tabular-nums font-black tracking-widest">{Math.floor(timeState.pct)}%</span>
            </div>

            <div className="h-[10px] w-full bg-yellow-950/20 rounded-full overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] ring-1 ring-yellow-500/10 relative backdrop-blur-sm">
              <div 
                className="h-full rounded-full transition-all duration-1000 ease-linear relative overflow-hidden"
                style={{ 
                    width: `${timeState.pct}%`, 
                    background: `linear-gradient(90deg, #ca8a04 0%, #facc15 50%, #fef9c3 100%)`,
                    boxShadow: `0 0 20px rgba(250, 204, 21, 0.4)`
                }} 
              >
                <div className="absolute top-0 left-0 w-full h-[1.5px] bg-white/10" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent w-[30%] skew-x-[-35deg]" style={{ animation: 'shimmer 4.5s infinite ease-in-out' }} />
              </div>
            </div>

            <div 
              className="absolute top-6 transition-all duration-1000 ease-linear z-50"
              style={{ left: `${timeState.pct}%`, transform: 'translateX(-50%)' }}
            >
              <div className="flex flex-col items-center">
                <div className="w-[1.5px] h-10 bg-gradient-to-b from-yellow-400 to-transparent mb-1.5 opacity-40"></div>
                <div className="px-4 py-1.5 bg-black/90 backdrop-blur-xl border border-yellow-500/20 rounded shadow-2xl flex items-center justify-center">
                    <span className="font-mono text-[0.8rem] md:text-[1rem] font-bold tracking-[0.25em] text-yellow-50 tabular-nums">
                    {timeState.label}
                    </span>
                </div>
              </div>
            </div>

            <div className="absolute top-[10px] w-full flex justify-between px-1 opacity-10 pointer-events-none">
                {[...Array(11)].map((_, i) => (
                    <div key={i} className="w-[1px] h-3 bg-yellow-50"></div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Cinematic Overlays */}
      <div className="absolute inset-0 pointer-events-none z-10 bg-gradient-to-r from-black/90 via-black/10 to-transparent" />
      <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-black/70 to-transparent z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-full h-60 bg-gradient-to-t from-black/70 to-transparent z-10 pointer-events-none" />

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-200%) skewX(-35deg); }
          100% { transform: translateX(500%) skewX(-35deg); }
        }
      `}</style>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<GlobalApp />);
}
