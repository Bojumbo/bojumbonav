import React from 'react';
import { Compass, Gauge, AlertTriangle } from 'lucide-react';

export default function Speedometer({ speedKmh = 0, maxSpeedLimit = 80, heading = 0, followDriver, onToggleFollow }) {
  const isOverSpeed = speedKmh > maxSpeedLimit;

  return (
    <div className="absolute top-20 right-3 z-20 flex flex-col items-end gap-2">
      
      {/* Speedometer Gauge Widget */}
      <div className={`glass-panel rounded-2xl p-3 shadow-2xl flex flex-col items-center justify-center border transition-all duration-300 ${
        isOverSpeed ? 'border-rose-500/80 bg-rose-950/80 ring-2 ring-rose-500/50 animate-pulse' : 'border-slate-700/80'
      }`}>
        <div className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-slate-400">
          <Gauge className="w-3.5 h-3.5 text-blue-400" />
          <span>GPS Швидкість</span>
        </div>

        <div className="text-3xl font-extrabold font-mono tracking-tighter text-slate-100 mt-1">
          {Math.round(speedKmh)}
          <span className="text-xs font-normal text-slate-400 font-sans ml-1">км/год</span>
        </div>

        {/* European Speed Limit Traffic Sign Indicator */}
        <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-slate-800/80 w-full justify-center">
          <div className={`w-7 h-7 rounded-full bg-white border-[3px] border-rose-600 flex items-center justify-center text-slate-950 font-black text-xs font-sans shadow-md ${
            isOverSpeed ? 'animate-bounce border-rose-500 ring-2 ring-rose-400' : ''
          }`}>
            {maxSpeedLimit}
          </div>
          <div className="text-left leading-tight">
            <span className={`text-[9px] font-extrabold uppercase block ${isOverSpeed ? 'text-rose-400' : 'text-slate-400'}`}>
              {isOverSpeed ? 'Увага!' : 'Обмеження'}
            </span>
            <span className="text-[10px] font-bold text-slate-200">
              {maxSpeedLimit} км/год
            </span>
          </div>
        </div>
      </div>

      {/* Compass Bearing & Auto-Recenter Toggle */}
      <button
        onClick={onToggleFollow}
        className={`p-2.5 rounded-xl border transition shadow-xl flex items-center gap-1.5 text-xs font-bold ${
          followDriver
            ? 'bg-blue-600 border-blue-400 text-white shadow-blue-600/30'
            : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:bg-slate-800'
        }`}
        title={followDriver ? 'Слідування за автівкою увімкнено' : 'Увімкнути слідування за GPS'}
      >
        <Compass
          className="w-4 h-4 transition-transform duration-300"
          style={{ transform: `rotate(${heading || 0}deg)` }}
        />
        <span className="text-[11px] font-mono">{Math.round(heading || 0)}°</span>
      </button>

    </div>
  );
}
