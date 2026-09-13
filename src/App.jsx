import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import MapView from './components/MapView';
import VehicleProfileModal from './components/VehicleProfileModal';
import RoutePanel from './components/RoutePanel';
import PoiManagerModal from './components/PoiManagerModal';
import Speedometer from './components/Speedometer';
import NavigationOverlay from './components/NavigationOverlay';
import SettingsModal from './components/SettingsModal';

import { getStoredVehicleProfile, saveVehicleProfile, saveLastRoute, getLastRoute, clearLastRoute } from './services/profileStorage';
import { getStoredPois } from './services/poiStorage';
import { calculateTruckRouteAlternatives } from './services/routingService';
import { fetchOverpassHgvRestAreas, fetchOverpassHgvRestrictions, fetchOverpassRouteSigns } from './services/overpassService';

export default function App() {
  // Vehicle Profile State
  const [profile, setProfile] = useState(() => getStoredVehicleProfile());
  const [showProfileModal, setShowProfileModal] = useState(false);

  // POI & Custom Points State
  const [pois, setPois] = useState(() => getStoredPois());
  const [overpassPois, setOverpassPois] = useState([]);
  const [hgvRestrictions, setHgvRestrictions] = useState([]);
  const [showPoiModal, setShowPoiModal] = useState(false);
  const [isLoadingOverpass, setIsLoadingOverpass] = useState(false);
  const [isLoadingRestrictions, setIsLoadingRestrictions] = useState(false);

  // Route & Navigation State
  const [activeRoute, setActiveRoute] = useState(null);
  const [routeAlternatives, setRouteAlternatives] = useState([]); // all route options
  const [startName, setStartName] = useState('');
  const [endName, setEndName] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);
  const [followDriver, setFollowDriver] = useState(false);

  // Session restore banner
  const [restoredSession, setRestoredSession] = useState(false);

  // Settings & Theme State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [mapTheme, setMapTheme] = useState('dark');

  // Live Geolocation State
  const [userLocation, setUserLocation] = useState(null); // [lat, lon]
  const [userSpeed, setUserSpeed] = useState(0);          // km/h
  const [userHeading, setUserHeading] = useState(0);      // degrees

  // -------------------------------------------------------------------------
  // Restore last route session on first load
  // -------------------------------------------------------------------------
  useEffect(() => {
    const saved = getLastRoute();
    if (saved && saved.activeRoute) {
      const restoredRoute = { ...saved.activeRoute, startCoords: saved.startCoords, endCoords: saved.endCoords };
      setActiveRoute(restoredRoute);
      setStartName(saved.startName || '');
      setEndName(saved.endName || '');
      setRestoredSession(true);
      console.log('[App] Restored route session from localStorage');

      // Restore waypoints inputs in Header
      if (saved.waypoints && Array.isArray(saved.waypoints) && saved.waypoints.length > 0) {
        setWaypoints(saved.waypoints);
      } else if (saved.startCoords && saved.endCoords) {
        setWaypoints([
          { id: 'start-res', shortName: saved.startName || 'Старт', lat: saved.startCoords[1], lon: saved.startCoords[0] },
          { id: 'end-res', shortName: saved.endName || 'Фініш', lat: saved.endCoords[1], lon: saved.endCoords[0] }
        ]);
      }

      // Auto-fetch HGV restriction signs for restored route
      if (saved.startCoords && saved.endCoords) {
        handleFetchHgvRestrictions(saved.startCoords, saved.endCoords);
      }
    }
  }, []);

  // -------------------------------------------------------------------------
  // GPS watch
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed, heading } = pos.coords;
        setUserLocation([latitude, longitude]);
        if (speed !== null && speed !== undefined && speed >= 0) setUserSpeed(speed * 3.6);
        if (heading !== null && heading !== undefined && !isNaN(heading)) setUserHeading(heading);
      },
      (err) => console.warn('GPS position error:', err.message),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // -------------------------------------------------------------------------
  // Save profile and recalculate if route active
  // -------------------------------------------------------------------------
  const handleSaveProfile = (newProfile) => {
    saveVehicleProfile(newProfile);
    setProfile(newProfile);
    setShowProfileModal(false);
    if (activeRoute && activeRoute.startCoords && activeRoute.endCoords) {
      handleCalculateRoute(activeRoute.startCoords, activeRoute.endCoords, startName, endName, newProfile);
    }
  };

  // Multi-Waypoint State: array of point objects { id, shortName, lat, lon }
  const [waypoints, setWaypoints] = useState([]);

  // -------------------------------------------------------------------------
  // Calculate route with multi-waypoints
  // -------------------------------------------------------------------------
  const handleCalculateRoute = async (waypointsInput, sName = '', eName = '', customProf = null) => {
    let pts = waypointsInput;
    if (!Array.isArray(pts) || pts.length < 2) return;

    setWaypoints(pts);
    setStartName(sName || pts[0]?.shortName || 'Старт');
    setEndName(eName || pts[pts.length - 1]?.shortName || 'Фініш');
    setRestoredSession(false);

    const coordsArray = pts.map(p => [p.lon, p.lat]);

    try {
      const alternatives = await calculateTruckRouteAlternatives(coordsArray, null, customProf || profile);
      if (!alternatives || alternatives.length === 0) throw new Error('Маршрут не знайдено');

      // Tag each with index and coords
      const tagged = alternatives.map((r, i) => ({
        ...r,
        index: i,
        startCoords: coordsArray[0],
        endCoords: coordsArray[coordsArray.length - 1],
        waypoints: pts
      }));

      setRouteAlternatives(tagged);
      setActiveRoute(tagged[0]);
      setOverpassPois([]);

      // Auto-fetch HGV restriction signs for destination region
      handleFetchHgvRestrictions(coordsArray[0], coordsArray[coordsArray.length - 1]);

      // Persist session
      saveLastRoute({
        startCoords: coordsArray[0],
        endCoords: coordsArray[coordsArray.length - 1],
        startName: sName || pts[0]?.shortName,
        endName: eName || pts[pts.length - 1]?.shortName,
        activeRoute: tagged[0],
        routeAlternatives: tagged,
      });
    } catch (e) {
      alert('Помилка побудови маршруту: ' + e.message);
    }
  };

  // Map Click Handler: Set Start
  const handleSetStartPoint = (point) => {
    setWaypoints(prev => {
      if (prev.length === 0) return [point];
      const next = [...prev];
      next[0] = point;
      return next;
    });
  };

  // Map Click Handler: Add Via-Point
  const handleAddViaPoint = (point) => {
    setWaypoints(prev => {
      if (prev.length < 2) return [...prev, point];
      const next = [...prev];
      next.splice(next.length - 1, 0, point); // Insert right before destination
      return next;
    });
  };

  // Map Click Handler: Set Finish
  const handleSetEndPoint = (point) => {
    setWaypoints(prev => {
      if (prev.length === 0) return [point];
      const next = [...prev];
      if (next.length === 1) next.push(point);
      else next[next.length - 1] = point;
      return next;
    });
  };

  // -------------------------------------------------------------------------
  // Fetch Overpass Traffic & HGV Restriction Signs along route
  // -------------------------------------------------------------------------
  const handleFetchHgvRestrictions = async (sCoords = null, eCoords = null) => {
    setIsLoadingRestrictions(true);
    try {
      let results = [];
      let routeCoords = null;

      if (activeRoute && activeRoute.geojson) {
        const gj = activeRoute.geojson;
        if (gj.geometry && Array.isArray(gj.geometry.coordinates)) {
          routeCoords = gj.geometry.coordinates;
        } else if (gj.type === 'FeatureCollection' && gj.features?.[0]?.geometry?.coordinates) {
          routeCoords = gj.features[0].geometry.coordinates;
        }
      }

      if (routeCoords && routeCoords.length > 0) {
        results = await fetchOverpassRouteSigns(routeCoords);
      } else {
        const start = sCoords || activeRoute?.startCoords;
        const end = eCoords || activeRoute?.endCoords;
        
        let bbox;
        if (start && end) {
          const [startLon, startLat] = start;
          const [endLon, endLat] = end;
          bbox = [
            Math.min(startLat, endLat) - 0.1, Math.min(startLon, endLon) - 0.1,
            Math.max(startLat, endLat) + 0.1, Math.max(startLon, endLon) + 0.1,
          ];
        } else if (userLocation) {
          const [lat, lon] = userLocation;
          bbox = [lat - 0.08, lon - 0.08, lat + 0.08, lon + 0.08];
        } else {
          bbox = [49.3, 24.8, 49.9, 27.2];
        }
        results = await fetchOverpassHgvRestrictions(bbox);
      }

      setHgvRestrictions(results);
    } catch (e) {
      console.warn('Failed to load traffic & HGV restriction signs:', e);
    } finally {
      setIsLoadingRestrictions(false);
    }
  };

  // -------------------------------------------------------------------------
  // Select an alternative route by index
  // -------------------------------------------------------------------------
  const handleSelectAlternative = (idx) => {
    if (!routeAlternatives[idx]) return;
    const selected = routeAlternatives[idx];
    setActiveRoute(selected);

    // Persist updated active selection
    saveLastRoute({
      startCoords: selected.startCoords,
      endCoords: selected.endCoords,
      startName,
      endName,
      activeRoute: selected,
      routeAlternatives,
    });
  };

  // -------------------------------------------------------------------------
  // Fetch Overpass HGV rest stops
  // -------------------------------------------------------------------------
  const handleFetchOverpassPois = async () => {
    if (!activeRoute || !activeRoute.startCoords || !activeRoute.endCoords) return;
    setIsLoadingOverpass(true);
    const [startLon, startLat] = activeRoute.startCoords;
    const [endLon, endLat] = activeRoute.endCoords;
    const bbox = [
      Math.min(startLat, endLat) - 0.2, Math.min(startLon, endLon) - 0.2,
      Math.max(startLat, endLat) + 0.2, Math.max(startLon, endLon) + 0.2,
    ];
    try {
      const results = await fetchOverpassHgvRestAreas(bbox);
      setOverpassPois(results);
      if (results.length === 0) alert('У вказаному районі не знайдено маркованих HGV паркінгів в OSM.');
    } catch {
      alert('Помилка завантаження точок Overpass API.');
    } finally {
      setIsLoadingOverpass(false);
    }
  };

  // -------------------------------------------------------------------------
  // Route to POI
  // -------------------------------------------------------------------------
  const handleRouteToPoi = (poi) => {
    if (!poi.coordinates) return;
    const originCoords = userLocation ? [userLocation[1], userLocation[0]] : [24.0311, 49.8429];
    const originName = userLocation ? 'Моє GPS місцезнаходження' : 'Львів (Замовчування)';
    handleCalculateRoute(originCoords, poi.coordinates, originName, poi.name);
  };

  // -------------------------------------------------------------------------
  // Clear route
  // -------------------------------------------------------------------------
  const handleClearRoute = () => {
    setActiveRoute(null);
    setRouteAlternatives([]);
    setHgvRestrictions([]);
    setIsNavigating(false);
    setRestoredSession(false);
    clearLastRoute();
  };

  // -------------------------------------------------------------------------
  // Listen for API Key update & auto-recalculate active route
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handleApiKeyUpdate = () => {
      if (activeRoute && activeRoute.startCoords && activeRoute.endCoords) {
        handleCalculateRoute(activeRoute.startCoords, activeRoute.endCoords, startName, endName);
      }
    };
    window.addEventListener('trucknav:api-key-updated', handleApiKeyUpdate);
    return () => window.removeEventListener('trucknav:api-key-updated', handleApiKeyUpdate);
  }, [activeRoute, startName, endName]);

  // Get alternative routes excluding the active one (for grey lines on map)
  const inactiveAlternatives = routeAlternatives.filter(r => r.index !== (activeRoute?.index ?? 0));

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col bg-slate-950 text-slate-100">

      {/* Session Restored Banner */}
      {restoredSession && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-800/95 backdrop-blur border border-blue-500/40 text-blue-300 text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xl animate-in slide-in-from-top-3 duration-300">
          <span>🗺️ Відновлено маршрут з попередньої сесії</span>
          <button onClick={() => setRestoredSession(false)} className="text-slate-400 hover:text-slate-200 ml-1">✕</button>
        </div>
      )}

      {/* Top Search & Profile Header Bar */}
      <Header
        profile={profile}
        userLocation={userLocation}
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenPoiManager={() => setShowPoiModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
        onCalculateWaypointsRoute={(pts, sName, eName) => handleCalculateRoute(pts, sName, eName)}
        activeRoute={activeRoute}
        onClearRoute={handleClearRoute}
        mapTheme={mapTheme}
        onToggleMapTheme={() => setMapTheme(prev => prev === 'dark' ? 'light' : 'dark')}
        isNavigating={isNavigating}
        onToggleNavigation={() => setIsNavigating(!isNavigating)}
        waypoints={waypoints}
        onSetStartPoint={handleSetStartPoint}
        onAddViaPoint={handleAddViaPoint}
        onSetEndPoint={handleSetEndPoint}
      />

      {/* Main Map Canvas */}
      <div className="relative flex-1 w-full min-h-0">
        <MapView
          mapTheme={mapTheme}
          userLocation={userLocation}
          heading={userHeading}
          routeData={activeRoute}
          routeAlternatives={inactiveAlternatives}
          pois={pois}
          overpassPois={overpassPois}
          hgvRestrictions={[
            ...hgvRestrictions,
            ...(activeRoute?.speedLimitSigns || [])
          ]}
          waypoints={waypoints}
          onSetStartPoint={handleSetStartPoint}
          onAddViaPoint={handleAddViaPoint}
          onSetEndPoint={handleSetEndPoint}
          onRouteToPoi={handleRouteToPoi}
          onSelectAlternative={handleSelectAlternative}
          followDriver={followDriver}
        />

        {/* Speedometer & Compass */}
        <Speedometer
          speedKmh={userSpeed}
          maxSpeedLimit={(() => {
            // Find nearest speed limit sign to current GPS position
            if (userLocation && activeRoute?.speedLimitSigns?.length > 0) {
              const [userLat, userLon] = userLocation;
              let nearest = null;
              let minDist = Infinity;
              activeRoute.speedLimitSigns.forEach(sign => {
                const [sLon, sLat] = sign.coordinates;
                const d = Math.sqrt(
                  Math.pow((sLat - userLat) * 111000, 2) +
                  Math.pow((sLon - userLon) * 111000, 2)
                );
                if (d < minDist) { minDist = d; nearest = sign; }
              });
              if (nearest && minDist < 2000) return nearest.speedLimit;
            }
            return profile.maxSpeed || 80;
          })()}
          heading={userHeading}
          followDriver={followDriver}
          onToggleFollow={() => setFollowDriver(!followDriver)}
        />

        {/* Navigation HUD */}
        {isNavigating && (
          <NavigationOverlay
            routeData={activeRoute}
            profile={profile}
            onStopNavigation={() => setIsNavigating(false)}
          />
        )}

        {/* Route Panel */}
        {!isNavigating && activeRoute && (
          <RoutePanel
            routeData={activeRoute}
            routeAlternatives={routeAlternatives}
            startName={startName}
            endName={endName}
            onFetchOverpassPois={handleFetchOverpassPois}
            isLoadingOverpass={isLoadingOverpass}
            onFetchHgvRestrictions={handleFetchHgvRestrictions}
            isLoadingRestrictions={isLoadingRestrictions}
            hgvRestrictionsCount={hgvRestrictions.length}
            hgvRestrictions={hgvRestrictions}
            onOpenSettings={() => setShowSettingsModal(true)}
            onStartNavigation={() => { setIsNavigating(true); setFollowDriver(true); }}
            onSelectAlternative={handleSelectAlternative}
            isNavigating={isNavigating}
          />
        )}
      </div>

      {/* Modals */}
      {showProfileModal && (
        <VehicleProfileModal profile={profile} onSave={handleSaveProfile} onClose={() => setShowProfileModal(false)} />
      )}
      {showPoiModal && (
        <PoiManagerModal pois={pois} onRefreshPois={() => setPois(getStoredPois())} onClose={() => setShowPoiModal(false)} onSelectPoi={handleRouteToPoi} />
      )}
      {showSettingsModal && (
        <SettingsModal onClose={() => setShowSettingsModal(false)} mapTheme={mapTheme} onToggleMapTheme={() => setMapTheme(prev => prev === 'dark' ? 'light' : 'dark')} />
      )}
    </div>
  );
}
