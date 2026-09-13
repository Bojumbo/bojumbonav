import React, { useState } from 'react';
import { Navigation, Clock, ShieldCheck, ChevronDown, ChevronUp, Search, Play, CheckCircle2, Route, AlertTriangle, Key } from 'lucide-react';
import { detectRouteSignConflicts } from '../utils/routeSafety';

export default function RoutePanel({
  routeData,
  routeAlternatives = [],
  startName,
  endName,
  onFetchOverpassPois,
  isLoadingOverpass,
  onFetchHgvRestrictions,
  isLoadingRestrictions,
  hgvRestrictionsCount = 0,
  hgvRestrictions = [],
  onOpenSettings,
  onStartNavigation,
  onSelectAlternative,
  isNavigating
}) {
  const [showSteps, setShowSteps] = useState(false);

  if (!routeData) return null;

  const { distanceKm, durationText, steps, engine, index: activeIndex = 0 } = routeData;
  const conflicts = detectRouteSignConflicts(routeData, hgvRestrictions);

  // Percentage difference vs active
  const pctDiff = (km) => {
    const diff = ((km - distanceKm) / distanceKm) * 100;
    return diff > 0 ? `+${diff.toFixed(0)}%` : `${diff.toFixed(0)}%`;
  };

  return (
    <div className="absolute bottom-4 left-3 right-3 sm:left-4 sm:w-[22rem] z-20 bg-slate-900/95 backdrop-blur-md border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5 duration-300">

      {/* ── Route Header ── */}
      <div className="p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-400">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>{engine}</span>
            </div>
            <h3 className="text-xl font-extrabold text-slate-100 mt-0.5 font-mono">
              {distanceKm} <span className="text-sm font-normal text-slate-400 font-sans">км</span>
            </h3>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-1 text-emerald-400 font-bold text-base">
              <Clock className="w-4 h-4" />
              <span>{durationText}</span>
            </div>
            <span className="text-[10px] text-slate-400">обмеження 80 км/год</span>
          </div>
        </div>

        {/* Start / Finish labels */}
        <div className="bg-slate-950/70 rounded-xl p-2.5 text-xs space-y-1.5 border border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
            <span className="text-slate-400 shrink-0 font-medium">Старт:</span>
            <span className="text-slate-200 font-semibold truncate">{startName || 'Початкова точка'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
            <span className="text-slate-400 shrink-0 font-medium">Фініш:</span>
            <span className="text-slate-200 font-semibold truncate">{endName || 'Кінцева точка'}</span>
          </div>
        </div>

        {/* ── HGV Sign Violation Warning Banner ── */}
        {conflicts.length > 0 && (
          <div className="bg-rose-950/90 border border-rose-600/80 rounded-xl p-3 text-xs text-rose-200 space-y-2 animate-pulse shadow-lg shadow-rose-900/30">
            <div className="flex items-center gap-1.5 font-bold text-rose-300">
              <AlertTriangle className="w-4.5 h-4.5 text-rose-400 shrink-0" />
              <span>УВАГА! Маршрут прокладено під {conflicts.length} знаків HGV ⛔</span>
            </div>
            <p className="text-[11px] text-rose-200/90 leading-snug">
              Поточний роутер проходить через знаки заборони вантажного руху у центрі міста. Активуйте ORS HGV роутер для вантажного об'їзду.
            </p>
            <button
              onClick={onOpenSettings}
              className="w-full flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs py-1.5 px-2.5 rounded-lg transition shadow-md"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Увімкнути HGV Роутер (ORS API Key)</span>
            </button>
          </div>
        )}

        {/* ── Alternative routes selector ── */}
        {routeAlternatives.length > 1 && (
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mb-1.5">
              <Route className="w-3.5 h-3.5" />
              <span>Варіанти маршруту ({routeAlternatives.length})</span>
            </div>
            <div className="space-y-1">
              {routeAlternatives.map((alt, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={idx}
                    onClick={() => !isActive && onSelectAlternative?.(idx)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition border ${
                      isActive
                        ? 'bg-blue-600/20 border-blue-500/60 text-slate-100 cursor-default'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200 hover:border-slate-600'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${isActive ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                        {idx + 1}
                      </span>
                      <span>{alt.distanceKm} км · {alt.durationText}</span>
                    </span>
                    {isActive ? (
                      <span className="text-blue-400 text-[10px] font-bold">АКТИВНИЙ</span>
                    ) : (
                      <span className="text-slate-500 text-[10px]">{pctDiff(alt.distanceKm)}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Action buttons ── */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onFetchOverpassPois}
              disabled={isLoadingOverpass}
              className="flex items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-xl py-2 px-2 text-xs font-bold transition"
            >
              {isLoadingOverpass
                ? <div className="w-3.5 h-3.5 border-2 border-amber-300/30 border-t-amber-300 rounded-full animate-spin" />
                : <Search className="w-3.5 h-3.5" />}
              <span>TIR-Паркінги</span>
            </button>

            <button
              onClick={onFetchHgvRestrictions}
              disabled={isLoadingRestrictions}
              className="flex items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 rounded-xl py-2 px-2 text-xs font-bold transition"
              title="Завантажити та відобразити знаки обмежень ваги/висоти HGV на карті"
            >
              {isLoadingRestrictions
                ? <div className="w-3.5 h-3.5 border-2 border-rose-300/30 border-t-rose-300 rounded-full animate-spin" />
                : <span>⛔ Знаки HGV {hgvRestrictionsCount > 0 ? `(${hgvRestrictionsCount})` : ''}</span>}
            </button>
          </div>

          <button
            onClick={onStartNavigation}
            className={`w-full flex items-center justify-center gap-1.5 font-bold rounded-xl py-2.5 px-3 text-xs transition shadow-lg ${
              isNavigating
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
            }`}
          >
            {isNavigating ? (
              <><CheckCircle2 className="w-4 h-4" /><span>Стоп Навігація</span></>
            ) : (
              <><Play className="w-4 h-4 fill-current" /><span>Почати Поїздку</span></>
            )}
          </button>
        </div>
      </div>

      {/* ── Turn-by-turn steps ── */}
      {steps && steps.length > 0 && (
        <div className="border-t border-slate-800">
          <button
            onClick={() => setShowSteps(!showSteps)}
            className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 px-4 py-2.5 font-semibold transition"
          >
            <span>Покрокова інструкція ({steps.length} маневрів)</span>
            {showSteps ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showSteps && (
            <div className="max-h-48 overflow-y-auto divide-y divide-slate-800 bg-slate-950/80 p-2 space-y-1.5">
              {steps.map((step, idx) => (
                <div key={idx} className="pt-1.5 pb-1 flex items-start gap-2 text-xs">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-blue-400 font-mono text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-slate-200 font-medium">{step.instruction}</p>
                    {step.distance > 0 && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        {(step.distance / 1000).toFixed(1)} км ({Math.round(step.duration / 60)} хв)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
