import React from 'react';
import { Navigation2, ArrowRight, ArrowLeft, ArrowUpRight, ArrowUpLeft, AlertCircle, X, ShieldAlert } from 'lucide-react';

export default function NavigationOverlay({ routeData, profile, onStopNavigation }) {
  if (!routeData || !routeData.steps || routeData.steps.length === 0) return null;

  const currentStep = routeData.steps[0];
  const nextStep = routeData.steps[1];

  return (
    <div className="absolute top-16 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-xl z-20 pointer-events-none">
      <div className="pointer-events-auto bg-slate-900/95 backdrop-blur-xl border border-slate-700/90 rounded-2xl p-3 sm:p-4 shadow-2xl space-y-2">
        
        {/* Active Maneuver Banner */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/40 shrink-0 font-extrabold text-xl">
            {getManeuverIcon(currentStep.type)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold font-mono text-emerald-400">
                {currentStep.distance > 0 ? `${(currentStep.distance / 1000).toFixed(1)} км` : 'Зараз'}
              </span>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" />
                HGV Max {profile.height}m / {profile.weight}t
              </span>
            </div>
            <h2 className="text-sm sm:text-base font-bold text-slate-100 truncate leading-snug">
              {currentStep.instruction}
            </h2>
          </div>

          <button
            onClick={onStopNavigation}
            className="p-2 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 rounded-xl transition border border-slate-700/80 shrink-0"
            title="Завершити навігацію"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Next step preview */}
        {nextStep && (
          <div className="border-t border-slate-800/80 pt-2 flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px] font-medium text-slate-500">Далі:</span>
            <span className="font-semibold text-slate-300 truncate max-w-xs">{nextStep.instruction}</span>
          </div>
        )}

      </div>
    </div>
  );
}

function getManeuverIcon(type) {
  if (type === null || type === undefined) return <Navigation2 className="w-6 h-6" />;
  const strType = String(type).toLowerCase();
  if (strType.includes('right') || strType === '1' || strType === '6') return <ArrowRight className="w-6 h-6" />;
  if (strType.includes('left') || strType === '0' || strType === '5') return <ArrowLeft className="w-6 h-6" />;
  return <Navigation2 className="w-6 h-6" />;
}
