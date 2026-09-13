// Vehicle Profile Management Service
const PROFILE_KEY = 'trucknav_vehicle_profile';
const API_KEY_STORAGE_KEY = 'trucknav_ors_api_key';
const ROUTE_SESSION_KEY = 'trucknav_last_route_v2';


export const DEFAULT_VEHICLE_PROFILE = {
  id: 'standard-40t',
  name: 'Standard Euro 40t Semi-Trailer',
  weight: 40.0,      // Total weight in tonnes
  axleLoad: 11.5,    // Max axle load in tonnes
  height: 3.95,      // Height in meters
  width: 2.55,       // Width in meters
  length: 16.5,      // Length in meters
  hazmat: false,     // ADR / Hazardous goods
  maxSpeed: 80,      // Max speed limit (km/h) for HGV in EU/UA
};

export const PRESET_PROFILES = [
  {
    id: 'standard-40t',
    name: '40t Euro-Trailer (5-axle)',
    weight: 40.0,
    axleLoad: 11.5,
    height: 3.95,
    width: 2.55,
    length: 16.5,
    hazmat: false,
    maxSpeed: 80,
  },
  {
    id: 'adr-40t',
    name: '40t Tanker (ADR Hazardous)',
    weight: 40.0,
    axleLoad: 11.5,
    height: 3.80,
    width: 2.55,
    length: 15.5,
    hazmat: true,
    maxSpeed: 80,
  },
  {
    id: 'rigid-12t',
    name: '12t Solo Rigid Truck',
    weight: 12.0,
    axleLoad: 7.5,
    height: 3.40,
    width: 2.50,
    length: 9.0,
    hazmat: false,
    maxSpeed: 80,
  },
  {
    id: 'light-7.5t',
    name: '7.5t Light Commercial HGV',
    weight: 7.5,
    axleLoad: 5.0,
    height: 3.20,
    width: 2.40,
    length: 7.5,
    hazmat: false,
    maxSpeed: 90,
  }
];

export function getStoredVehicleProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return DEFAULT_VEHICLE_PROFILE;
    return { ...DEFAULT_VEHICLE_PROFILE, ...JSON.parse(raw) };
  } catch (e) {
    console.error('Failed to load stored vehicle profile', e);
    return DEFAULT_VEHICLE_PROFILE;
  }
}

export function saveVehicleProfile(profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    window.dispatchEvent(new CustomEvent('trucknav:profile-updated', { detail: profile }));
  } catch (e) {
    console.error('Failed to save vehicle profile', e);
  }
}

export function getStoredOrsApiKey() {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
  } catch (e) {
    return '';
  }
}

export function saveOrsApiKey(key) {
  try {
    localStorage.setItem(API_KEY_STORAGE_KEY, key.trim());
    window.dispatchEvent(new CustomEvent('trucknav:api-key-updated', { detail: key }));
  } catch (e) {
    console.error('Failed to save ORS API key', e);
  }
}

// ---------------------------------------------------------------------------
// Route Session Persistence
// Saves the last calculated route so it can be restored after browser restart.
// ---------------------------------------------------------------------------

/**
 * Save current route state to localStorage.
 * @param {{ startCoords, endCoords, startName, endName, activeRoute, routeAlternatives }} session
 */
export function saveLastRoute(session) {
  try {
    // Store only what's needed — avoid storing massive objects
    const payload = {
      startCoords: session.startCoords,
      endCoords: session.endCoords,
      startName: session.startName || '',
      endName: session.endName || '',
      savedAt: Date.now(),
      // Compact the active route: keep geojson + metadata, drop verbose steps
      activeRoute: session.activeRoute ? {
        geojson: session.activeRoute.geojson,
        distanceKm: session.activeRoute.distanceKm,
        durationHours: session.activeRoute.durationHours,
        durationText: session.activeRoute.durationText,
        engine: session.activeRoute.engine,
        steps: session.activeRoute.steps?.slice(0, 50) || [], // max 50 steps saved
        startCoords: session.activeRoute.startCoords,
        endCoords: session.activeRoute.endCoords,
      } : null,
      // Save only summaries of alternatives (no full GeoJSON to save space)
      routeAlternativesSummary: (session.routeAlternatives || []).map((r, i) => ({
        index: i,
        distanceKm: r.distanceKm,
        durationText: r.durationText,
        engine: r.engine,
      })),
    };
    localStorage.setItem(ROUTE_SESSION_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('Failed to save route session:', e);
  }
}

/**
 * Restore the last saved route from localStorage.
 * Returns null if nothing saved or data is stale (>24h).
 */
export function getLastRoute() {
  try {
    const raw = localStorage.getItem(ROUTE_SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Discard sessions older than 24 hours
    if (!data.savedAt || Date.now() - data.savedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(ROUTE_SESSION_KEY);
      return null;
    }
    return data;
  } catch (e) {
    console.warn('Failed to load route session:', e);
    return null;
  }
}

/**
 * Clear the stored route session.
 */
export function clearLastRoute() {
  try {
    localStorage.removeItem(ROUTE_SESSION_KEY);
  } catch (e) { /* ignore */ }
}

