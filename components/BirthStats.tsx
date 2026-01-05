
import React from 'react';

const BirthStats: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="p-6 rounded-2xl bg-slate-800/20 border border-slate-800/50 backdrop-blur-sm">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
          <span className="w-1 h-1 rounded-full bg-slate-600"></span>
          Global Insight
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed italic">
          "The world population reached 8 billion in late 2022. Every heartbeat marks a new story starting across our diverse planet. This simulation reflects the continuous rhythm of life that defines our shared human experience."
        </p>
      </div>
    </div>
  );
};

export default BirthStats;
