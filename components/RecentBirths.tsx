
import React from 'react';
import { BirthEvent } from '../types';
import { Baby, Clock } from 'lucide-react';

interface RecentBirthsProps {
  births: BirthEvent[];
}

const RecentBirths: React.FC<RecentBirthsProps> = ({ births }) => {
  return (
    <div className="flex flex-col">
      <div className="px-8 py-6">
        <h2 className="text-[10px] font-black tracking-[0.3em] text-slate-400 uppercase flex items-center gap-3">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
          Live Event Stream
        </h2>
      </div>
      
      <div className="px-4 pb-4">
        {births.length === 0 ? (
          <div className="py-20 flex items-center justify-center text-slate-600 text-xs font-bold uppercase tracking-widest">
            Establishing Link...
          </div>
        ) : (
          <div className="space-y-2">
            {births.map((birth) => (
              <div 
                key={birth.id} 
                className={`flex items-center gap-4 p-4 rounded-2xl border border-slate-800/30 bg-slate-800/10 hover:bg-slate-800/40 transition-all duration-300 animate-in fade-in slide-in-from-left-4`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
                  birth.gender === 'boy' ? 'border-blue-500/20 bg-blue-500/10' : 'border-pink-500/20 bg-pink-500/10'
                }`}>
                  <Baby className={`w-6 h-6 ${birth.gender === 'boy' ? 'text-blue-400' : 'text-pink-400'}`} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-sm font-bold text-white truncate uppercase tracking-tight">
                      New Birth Detected
                    </p>
                    <span className="text-[9px] text-slate-500 font-mono flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(birth.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-widest ${
                      birth.gender === 'boy' ? 'bg-blue-900/40 text-blue-300' : 'bg-pink-900/40 text-pink-300'
                    }`}>
                      {birth.gender}
                    </span>
                    <span className="text-[9px] text-slate-600 font-bold tracking-[0.2em] uppercase">
                      SIGNAL_LOCKED
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentBirths;
