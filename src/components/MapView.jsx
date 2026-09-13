import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl/dist/maplibre-gl.mjs';
import 'maplibre-gl/dist/maplibre-gl.css';
import { POI_CATEGORIES } from '../services/poiStorage';

const darkStyle = {
  version: 8,
  name: 'Esri Dark Gray Canvas',
  sources: {
    'esri-dark-tiles': {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Tiles &copy; Esri'
    }
  },
  layers: [{ id: 'esri-dark-layer', type: 'raster', source: 'esri-dark-tiles', minzoom: 0, maxzoom: 19 }]
};

const lightStyle = {
  version: 8,
  name: 'OpenStreetMap Standard',
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors'
    }
  },
  layers: [{ id: 'osm-layer', type: 'raster', source: 'osm-tiles', minzoom: 0, maxzoom: 19 }]
};

export default function MapView({
  mapTheme = 'dark',
  userLocation,
  heading,
  routeData,
  routeAlternatives = [],
  pois = [],
  overpassPois = [],
  hgvRestrictions = [],
  waypoints = [],
  onSetStartPoint,
  onAddViaPoint,
  onSetEndPoint,
  onSelectPoi,
  onRouteToPoi,
  onSelectAlternative,
  followDriver = false,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const mapReadyRef = useRef(false);    // true after map 'load' fires
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const prevThemeRef = useRef(mapTheme);
  const pendingRouteRef = useRef(null); // route queued before map ready
  const altSourcesRef = useRef([]);     // ids of alternative route sources

  const callbacksRef = useRef({ onSetStartPoint, onAddViaPoint, onSetEndPoint });
  useEffect(() => {
    callbacksRef.current = { onSetStartPoint, onAddViaPoint, onSetEndPoint };
  }, [onSetStartPoint, onAddViaPoint, onSetEndPoint]);

  function addRouteLayers(map) {
    if (!map.getSource('route-source')) {
      map.addSource('route-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
    }
    if (!map.getLayer('route-glow-layer')) {
      map.addLayer({
        id: 'route-glow-layer',
        type: 'line',
        source: 'route-source',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#0284c7', 'line-width': 14, 'line-opacity': 0.5 }
      });
    }
    if (!map.getLayer('route-line-layer')) {
      map.addLayer({
        id: 'route-line-layer',
        type: 'line',
        source: 'route-source',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#38bdf8', 'line-width': 6, 'line-opacity': 1 }
      });
    }
  }

  function applyAlternativeRoutes(map, alternatives) {
    altSourcesRef.current.forEach(id => {
      if (map.getLayer(id + '-line')) map.removeLayer(id + '-line');
      if (map.getSource(id)) map.removeSource(id);
    });
    altSourcesRef.current = [];

    if (!alternatives || alternatives.length === 0) return;

    alternatives.forEach((alt, idx) => {
      if (!alt.geojson) return;
      const srcId = `route-alt-${idx}`;
      const layerId = `${srcId}-line`;

      let feature = alt.geojson;
      if (feature.type === 'FeatureCollection') feature = feature.features[0];
      if (!feature || !feature.geometry) return;

      map.addSource(srcId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [feature] }
      });

      const beforeLayer = map.getLayer('route-glow-layer') ? 'route-glow-layer' : undefined;
      map.addLayer({
        id: layerId,
        type: 'line',
        source: srcId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#64748b', 'line-width': 5, 'line-opacity': 0.55, 'line-dasharray': [2, 2] }
      }, beforeLayer);

      map.on('click', layerId, () => onSelectAlternative?.(idx));
      map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });

      altSourcesRef.current.push(srcId);
    });
  }

  function applyRouteData(map, data) {
    addRouteLayers(map);
    const source = map.getSource('route-source');
    if (!source) return;

    if (data && data.geojson) {
      const gj = data.geojson;
      let feature;
      if (gj.type === 'FeatureCollection') {
        feature = gj.features[0];
      } else if (gj.type === 'Feature') {
        feature = gj;
      } else {
        feature = { type: 'Feature', geometry: gj, properties: {} };
      }

      if (!feature || !feature.geometry) return;

      source.setData({ type: 'FeatureCollection', features: [feature] });

      const coords = feature.geometry.coordinates;
      if (Array.isArray(coords) && coords.length > 1) {
        const bounds = coords.reduce(
          (b, c) => b.extend([c[0], c[1]]),
          new maplibregl.LngLatBounds(coords[0], coords[0])
        );
        map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 1200 });
      }
    } else {
      source.setData({ type: 'FeatureCollection', features: [] });
    }
  }

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: mapTheme === 'dark' ? darkStyle : lightStyle,
      center: [24.0311, 49.8429],
      zoom: 6,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');
    mapRef.current = map;

    map.on('load', () => {
      mapReadyRef.current = true;
      addRouteLayers(map);
      if (pendingRouteRef.current !== null) {
        applyRouteData(map, pendingRouteRef.current);
        pendingRouteRef.current = null;
      }
    });

    map.on('click', (e) => {
      const target = e.originalEvent?.target;
      if (target && target.closest('.mapboxgl-marker, .maplibregl-marker, .maplibregl-popup')) {
        return; // Don't trigger popup if clicked on existing marker
      }

      const { lng, lat } = e.lngLat;
      const label = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

      const popupDiv = document.createElement('div');
      popupDiv.style.cssText = 'padding:6px;font-family:sans-serif;min-width:165px;';
      popupDiv.innerHTML = `
        <div style="font-size:11px;font-weight:700;color:#0f172a;margin-bottom:8px">📍 ${label}</div>
        <div style="display:flex;flex-direction:column;gap:5px">
          <button id="btn-click-start" style="background:#10b981;color:#fff;border:none;padding:6px 10px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;text-align:left">🟢 Встановити як Старт</button>
          <button id="btn-click-via" style="background:#3b82f6;color:#fff;border:none;padding:6px 10px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;text-align:left">📍 Додати проміжну точку</button>
          <button id="btn-click-end" style="background:#f43f5e;color:#fff;border:none;padding:6px 10px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;text-align:left">🔴 Встановити як Фініш</button>
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 10 })
        .setLngLat([lng, lat])
        .setDOMContent(popupDiv)
        .addTo(map);

      setTimeout(() => {
        const pt = { id: `map-tap-${Date.now()}`, shortName: label, lat, lon: lng, type: 'coordinates' };
        const bS = popupDiv.querySelector('#btn-click-start');
        const bV = popupDiv.querySelector('#btn-click-via');
        const bE = popupDiv.querySelector('#btn-click-end');
        if (bS) bS.onclick = () => { callbacksRef.current.onSetStartPoint?.(pt); popup.remove(); };
        if (bV) bV.onclick = () => { callbacksRef.current.onAddViaPoint?.(pt); popup.remove(); };
        if (bE) bE.onclick = () => { callbacksRef.current.onSetEndPoint?.(pt); popup.remove(); };
      }, 50);
    });

    return () => {
      mapReadyRef.current = false;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || prevThemeRef.current === mapTheme) return;
    prevThemeRef.current = mapTheme;
    mapReadyRef.current = false;
    map.setStyle(mapTheme === 'dark' ? darkStyle : lightStyle);
    map.once('styledata', () => {
      mapReadyRef.current = true;
      if (pendingRouteRef.current !== null) {
        applyRouteData(map, pendingRouteRef.current);
        pendingRouteRef.current = null;
      }
    });
  }, [mapTheme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) {
      pendingRouteRef.current = routeData ?? null;
      return;
    }
    applyRouteData(map, routeData);
  }, [routeData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;
    applyAlternativeRoutes(map, routeAlternatives);
  }, [routeAlternatives]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation) return;
    const [lat, lon] = userLocation;
    if (!userMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'user-gps-marker';
      el.innerHTML = '<div class="pulse"></div><div class="core"></div>';
      userMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(map);
    } else {
      userMarkerRef.current.setLngLat([lon, lat]);
    }
    if (followDriver) {
      map.easeTo({ center: [lon, lat], bearing: heading || 0, pitch: 45, zoom: 15, duration: 800 });
    }
  }, [userLocation, heading, followDriver]);

  // Render Waypoint Badges + POIs + HGV Restriction Signs
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // 1. Waypoint Badges (Intermediate Via Points)
    waypoints.forEach((wp, idx) => {
      if (!wp || wp.lon === undefined || wp.lat === undefined) return;
      const isStart = idx === 0;
      const isEnd = idx === waypoints.length - 1;
      if (isStart || isEnd) return; // Start & finish are rendered by route endpoints

      const el = document.createElement('div');
      el.style.cssText = 'width:28px;height:28px;border-radius:50%;background:#2563eb;border:2px solid #ffffff;box-shadow:0 3px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;color:#ffffff;font-weight:900;font-size:12px;cursor:pointer;';
      el.innerHTML = `${idx}`;
      
      const popup = new maplibregl.Popup({ offset: 12 }).setHTML(
        `<div style="padding:6px"><h4 style="margin:0;font-size:12px;font-weight:700">📍 Проміжна точка #${idx}</h4><p style="margin:4px 0 0;font-size:11px;color:#64748b">${escapeHtml(wp.shortName || '')}</p></div>`
      );

      const marker = new maplibregl.Marker({ element: el }).setLngLat([wp.lon, wp.lat]).setPopup(popup).addTo(map);
      markersRef.current.push(marker);
    });

    // 2. POI Markers
    [...pois, ...overpassPois].forEach((poi) => {
      if (!poi.coordinates || poi.coordinates.length < 2) return;
      const catInfo = POI_CATEGORIES[poi.category] || POI_CATEGORIES.other;
      const el = document.createElement('div');
      el.style.cssText = 'width:32px;height:32px;border-radius:50%;background:' + (catInfo.color || '#3b82f6') + ';border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;cursor:pointer;';
      el.innerHTML = getCategoryIconEmoji(poi.category);
      const popup = new maplibregl.Popup({ offset: 15 }).setHTML(
        '<div style="padding:8px"><h4 style="margin:0 0 6px;font-size:13px;font-weight:700">' + escapeHtml(poi.name) + '</h4>' +
        (poi.description ? '<p style="margin:0 0 8px;font-size:11px">' + escapeHtml(poi.description) + '</p>' : '') +
        '<button id="btn-route-' + poi.id + '" style="background:#2563eb;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px">Маршрут сюди</button></div>'
      );
      const marker = new maplibregl.Marker({ element: el }).setLngLat(poi.coordinates).setPopup(popup).addTo(map);
      popup.on('open', () => {
        const btn = document.getElementById('btn-route-' + poi.id);
        if (btn) btn.addEventListener('click', () => onRouteToPoi && onRouteToPoi(poi));
      });
      markersRef.current.push(marker);
    });

    // 3. Traffic Signs: HGV Restrictions & Speed Limits (Red European circular signs)
    hgvRestrictions.forEach((restr) => {
      if (!restr.coordinates || restr.coordinates.length < 2) return;
      const el = document.createElement('div');
      
      if (restr.type === 'speed_limit') {
        // European circular speed limit sign: white background with red outer ring
        el.style.cssText = 'width:32px;height:32px;border-radius:50%;background:#ffffff;border:3px solid #dc2626;box-shadow:0 3px 8px rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;color:#0f172a;font-weight:900;font-size:12px;font-family:sans-serif;cursor:pointer;line-height:1;letter-spacing:-0.5px;';
        el.innerHTML = `<span>${escapeHtml(restr.label)}</span>`;
      } else {
        el.style.cssText = 'width:34px;height:34px;border-radius:50%;background:#ffffff;border:3px solid #dc2626;box-shadow:0 3px 10px rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;color:#0f172a;font-weight:800;font-size:10px;font-family:sans-serif;cursor:pointer;line-height:1;letter-spacing:-0.5px;';
        if (restr.type === 'no_hgv') {
          el.innerHTML = '<span style="font-size:14px">🚫</span>';
        } else if (restr.type === 'height') {
          el.innerHTML = `<span style="font-size:9px;color:#dc2626;font-weight:900">↕${escapeHtml(restr.label)}</span>`;
        } else {
          el.innerHTML = `<span style="font-size:10px;color:#dc2626;font-weight:900">${escapeHtml(restr.label)}</span>`;
        }
      }

      const iconEmoji = restr.type === 'speed_limit' ? '🔴' : '⛔';
      const popup = new maplibregl.Popup({ offset: 15 }).setHTML(
        `<div style="padding:8px;max-width:200px">
          <h4 style="margin:0 0 4px;font-size:12px;font-weight:800;color:#dc2626;display:flex;align-items:center;gap:4px">
            <span>${iconEmoji}</span> <span>${escapeHtml(restr.title)}</span>
          </h4>
          <p style="margin:0;font-size:11px;color:#475569;line-height:1.3">${escapeHtml(restr.description)}</p>
        </div>`
      );

      const marker = new maplibregl.Marker({ element: el }).setLngLat(restr.coordinates).setPopup(popup).addTo(map);
      markersRef.current.push(marker);
    });

  }, [pois, overpassPois, hgvRestrictions, waypoints]);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={mapContainerRef} className="map-container" />
    </div>
  );
}

function getCategoryIconEmoji(category) {
  const icons = { parking: 'P', supermarket: 'S', fuel: 'F', laundry: 'L', border: 'B', service: 'M' };
  return icons[category] || '*';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
