
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { COUNTRIES, GLOBAL_BIRTHS_PER_SECOND } from './constants';
import WorldMap from './components/WorldMap';
import BirthCounter from './components/BirthCounter';
import { Globe, Users } from 'lucide-react';

const App: React.FC = () => {
  const [totalToday, setTotalToday] = useState(0);
  const [activeCountryId, setActiveCountryId] = useState<string | null>(null);
  
  const totalTodayRef = useRef(0);

  useEffect(() => {
    const now = new Date();
    const secondsSinceMidnight = 
      now.getHours() * 3600 + 
      now.getMinutes() * 60 + 
      now.getSeconds();
    
    const initialToday = Math.floor(secondsSinceMidnight * GLOBAL_BIRTHS_PER_SECOND);
    setTotalToday(initialToday);
    totalTodayRef.current = initialToday;
  }, []);

  const getRandomCountry = useCallback(() => {
    const totalWeight = COUNTRIES.reduce((acc, curr) => acc + curr.weight, 0);
    let random = Math.random() * totalWeight;
    for (const country of COUNTRIES) {
      if (random < country.weight) return country;
      random -= country.weight;
    }
    return COUNTRIES[0];
  }, []);

  const triggerBirth = useCallback(() => {
    const country = getRandomCountry();
    totalTodayRef.current += 1;
    setTotalToday(totalTodayRef.current);
    setActiveCountryId(country.id);

    setTimeout(() => {
      setActiveCountryId(prev => prev === country.id ? null : prev);
    }, 1000);
  }, [getRandomCountry]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const scheduleNext = () => {
      const meanInterval = 1000 / GLOBAL_BIRTHS_PER_SECOND;
      const nextInterval = -Math.log(Math.random()) * meanInterval;
      timer = setTimeout(() => {
        triggerBirth();
        scheduleNext();
      }, nextInterval);
    };
    scheduleNext();
    return () => clearTimeout(timer);
  }, [triggerBirth]);

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden flex flex-col">
      {/* Main Content Area: Optimized for 3.5:1 Aspect Ratio */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* LEFT SIDE: Counter Panel (30% Width) */}
        <div className="w-[30%] flex flex-col border-r border-slate-800 bg-slate-900/40 relative">
          {/* Minimal Branding Overlay */}
          <div className="absolute top-4 left-6 flex items-center gap-2 opacity-50">
            <Globe className="w-4 h-4 text-amber-500 animate-pulse" />
            <span className="text-[10px] font-black tracking-[0.2em] text-amber-500 uppercase">Global Monitor</span>
          </div>

          <div className="flex-1 flex items-center justify-center px-6">
            <BirthCounter 
              label="WORLDWIDE BIRTHS TODAY" 
              count={totalToday} 
              icon={<Users className="w-5 h-5 text-amber-500" />}
              className="bg-transparent border-none p-0 w-full"
            />
          </div>

          {/* Minimal Status Indicator */}
          <div className="absolute bottom-4 left-6 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping"></div>
            <span className="text-[8px] font-bold text-slate-500 tracking-widest uppercase">Live Stream Active</span>
          </div>
        </div>

        {/* RIGHT SIDE: Map (70% Width) */}
        <div className="w-[70%] relative bg-slate-950 flex items-center justify-center overflow-hidden">
          <WorldMap activeCountryId={activeCountryId} />
          
          {/* Subtle Grid Pattern Overlay */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
        </div>

      </main>

      {/* Ultra-Thin Visual Footer */}
      <footer className="h-4 px-6 bg-black flex items-center justify-between border-t border-slate-900">
        <div className="flex items-center gap-4">
           <span className="text-[7px] text-slate-700 font-mono tracking-tighter">DATA_STREAM://V1.0.42_STABLE</span>
        </div>
        <div className="text-[7px] text-slate-700 font-mono">
          PANEL_SIZE: 698.4mm x 196.43mm | REFRESH: 60HZ
        </div>
      </footer>
    </div>
  );
};

export default App;
