import React, { useState, useEffect, useRef } from 'react';
import { Truck, MapPin, Settings, Layers, FolderDown, Navigation2, X, Plus } from 'lucide-react';
import { searchAddress } from '../services/routingService';

export default function Header({
  profile,
  userLocation,
  onOpenProfile,
  onOpenPoiManager,
  onOpenSettings,
  onCalculateWaypointsRoute,
  activeRoute,
  onClearRoute,
  mapTheme,
  onToggleMapTheme,
  isNavigating,
  onToggleNavigation,
  waypoints = [],
  onSetStartPoint,
  onAddViaPoint,
  onSetEndPoint,
}) {
  const [startQuery, setStartQuery] = useState('');
  const [endQuery, setEndQuery] = useState('');
  const [startResults, setStartResults] = useState([]);
  const [endResults, setEndResults] = useState([]);
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [viaPoints, setViaPoints] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [activeSearch, setActiveSearch] = useState(null);

  const searchTimeoutRef = useRef(null);

  const userLat = userLocation ? userLocation[0] : 49.8429;
  const userLon = userLocation ? userLocation[1] : 24.0311;

  const handleStartSearch = (val) => {
    setStartQuery(val);
    if (!val.trim()) {
      setStartResults([]);
      setActiveSearch(null);
      return;
    }
    setActiveSearch('start');
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      const res = await searchAddress(val, userLat, userLon);
      setStartResults(res);
    }, 350);
  };

  const handleEndSearch = (val) => {
    setEndQuery(val);
    if (!val.trim()) {
      setEndResults([]);
      setActiveSearch(null);
      return;
    }
    setActiveSearch('end');
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      const res = await searchAddress(val, userLat, userLon);
      setEndResults(res);
    }, 350);
  };

  // Sync from map-click waypoints coming from parent
  useEffect(() => {
    if (!waypoints || waypoints.length === 0) return;
    const sp = waypoints[0];
    if (sp) { setStartPoint(sp); setStartQuery(sp.shortName || `${sp.lat?.toFixed(4)}, ${sp.lon?.toFixed(4)}`); }
    if (waypoints.length > 1) {
      const ep = waypoints[waypoints.length - 1];
      setEndPoint(ep); setEndQuery(ep.shortName || `${ep.lat?.toFixed(4)}, ${ep.lon?.toFixed(4)}`);
    }
    setViaPoints(waypoints.length > 2 ? waypoints.slice(1, waypoints.length - 1) : []);
  }, [waypoints]);

  const selectStart = (item) => {
    setStartPoint(item);
    setStartQuery(item.shortName);
    setStartResults([]);
    setActiveSearch(null);
    onSetStartPoint?.(item);
  };

  const selectEnd = (item) => {
    setEndPoint(item);
    setEndQuery(item.shortName);
    setEndResults([]);
    setActiveSearch(null);
    onSetEndPoint?.(item);
  };

  const handleAddViaRow = () => {
    const placeholder = { id: `via-${Date.now()}`, shortName: 'Клікніть на карту…', lat: null, lon: null, isPlaceholder: true };
    setViaPoints(prev => [...prev, placeholder]);
    onAddViaPoint?.(placeholder);
  };

  const handleRemoveVia = (idx) => setViaPoints(prev => prev.filter((_, i) => i !== idx));

  const triggerCalculateRoute = async () => {
    if (!startPoint || !endPoint) return;
    setIsLoading(true);
    const validVias = viaPoints.filter(v => v.lat != null && v.lon != null && !v.isPlaceholder);
    const pts = [startPoint, ...validVias, endPoint];
    try {
      await onCalculateWaypointsRoute?.(pts, startPoint.shortName, endPoint.shortName);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const useCurrentLocationAsStart = () => {
    if (!('geolocation' in navigator)) {
      alert('GPS не підтримується вашим браузером');
      return;
    }
    setIsGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsGpsLoading(false);
        const item = {
          id: 'current-gps',
          shortName: 'Моє гео-положення (GPS)',
          lat: pos.coords.latitude,
          lon: pos.coords.longitude
        };
        selectStart(item);
      },
      (err) => {
        setIsGpsLoading(false);
        const msgs = {
          1: 'Доступ до GPS заборонено. Дозвольте геолокацію в браузері.',
          2: 'GPS позиція недоступна. Перевірте сигнал.',
          3: 'GPS timeout. Спробуйте ще раз.'
        };
        alert(msgs[err.code] || 'GPS помилка: ' + err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      }
    );
  };

  return (
    <header className="relative z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 p-2 sm:p-3 shadow-xl">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2 sm:gap-3">

        {/* Brand & Truck Profile Selector */}
        <div className="flex items-center justify-between w-full md:w-auto gap-2">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-amber-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-indigo-200 bg-clip-text text-transparent leading-tight">
                TruckNav <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">PWA</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-medium">HGV Truck Navigator</p>
            </div>
          </div>

          {/* Truck Profile Badge Button */}
          <button
            onClick={onOpenProfile}
            className="flex items-center gap-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700/80 transition shadow-sm group"
            title="Змінити габарити ТЗ"
          >
            <div className={`w-2 h-2 rounded-full ${profile.hazmat ? 'bg-amber-500 animate-pulse' : 'bg-emerald-400'}`} />
            <span className="font-semibold text-blue-400">{profile.weight}t</span>
            <span className="text-slate-400 font-mono text-[11px]">({profile.height}m / {profile.length}m)</span>
            {profile.hazmat && (
              <span className="bg-amber-500/20 text-amber-300 text-[9px] px-1 rounded font-bold border border-amber-500/40">ADR</span>
            )}
          </button>
        </div>

        {/* Route Search Inputs */}
        <div className="flex-1 w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-2 relative">
          
          {/* Start Point Input */}
          <div className="relative">
            <div className="relative flex items-center">
              <div className="absolute left-2.5 text-emerald-400">
                <MapPin className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={startQuery}
                onChange={(e) => handleStartSearch(e.target.value)}
                onFocus={() => startQuery.trim() && setActiveSearch('start')}
                placeholder="Звідки (наприклад: Київ, Львів...)"
                className="w-full bg-slate-950/80 text-xs sm:text-sm pl-8 pr-7 py-2 rounded-lg border border-slate-700/80 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              {startQuery ? (
                <button onClick={() => { setStartQuery(''); setStartPoint(null); setStartResults([]); setActiveSearch(null); }} className="absolute right-2 text-slate-400 hover:text-slate-200">
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={useCurrentLocationAsStart}
                  disabled={isGpsLoading}
                  title={isGpsLoading ? 'Визначення GPS...' : 'Використати моє GPS місцезнаходження'}
                  className={`absolute right-2 transition ${isGpsLoading ? 'text-amber-400 animate-pulse cursor-wait' : 'text-blue-400 hover:text-blue-300'}`}
                >
                  {isGpsLoading
                    ? <div className="w-3.5 h-3.5 border-2 border-amber-400/40 border-t-amber-400 rounded-full animate-spin" />
                    : <Navigation2 className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>

            {/* Start Autocomplete Dropdown */}
            {activeSearch === 'start' && startResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-800">
                {startResults.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => selectStart(item)}
                    className="w-full text-left px-3 py-2 hover:bg-slate-800 transition text-xs flex items-start gap-2"
                  >
                    <span className="shrink-0 mt-0.5 text-base leading-none">
                      {item.type === 'coordinates' ? '🎯' : item.type === 'amenity' ? '🏪' : item.type === 'shop' ? '🛒' : item.type === 'office' ? '🏢' : '📍'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-slate-200 font-semibold truncate">{item.shortName}</p>
                      {item.type !== 'coordinates' && (
                        <p className="text-slate-500 truncate text-[10px]">{item.name}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Start Search Hint if no exact company match */}
            {activeSearch === 'start' && startQuery.trim().length >= 2 && startResults.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 p-3 text-xs text-slate-300 space-y-1">
                <p className="font-semibold text-amber-400 flex items-center gap-1">
                  <span>💡</span> <span>Компанію не знайдено в базі даних</span>
                </p>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Введіть <strong>назву населеного пункту</strong> або точні <strong>GPS-координати</strong> (напр. <code className="text-blue-300 bg-slate-950 px-1 rounded">49.4215, 26.9812</code> чи <code className="text-blue-300 bg-slate-950 px-1 rounded">49°25'17"N 26°58'52"E</code>).
                </p>
              </div>
            )}
          </div>

          {/* End Point Input */}
          <div className="relative">
            <div className="relative flex items-center">
              <div className="absolute left-2.5 text-rose-500">
                <MapPin className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={endQuery}
                onChange={(e) => handleEndSearch(e.target.value)}
                onFocus={() => endQuery.trim() && setActiveSearch('end')}
                placeholder="Куди (наприклад: Хмельницький, Варшава...)"
                className="w-full bg-slate-950/80 text-xs sm:text-sm pl-8 pr-7 py-2 rounded-lg border border-slate-700/80 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              {endQuery && (
                <button onClick={() => { setEndQuery(''); setEndPoint(null); setEndResults([]); setActiveSearch(null); }} className="absolute right-2 text-slate-400 hover:text-slate-200">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* End Autocomplete Dropdown */}
            {activeSearch === 'end' && endResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-800">
                {endResults.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => selectEnd(item)}
                    className="w-full text-left px-3 py-2 hover:bg-slate-800 transition text-xs flex items-start gap-2"
                  >
                    <span className="shrink-0 mt-0.5 text-base leading-none">
                      {item.type === 'coordinates' ? '🎯' : item.type === 'amenity' ? '🏪' : item.type === 'shop' ? '🛒' : item.type === 'office' ? '🏢' : '📍'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-slate-200 font-semibold truncate">{item.shortName}</p>
                      {item.type !== 'coordinates' && (
                        <p className="text-slate-500 truncate text-[10px]">{item.name}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* End Search Hint if no exact company match */}
            {activeSearch === 'end' && endQuery.trim().length >= 2 && endResults.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 p-3 text-xs text-slate-300 space-y-1">
                <p className="font-semibold text-amber-400 flex items-center gap-1">
                  <span>💡</span> <span>Компанію не знайдено в базі даних</span>
                </p>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Введіть <strong>назву населеного пункту</strong> або точні <strong>GPS-координати</strong> (напр. <code className="text-blue-300 bg-slate-950 px-1 rounded">49.4215, 26.9812</code> чи <code className="text-blue-300 bg-slate-950 px-1 rounded">49°25'17"N 26°58'52"E</code>).
                </p>
              </div>
            )}
          </div>

          {/* Intermediate Via-Points List & Controls */}
          {viaPoints.length > 0 && (
            <div className="space-y-1 pt-1">
              {viaPoints.map((via, idx) => (
                <div key={via.id || idx} className="flex items-center gap-1.5 bg-slate-950/90 border border-blue-500/40 rounded-lg px-2.5 py-1 text-xs text-slate-200">
                  <span className="w-4 h-4 rounded-full bg-blue-600 text-white font-bold text-[9px] flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="font-semibold text-blue-300 truncate flex-1">
                    {via.shortName || `${via.lat?.toFixed(4)}, ${via.lon?.toFixed(4)}` || 'Клікніть на карту для вибору точки'}
                  </span>
                  <button onClick={() => handleRemoveVia(idx)} className="text-slate-400 hover:text-rose-400 p-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add Via Point & Map Click Helper */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-0.5">
            <button
              onClick={handleAddViaRow}
              className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 hover:underline"
            >
              <span>+ Проміжна точка</span>
            </button>
            <span className="text-slate-500 hidden sm:block">💡 Клікніть будь-де на карті: Старт / Через / Фініш</span>
          </div>
        </div>

        {/* Action Controls & Navigation Mode Toggle */}
        <div className="flex items-center gap-1.5 w-full md:w-auto justify-end">
          
          {/* Calculate Route Button */}
          <button
            onClick={triggerCalculateRoute}
            disabled={!startPoint || !endPoint || isLoading}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition shadow-md ${
              startPoint && endPoint
                ? 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95 shadow-blue-500/25'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-800'
            }`}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Navigation2 className="w-4 h-4" />
            )}
            <span>А Маршрут{viaPoints.filter(v => !v.isPlaceholder && v.lat).length > 0 ? ` (${2 + viaPoints.filter(v => !v.isPlaceholder && v.lat).length} т.)` : ''}</span>
          </button>

          {activeRoute && (
            <button
              onClick={onClearRoute}
              className="p-2 bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 rounded-lg border border-slate-700 transition"
              title="Очистити маршрут"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* POI / Import Manager Modal Button */}
          <button
            onClick={onOpenPoiManager}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-2.5 py-2 rounded-lg border border-slate-700/80 transition"
            title="Імпорт KML/GeoJSON та Точки"
          >
            <FolderDown className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">POI / KML</span>
          </button>

          {/* Map Theme Toggle Button */}
          <button
            onClick={onToggleMapTheme}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700/80 transition"
            title={`Режим карти: ${mapTheme === 'dark' ? 'Нічний' : 'Денний'}`}
          >
            <Layers className="w-4 h-4" />
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700/80 transition"
            title="Налаштування API та Карти"
          >
            <Settings className="w-4 h-4" />
          </button>

        </div>

      </div>
    </header>
  );
}
