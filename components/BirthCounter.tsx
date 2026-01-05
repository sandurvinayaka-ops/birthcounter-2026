
import React, { useEffect, useState, useRef } from 'react';

interface BirthCounterProps {
  label: string;
  count: number;
  icon?: React.ReactNode;
  className?: string;
}

const BirthCounter: React.FC<BirthCounterProps> = ({ label, count, icon, className }) => {
  const [displayCount, setDisplayCount] = useState(count);
  const prevCountRef = useRef(count);

  useEffect(() => {
    setDisplayCount(count);
    prevCountRef.current = count;
  }, [count]);

  return (
    <div className={`transition-all duration-300 ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-black tracking-[0.3em] text-amber-500/80 uppercase">
          {label}
        </span>
      </div>
      <div className="text-7xl xl:text-8xl font-black text-amber-400 tabular-nums mono tracking-tighter drop-shadow-[0_0_25px_rgba(245,158,11,0.5)]">
        {displayCount.toLocaleString()}
      </div>
    </div>
  );
};

export default BirthCounter;
