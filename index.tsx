
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';

// --- Configuration ---
const BIRTHS_PER_SECOND = 4.352;
const AUTO_ROTATION_SPEED = 10.0; // Degrees per second
const INITIAL_PHI = -15;

const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;
const GLOBE_RENDER_SCALE = 1.2; 

const COLORS = {
  LAND_BASE: '#c084fc', 
  LAND_BORDER: 'rgba(255, 255, 255, 0.5)', 
  OCEAN_DEEP: '#020617',
  OCEAN_BRIGHT: '#111827', 
  YELLOW_VIBRANT: '#fbbf24', 
  YELLOW_PEAK: '#fff700', 
  ATMOSPHERE: 'rgba(168, 85, 247, 0.25)', 
  SPECULAR: 'rgba(255, 255, 255, 0.12)', 
  HEADER_PURPLE: '#a855f7', 
  PACIFIER_GLOW: '#60a5fa',
  PACIFIER_CORE: '#ffffff',
  COMET_GLOW: '#93c5fd',
  PROGRESS_GREEN: '#22c55e',
};

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  twinkle: number;
}

interface Pacifier {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  rv: number;
  size: number;
  alpha: number;
}

interface Comet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  alpha: number;
  thickness: number;
  decay: number;
}

const GlobalApp: React.FC = () => {
  const [total, setTotal] = useState<number>(0);
  const [timeState, setTimeState] = useState({ label: "00:00", pct: 0 });
  
  const globeCanvasRef = useRef<HTMLCanvasElement>(null);
  const fxCanvasRef = useRef<HTMLCanvasElement>(null);
  const pacifierSpriteRef = useRef<HTMLCanvasElement | null>(null);
  
  const geoDataRef = useRef<any>(null);
  const featuresMapRef = useRef<Map<string, any>>(new Map());
  const activeFlashes = useRef<Map<string, number>>(new Map());
  const starsRef = useRef<Star[]>([]);
  const pacifiers = useRef<Pacifier[]>([]);
  const comets = useRef<Comet[]>([]);
  const countRef = useRef(0);
  const dimensionsRef = useRef({ w: 0, h: 0 });
  const lastTimeRef = useRef<number>(0);
  
  const gradients = useRef<{ [key: string]: CanvasGradient | null }>({});
  const projectionRef = useRef<d3.GeoProjection>(d3.geoOrthographic().clipAngle(90));

  useEffect(() => {
    const stars: Star[] = [];
    for (let i = 0; i < 600; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random(),
        size: Math.random() * 1.5,
        opacity: Math.random(),
        twinkle: Math.random() * 0.02
      });
    }
    starsRef.current = stars;

    fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson')
      .then(res => res.json())
      .then(data => {
        if (data && data.features) {
          const map = new Map();
          data.features.forEach((f: any) => { 
            f.centroid = d3.geoCentroid(f);
            const id = f.id || f.properties.name || f.properties.ISO_A3;
            map.set(id, f);
          });
          featuresMapRef.current = map;
          geoDataRef.current = data;
        }
      })
      .catch(err => console.error("GeoJSON load failed", err));
  }, []);

  useEffect(() => {
    const pSprite = document.createElement('canvas');
    const size = 128; 
    pSprite.width = size * 2; 
    pSprite.height = size * 2;
    const sCtx = pSprite.getContext('2d');
    if (sCtx) {
      sCtx.translate(size, size);
      sCtx.shadowBlur = 80;
      sCtx.shadowColor = 'rgba(96, 165, 250, 0.4)';
      sCtx.beginPath();
      sCtx.arc(0, 0, 30, 0, Math.PI * 2);
      sCtx.fillStyle = 'rgba(96, 165, 250, 0.1)';
      sCtx.fill();
      sCtx.shadowBlur = 30;
      sCtx.shadowColor = COLORS.PACIFIER_GLOW;
      sCtx.beginPath();
      sCtx.arc(0, 20, 14, 0, Math.PI * 2);
      sCtx.strokeStyle = COLORS.PACIFIER_CORE;
      sCtx.lineWidth = 6;
      sCtx.stroke();
      sCtx.beginPath();
      sCtx.ellipse(0, 0, 26, 12, 0, 0, Math.PI * 2);
      sCtx.fillStyle = COLORS.PACIFIER_GLOW;
      sCtx.fill();
      sCtx.strokeStyle = COLORS.PACIFIER_CORE;
      sCtx.lineWidth = 2;
      sCtx.stroke();
      sCtx.beginPath();
      sCtx.arc(0, -14, 12, 0, Math.PI * 2);
      sCtx.fillStyle = COLORS.PACIFIER_CORE;
      sCtx.shadowBlur = 20;
      sCtx.shadowColor = '#fff';
      sCtx.fill();
    }
    pacifierSpriteRef.current = pSprite;
  }, []);

  useEffect(() => {
    const handleResize = () => {
      let w = window.innerWidth;
      let h = window.innerHeight;
      if (w > MAX_WIDTH) { h = (MAX_WIDTH / w) * h; w = MAX_WIDTH; }
      if (h > MAX_HEIGHT) { w = (MAX_HEIGHT / h) * w; h = MAX_HEIGHT; }
      dimensionsRef.current = { w, h };
      
      const gCanvas = globeCanvasRef.current;
      const fCanvas = fxCanvasRef.current;
      if (gCanvas && fCanvas) {
        gCanvas.width = w * GLOBE_RENDER_SCALE; 
        gCanvas.height = h * GLOBE_RENDER_SCALE;
        fCanvas.width = w; fCanvas.height = h;
        const gCtx = gCanvas.getContext('2d', { alpha: false });
        if (gCtx) {
           gCtx.imageSmoothingEnabled = true;
           gradients.current = {};
        }
      }

      const minDim = Math.min(w, h);
      const radius = minDim * 0.36; 
      const cx = w > 768 ? w * 0.65 : w / 2;
      const cy = h / 2;

      projectionRef.current.scale(radius * GLOBE_RENDER_SCALE).translate([(cx * GLOBE_RENDER_SCALE), (cy * GLOBE_RENDER_SCALE)]);
    };

    window.addEventListener('resize', handleResize);
    handleResize(); 
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
          const countries = ['IND', 'CHN', 'NGA', 'PAK', 'IDN', 'BRA', 'USA', 'BGD', 'ETH', 'MEX', 'PHL', 'COD', 'EGY', 'RUS', 'VNM', 'TUR', 'THA', 'FRA', 'DEU', 'GBR'];
          const target = countries[Math.floor(Math.random() * countries.length)];
          activeFlashes.current.set(target, Date.now());
        }
        spawn();
      }, nextDelay);
    };
    spawn();
    return () => { clearInterval(clockInterval); clearTimeout(spawnTimeoutId); };
  }, []);

  useEffect(() => {
    const gCanvas = globeCanvasRef.current;
    const fCanvas = fxCanvasRef.current;
    if (!gCanvas || !fCanvas) return;
    const gCtx = gCanvas.getContext('2d', { alpha: false });
    const fCtx = fCanvas.getContext('2d');
    if (!gCtx || !fCtx) return;

    let animId: number;
    const projection = projectionRef.current;
    const path = d3.geoPath(projection, gCtx);

    const render = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const deltaTime = (time - lastTimeRef.current) / 1000; // time in seconds since last frame
      lastTimeRef.current = time;

      // Normalize factor to keep existing speed feel (adjusting for old 60fps logic)
      const dtFactor = Math.min(deltaTime * 60, 2.0); // Cap it to avoid massive jumps on tab reactivation

      const { w, h } = dimensionsRef.current;
      const minDim = Math.min(w, h);
      const r = (minDim * 0.36) * GLOBE_RENDER_SCALE;
      const cx = (w > 768 ? w * 0.65 : w / 2) * GLOBE_RENDER_SCALE;
      const cy = (h / 2) * GLOBE_RENDER_SCALE;
      const timeNow = Date.now();

      fCtx.clearRect(0, 0, w, h);
      fCtx.globalCompositeOperation = 'screen';
      
      // Update & Draw Comets
      if (comets.current.length < 5 && Math.random() < 0.02) {
        const angle = Math.random() * Math.PI * 2;
        // speed increased by 30% from original logic
        const speed = (2 + Math.random() * 5) * 1.3; 
        comets.current.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          length: 50 + Math.random() * 150,
          alpha: 0,
          thickness: 1 + Math.random() * 2,
          decay: 0.002 + Math.random() * 0.005
        });
      }

      for (let i = comets.current.length - 1; i >= 0; i--) {
        const c = comets.current[i];
        c.x += c.vx * dtFactor;
        c.y += c.vy * dtFactor;
        c.alpha += 0.02 * dtFactor;
        
        if (c.x < -300 || c.x > w + 300 || c.y < -300 || c.y > h + 300) {
           comets.current.splice(i, 1);
           continue;
        }

        const angle = Math.atan2(c.vy, c.vx);
        const trailX = c.x - Math.cos(angle) * c.length;
        const trailY = c.y - Math.sin(angle) * c.length;

        const cometGrad = fCtx.createLinearGradient(c.x, c.y, trailX, trailY);
        const a = Math.min(c.alpha, 1);
        cometGrad.addColorStop(0, `rgba(255, 255, 255, ${a})`);
        cometGrad.addColorStop(0.2, `rgba(147, 197, 253, ${a * 0.8})`);
        cometGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        fCtx.save();
        fCtx.beginPath();
        fCtx.moveTo(c.x, c.y);
        fCtx.lineTo(trailX, trailY);
        fCtx.strokeStyle = cometGrad;
        fCtx.lineWidth = c.thickness;
        fCtx.lineCap = 'round';
        fCtx.stroke();

        fCtx.beginPath();
        fCtx.arc(c.x, c.y, c.thickness * 1.5, 0, Math.PI * 2);
        fCtx.fillStyle = '#fff';
        fCtx.shadowBlur = 10;
        fCtx.shadowColor = COLORS.COMET_GLOW;
        fCtx.fill();
        fCtx.restore();
      }

      // Update & Draw Pacifiers
      if (pacifierSpriteRef.current) {
        if (pacifiers.current.length < 8) {
          pacifiers.current.push({
            x: Math.random() * w, 
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * 120, // requested double speed logic
            vy: (Math.random() - 0.5) * 120,
            rot: Math.random() * Math.PI * 2, 
            rv: (Math.random() - 0.5) * 0.06,
            size: 30 + Math.random() * 25,
            alpha: 0
          });
        }
        for (let i = pacifiers.current.length - 1; i >= 0; i--) {
          const p = pacifiers.current[i];
          p.x += p.vx * deltaTime; 
          p.y += p.vy * deltaTime; 
          p.rot += p.rv * dtFactor;
          p.alpha = Math.min(p.alpha + 0.005 * dtFactor, 0.8);
          
          if (p.x < -300 || p.x > w + 300 || p.y < -300 || p.y > h + 300) {
            pacifiers.current.splice(i, 1);
            continue;
          }
          fCtx.save();
          fCtx.globalAlpha = p.alpha;
          fCtx.translate(p.x, p.y); 
          fCtx.rotate(p.rot);
          fCtx.drawImage(pacifierSpriteRef.current!, -p.size, -p.size, p.size * 2, p.size * 2);
          fCtx.restore();
        }
      }

      if (geoDataRef.current) {
        // Globe rotation now linked to clock time for perfect smoothness
        const rotation = (time * 0.001 * AUTO_ROTATION_SPEED) % 360;
        projection.rotate([rotation, INITIAL_PHI, 0]);

        gCtx.fillStyle = '#000000';
        gCtx.fillRect(0, 0, w * GLOBE_RENDER_SCALE, h * GLOBE_RENDER_SCALE);

        starsRef.current.forEach(s => {
          s.opacity += (Math.random() - 0.5) * s.twinkle * dtFactor;
          s.opacity = Math.max(0.05, Math.min(0.7, s.opacity));
          gCtx.fillStyle = `rgba(255, 255, 255, ${s.opacity})`;
          gCtx.beginPath();
          gCtx.arc(s.x * w * GLOBE_RENDER_SCALE, s.y * h * GLOBE_RENDER_SCALE, s.size, 0, Math.PI * 2);
          gCtx.fill();
        });

        if (!gradients.current.ocean) {
          gradients.current.ocean = gCtx.createRadialGradient(cx - r * 0.4, cy - r * 0.4, 0, cx, cy, r);
          gradients.current.ocean.addColorStop(0, COLORS.OCEAN_BRIGHT);
          gradients.current.ocean.addColorStop(1, COLORS.OCEAN_DEEP);
        }
        gCtx.fillStyle = gradients.current.ocean!;
        gCtx.beginPath(); gCtx.arc(cx, cy, r, 0, Math.PI * 2); gCtx.fill();

        // Draw landmasses
        gCtx.beginPath(); path(geoDataRef.current);
        gCtx.fillStyle = COLORS.LAND_BASE; 
        gCtx.fill();
        gCtx.strokeStyle = COLORS.LAND_BORDER;
        gCtx.lineWidth = 1.2; 
        gCtx.stroke();

        if (!gradients.current.rimShadow) {
          gradients.current.rimShadow = gCtx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r);
          gradients.current.rimShadow.addColorStop(0, 'rgba(0,0,0,0)');
          gradients.current.rimShadow.addColorStop(1, 'rgba(0,0,0,0.85)');
        }
        gCtx.fillStyle = gradients.current.rimShadow!;
        gCtx.beginPath(); gCtx.arc(cx, cy, r, 0, Math.PI * 2); gCtx.fill();

        activeFlashes.current.forEach((flashTime, id) => {
          const feature = featuresMapRef.current.get(id);
          if (feature) {
            const duration = 2200;
            const t = Math.min((timeNow - flashTime) / duration, 1);
            if (t >= 1) { 
              activeFlashes.current.delete(id); 
            } else {
              const distance = d3.geoDistance(feature.centroid, [-rotation, -INITIAL_PHI]);
              if (distance < 1.57) { 
                gCtx.save();
                gCtx.beginPath(); path(feature);
                const intensity = Math.pow(1 - t, 0.4); 
                const flashColor = d3.interpolateRgb(
                    d3.interpolateRgb(COLORS.YELLOW_PEAK, COLORS.YELLOW_VIBRANT)(t * 1.5),
                    COLORS.LAND_BASE
                )(t);
                gCtx.shadowBlur = 60 * intensity;
                gCtx.shadowColor = COLORS.YELLOW_VIBRANT;
                gCtx.fillStyle = flashColor;
                gCtx.fill();
                gCtx.restore();
              }
            }
          }
        });

        if (!gradients.current.spec) {
          gradients.current.spec = gCtx.createRadialGradient(cx - r * 0.4, cy - r * 0.4, 0, cx - r * 0.4, cy - r * 0.4, r * 1.4);
          gradients.current.spec.addColorStop(0, COLORS.SPECULAR);
          gradients.current.spec.addColorStop(1, 'rgba(0,0,0,0)');
        }
        gCtx.fillStyle = gradients.current.spec!;
        gCtx.beginPath(); gCtx.arc(cx, cy, r, 0, Math.PI * 2); gCtx.fill();

        if (!gradients.current.atmo) {
          gradients.current.atmo = gCtx.createRadialGradient(cx, cy, r, cx, cy, r * 1.15);
          gradients.current.atmo.addColorStop(0, COLORS.ATMOSPHERE);
          gradients.current.atmo.addColorStop(0.3, 'rgba(168, 85, 247, 0.08)');
          gradients.current.atmo.addColorStop(1, 'rgba(0,0,0,0)');
        }
        gCtx.fillStyle = gradients.current.atmo!;
        gCtx.beginPath(); gCtx.arc(cx, cy, r * 1.15, 0, Math.PI * 2); gCtx.fill();
      }
      animId = requestAnimationFrame(render);
    };
    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  const renderFormattedTotal = (val: number) => {
    const str = val.toLocaleString('en-US').replace(/,/g, '.');
    return str.split('').map((char, i) => (
      <span key={i} className={char === '.' ? "px-[1.5px]" : ""}>{char}</span>
    ));
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-black flex flex-col font-sans select-none">
      <canvas 
        ref={globeCanvasRef} 
        className="absolute inset-0 z-0" 
        style={{ 
          pointerEvents: 'none', 
          transform: `scale(${1 / GLOBE_RENDER_SCALE})`, 
          transformOrigin: '0 0',
          width: `${GLOBE_RENDER_SCALE * 100}%`,
          height: `${GLOBE_RENDER_SCALE * 100}%`,
        }} 
      />
      
      <canvas ref={fxCanvasRef} className="absolute inset-0 z-10 w-full h-full pointer-events-none mix-blend-screen" />

      {/* Brand Logo */}
      <div className="absolute top-8 left-8 md:top-12 md:left-16 z-40 pointer-events-none">
        <div className="flex flex-col items-start w-fit">
          <div className="font-bold tracking-tight text-[0.6rem] md:text-[1.2rem] leading-[1.1] uppercase" style={{ color: COLORS.HEADER_PURPLE, fontFamily: "'Montserrat', sans-serif" }}>
            Mother & Child Care — Women's Health
          </div>
          <div className="w-full h-[2px] md:h-[4px] mt-1" style={{ backgroundColor: COLORS.YELLOW_VIBRANT }}></div>
        </div>
      </div>

      {/* Data HUD */}
      <div className="absolute inset-y-0 left-0 z-40 flex flex-col justify-center pl-10 md:pl-20 pointer-events-none w-full max-w-[900px]">
        <div className="flex flex-col items-start w-full translate-y-[-5%]">
          <div className="mb-0.5">
            <span className="font-bold uppercase tracking-[0.4em] text-[0.4rem] md:text-[0.6rem] opacity-90" style={{ color: COLORS.YELLOW_VIBRANT }}>Global birth count today</span>
          </div>
          
          <div className="mb-2 relative">
            <span className="text-[6vw] md:text-[88px] font-normal leading-none tabular-nums tracking-[0.02em]" 
              style={{ fontFamily: "'Bebas Neue', cursive", color: COLORS.YELLOW_VIBRANT, filter: `drop-shadow(0 0 15px rgba(250, 204, 21, 0.4))` }}>
              {renderFormattedTotal(total)}
            </span>
          </div>

          <div className="w-[35%] md:w-[32%] relative mt-4">
            <div className="flex justify-between items-end mb-2 relative h-4">
              <span className="font-bold uppercase tracking-[0.4em] text-[0.4rem] md:text-[0.5rem]" style={{ color: COLORS.YELLOW_VIBRANT }}>Daily Progress</span>
              <span className="font-mono text-[9px] md:text-[12px] tabular-nums font-bold tracking-widest" style={{ color: COLORS.YELLOW_VIBRANT }}>{Math.floor(timeState.pct)}%</span>
            </div>

            <div className="h-[4px] w-full bg-white/10 rounded-full overflow-hidden relative backdrop-blur-md">
              <div 
                className="h-full rounded-full transition-all duration-1000 ease-linear shadow-[0_0_10px_rgba(34,197,94,0.6)]"
                style={{ width: `${timeState.pct}%`, background: `linear-gradient(90deg, #064e3b 0%, ${COLORS.PROGRESS_GREEN} 100%)` }} 
              />
            </div>

            <div 
              className="absolute top-6 transition-all duration-1000 ease-linear"
              style={{ left: `${timeState.pct}%`, transform: 'translateX(-50%)' }}
            >
              <div className="flex flex-col items-center">
                <div className="w-[1px] h-3 mb-1" style={{ backgroundColor: COLORS.YELLOW_VIBRANT }}></div>
                <div className="px-2.5 py-1 bg-black/60 backdrop-blur-xl border border-white/10 rounded shadow-2xl">
                    <span className="font-mono text-[0.7rem] md:text-[1rem] font-black tracking-[0.1em] tabular-nums" style={{ color: COLORS.YELLOW_VIBRANT }}>
                      {timeState.label}
                    </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none z-10 bg-gradient-to-r from-black/80 via-black/10 to-transparent" />
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-black/60 to-transparent z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-full h-48 bg-gradient-to-t from-black/60 to-transparent z-10 pointer-events-none" />
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<GlobalApp />);
}
