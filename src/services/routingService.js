import { getStoredOrsApiKey, getStoredVehicleProfile } from './profileStorage';

// ---------------------------------------------------------------------------
// Coordinate parsing (Decimal Degrees + DMS format support)
// ---------------------------------------------------------------------------
function tryParseCoordinates(query) {
  const q = query.trim();

  // 1. Decimal degrees: "49.8429, 24.0311" or "49.8429 24.0311" or "49.8429,24.0311"
  const decMatch = q.match(/^(-?\d{1,3}\.?\d*)[,\s]+(-?\d{1,3}\.?\d*)$/);
  if (decMatch) {
    const a = parseFloat(decMatch[1].replace(',', '.'));
    const b = parseFloat(decMatch[2].replace(',', '.'));
    if (!isNaN(a) && !isNaN(b)) {
      if (Math.abs(a) <= 90 && Math.abs(b) <= 180) return { lat: a, lon: b };
      if (Math.abs(b) <= 90 && Math.abs(a) <= 180) return { lat: b, lon: a };
    }
  }

  // 2. DMS format: "49°25'17.4\"N 26°58'52.3\"E" or "N49°25'17\" E26°58'52\""
  const dmsRegex = /(\d{1,3})[°\s]+(\d{1,2})['′\s]+(\d{1,2}(?:\.\d+)?)?["″\s]*([NnSsEeWw])?/g;
  const matches = [...q.matchAll(dmsRegex)];
  if (matches.length >= 2) {
    const parsePart = (m) => {
      const deg = parseFloat(m[1]);
      const min = parseFloat(m[2] || 0);
      const sec = parseFloat(m[3] || 0);
      const dir = m[4]?.toUpperCase();
      let val = deg + min / 60 + sec / 3600;
      if (dir === 'S' || dir === 'W') val = -val;
      return val;
    };
    const lat = parsePart(matches[0]);
    const lon = parsePart(matches[1]);
    if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      return { lat, lon };
    }
  }

  return null;
}

/**
 * Reverse geocode a coordinate pair to a human-readable label.
 */
export async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;
  try {
    const res = await fetch(url, { headers: { 'Accept-Language': 'uk,pl,en' } });
    if (!res.ok) return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    const data = await res.json();
    return data.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  }
}

/**
 * Multi-provider search (Nominatim + Photon) with country bias & proximity ranking.
 * Supports: cities, companies, addresses, GPS coordinates.
 */
export async function searchAddress(query, userLat = 49.8429, userLon = 24.0311) {
  const q = query ? query.trim() : '';
  if (!q || q.length < 2) return [];

  // 1. Try coordinate parse first (instant, no network)
  const coord = tryParseCoordinates(q);
  if (coord) {
    const label = `${coord.lat.toFixed(5)}, ${coord.lon.toFixed(5)}`;
    return [{
      id: `coord-${coord.lat}-${coord.lon}`,
      name: `Координати: ${label}`,
      shortName: label,
      lat: coord.lat,
      lon: coord.lon,
      type: 'coordinates',
    }];
  }

  const results = [];

  // 2. Nominatim search (with UA & EU country bias to prevent irrelevant distant matches)
  const nomParams = new URLSearchParams({
    format: 'json',
    q,
    limit: '10',
    addressdetails: '1',
    namedetails: '1',
    extratags: '1',
    countrycodes: 'ua,pl,ro,sk,hu,md,de,cz,at,it,fr,nl,be',
  });

  const nomUrl = `https://nominatim.openstreetmap.org/search?${nomParams}`;

  try {
    const res = await fetch(nomUrl, {
      headers: { 'Accept-Language': 'uk,pl,en', 'User-Agent': 'TruckNavApp/1.0' }
    });
    if (res.ok) {
      const data = await res.json();
      data.forEach(item => {
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        const addr = item.address || {};
        const businessName = item.namedetails?.name || item.name;
        const street = addr.road || addr.pedestrian || '';
        const city = addr.city || addr.town || addr.village || addr.county || addr.state || '';
        const country = addr.country_code?.toUpperCase() || '';

        let shortName = businessName;
        if (!shortName) {
          shortName = [street, city].filter(Boolean).join(', ') || item.display_name.split(',')[0];
        }

        const isBusiness = ['amenity', 'shop', 'office', 'fuel', 'parking', 'company', 'industrial'].includes(item.class);
        if (isBusiness && city && !shortName.includes(city)) {
          shortName = `${shortName}, ${city}`;
        }

        results.push({
          id: `nom-${item.place_id}`,
          name: item.display_name,
          shortName,
          lat,
          lon,
          type: item.class || 'place',
          icon: getSearchResultIcon(item.class, item.type),
          country,
        });
      });
    }
  } catch (e) {
    console.warn('Nominatim search failed:', e.message);
  }

  // 3. Photon API search (Komoot) for fuzzy matching & company/POI search
  try {
    const phoUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=${userLat}&lon=${userLon}&limit=8`;
    const res = await fetch(phoUrl);
    if (res.ok) {
      const data = await res.json();
      data.features?.forEach(f => {
        const props = f.properties;
        const [lon, lat] = f.geometry.coordinates;
        const name = props.name || [props.street, props.city].filter(Boolean).join(', ');
        if (!name) return;

        // Skip if already in results (within ~200m)
        const exists = results.some(r => Math.abs(r.lat - lat) < 0.002 && Math.abs(r.lon - lon) < 0.002);
        if (!exists) {
          const city = props.city || props.town || props.village || props.district || props.state || '';
          let shortName = name;
          if (city && !shortName.includes(city)) shortName = `${shortName}, ${city}`;

          results.push({
            id: `pho-${props.osm_id || Math.random()}`,
            name: [name, city, props.state, props.country].filter(Boolean).join(', '),
            shortName,
            lat,
            lon,
            type: props.osm_value || 'place',
            icon: getSearchResultIcon(props.osm_key, props.osm_value),
            country: props.countrycode?.toUpperCase() || '',
          });
        }
      });
    }
  } catch (e) {
    console.warn('Photon search failed:', e.message);
  }

  // Deduplicate results
  const seen = [];
  const deduped = results.filter(item => {
    const tooClose = seen.some(s => Math.abs(s.lat - item.lat) < 0.0008 && Math.abs(s.lon - item.lon) < 0.0008);
    if (!tooClose) { seen.push({ lat: item.lat, lon: item.lon }); return true; }
    return false;
  });

  // Sort by distance to user location (closer first)
  deduped.sort((a, b) => {
    const distA = Math.hypot(a.lat - userLat, a.lon - userLon);
    const distB = Math.hypot(b.lat - userLat, b.lon - userLon);
    return distA - distB;
  });

  return deduped;
}

function getSearchResultIcon(cls, type) {
  if (cls === 'amenity') {
    if (type === 'fuel') return 'fuel';
    if (type === 'parking') return 'parking';
    if (type === 'restaurant' || type === 'fast_food') return 'food';
    return 'amenity';
  }
  if (cls === 'shop') return 'shop';
  if (cls === 'office') return 'office';
  if (cls === 'highway') return 'road';
  return 'place';
}

function normalizeWaypoints(startOrWaypoints, endCoords) {
  if (Array.isArray(startOrWaypoints) && startOrWaypoints.length > 0 && Array.isArray(startOrWaypoints[0])) {
    return startOrWaypoints;
  }
  if (startOrWaypoints && endCoords) {
    return [startOrWaypoints, endCoords];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Routing — single route
// ---------------------------------------------------------------------------
export async function calculateTruckRoute(startOrWaypoints, endCoords, customVehicleProfile = null) {
  const waypoints = normalizeWaypoints(startOrWaypoints, endCoords);
  if (waypoints.length < 2) throw new Error('Необхідно мінімум 2 точки для побудови маршруту');

  const vehicle = customVehicleProfile || getStoredVehicleProfile();
  const orsApiKey = getStoredOrsApiKey();

  if (orsApiKey) {
    try {
      const result = await fetchOpenRouteService(waypoints, vehicle, orsApiKey, false);
      return result[0];
    } catch (err) {
      console.warn('ORS single route failed, falling back to OSRM:', err.message);
    }
  }

  const results = await fetchOsrmRoutes(waypoints, vehicle, false);
  return results[0];
}

// ---------------------------------------------------------------------------
// Routing — alternatives (returns array of 1-3 routes)
// ---------------------------------------------------------------------------
export async function calculateTruckRouteAlternatives(startOrWaypoints, endCoords, customVehicleProfile = null) {
  const waypoints = normalizeWaypoints(startOrWaypoints, endCoords);
  if (waypoints.length < 2) throw new Error('Необхідно мінімум 2 точки для побудови маршруту');

  const vehicle = customVehicleProfile || getStoredVehicleProfile();
  const orsApiKey = getStoredOrsApiKey();

  if (orsApiKey) {
    try {
      // 1. Try ORS HGV with alternatives (works for routes <= 100km)
      return await fetchOpenRouteService(waypoints, vehicle, orsApiKey, true);
    } catch (err) {
      console.warn('ORS alternatives failed (>100km or server limit), trying ORS HGV single route:', err.message);
      try {
        // 2. Fallback to ORS HGV single route (supports ANY distance with full HGV height/weight/city restrictions!)
        return await fetchOpenRouteService(waypoints, vehicle, orsApiKey, false);
      } catch (errSingle) {
        console.warn('ORS single route also failed, falling back to OSRM:', errSingle.message);
      }
    }
  }

  // 3. Fallback to OSRM standard (car router) only if ORS key is not set or ORS service is down
  return await fetchOsrmRoutes(waypoints, vehicle, true);
}

// ---------------------------------------------------------------------------
// Extract speed limit sign positions from ORS extras.speed_limits
// Returns array of {id, type, label, title, description, coordinates, speedLimit}
// ---------------------------------------------------------------------------
function extractSpeedLimitSigns(feature) {
  try {
    const extras = feature.properties?.extras?.speed_limits;
    const coords = feature.geometry?.coordinates;
    if (!extras || !coords || !extras.values) return [];

    const signs = [];
    const seenSpeeds = new Map(); // track last seen speed to detect changes
    let prevSpeed = null;

    extras.values.forEach(([startIdx, endIdx, speedCode]) => {
      // ORS speed_limit extras: value 0 means unknown, otherwise it's the speed in km/h
      const speed = speedCode;
      if (!speed || speed <= 0 || speed > 130) return;

      // Only place a sign where the speed CHANGES (transition point)
      if (speed !== prevSpeed) {
        const coord = coords[startIdx];
        if (coord && coord.length >= 2) {
          const [lon, lat] = coord;
          const id = `ors-speed-${startIdx}-${speed}`;
          signs.push({
            id,
            category: 'speed_limit',
            type: 'speed_limit',
            label: String(speed),
            title: `Обмеження швидкості: ${speed} км/год`,
            description: `Ділянка маршруту з обмеженням ${speed} км/год`,
            coordinates: [lon, lat],
            speedLimit: speed,
          });
        }
        prevSpeed = speed;
      }
    });

    // Deduplicate by proximity (don't show two signs within 200m of each other)
    const deduped = [];
    signs.forEach(sign => {
      const tooClose = deduped.some(existing => {
        const dLat = (existing.coordinates[1] - sign.coordinates[1]) * 111000;
        const dLon = (existing.coordinates[0] - sign.coordinates[0]) * 111000;
        return Math.sqrt(dLat * dLat + dLon * dLon) < 200;
      });
      if (!tooClose) deduped.push(sign);
    });

    return deduped;
  } catch (e) {
    console.warn('Failed to extract speed limit signs from ORS extras:', e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// OpenRouteService HGV
// ---------------------------------------------------------------------------
async function fetchOpenRouteService(waypoints, vehicle, apiKey, alternatives) {
  const url = 'https://api.openrouteservice.org/v2/directions/driving-hgv/geojson';

  const bodyData = {
    coordinates: waypoints,
    options: {
      profile_params: {
        restrictions: {
          height: Number(vehicle.height),
          weight: Number(vehicle.weight),
          width: Number(vehicle.width),
          length: Number(vehicle.length),
          axleload: Number(vehicle.axleLoad),
        }
      }
    },
    units: 'm',
    language: 'en',
    geometry_simplify: false,
    // Request speed limits and road type extras from ORS engine
    extra_info: ['speed_limits', 'road_access_restrictions'],
  };

  if (alternatives) {
    bodyData.alternative_routes = {
      target_count: 3,
      weight_factor: 1.4,
      share_factor: 0.6,
    };
  }

  if (vehicle.hazmat) {
    bodyData.options.profile_params.restrictions.hazmat = true;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': apiKey },
    body: JSON.stringify(bodyData),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ORS Error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const hgvSpeed = Math.min(vehicle.maxSpeed || 80, 80);

  return data.features.map((feature, idx) => {
    const props = feature.properties;
    const summary = props.summary;
    const distanceKm = Number((summary.distance / 1000).toFixed(1));
    // Use realistic segment-calculated duration from ORS engine (accounting for 50 km/h towns, traffic, road types)
    const durationHours = summary.duration ? (summary.duration / 3600) : (distanceKm / 70);
    const steps = (props.segments || []).flatMap(seg => seg.steps || []).map(step => ({
      instruction: step.instruction,
      distance: step.distance,
      duration: step.duration,
      name: step.name,
      type: step.type,
      location: step.way_points ? feature.geometry.coordinates[step.way_points[0]] : null,
    }));

    // Extract speed limit sign positions from ORS extras
    const speedLimitSigns = extractSpeedLimitSigns(feature);

    return {
      geojson: feature,
      distanceKm,
      durationHours: Number(durationHours.toFixed(2)),
      durationText: formatDuration(durationHours),
      steps,
      speedLimitSigns,
      engine: 'OpenRouteService HGV 🚛',
      index: idx,
    };
  });
}

// ---------------------------------------------------------------------------
// OSRM fallback with alternatives
// ---------------------------------------------------------------------------
async function fetchOsrmRoutes(waypoints, vehicle, alternatives) {
  const altParam = alternatives ? '&alternatives=3' : '';
  const waypointsStr = waypoints.map(p => `${p[0]},${p[1]}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${waypointsStr}?overview=full&geometries=geojson&steps=true${altParam}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error('OSRM router error');

  const data = await response.json();
  if (!data.routes || data.routes.length === 0) throw new Error('Маршрут не знайдено');

  return data.routes.map((route, idx) => {
    const distanceKm = Number((route.distance / 1000).toFixed(1));
    // OSRM provides car duration; apply realistic 18% HGV urban & weight slowdown
    const durationHours = route.duration ? ((route.duration * 1.18) / 3600) : (distanceKm / 68);
    const steps = (route.legs || []).flatMap(leg => leg.steps || []).map(s => ({
      instruction: translateOsrmManeuver(s.maneuver, s.name),
      distance: s.distance,
      duration: s.duration,
      name: s.name,
      type: s.maneuver.type,
      location: s.maneuver.location,
    }));

    return {
      geojson: {
        type: 'Feature',
        geometry: route.geometry,
        properties: { summary: { distance: route.distance, duration: durationHours * 3600 } },
      },
      distanceKm,
      durationHours: Number(durationHours.toFixed(2)),
      durationText: formatDuration(durationHours),
      steps,
      engine: 'OSRM (Легковий — без обмежень HGV ⚠️)',
      index: idx,
    };
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDuration(hours) {
  const totalMins = Math.round(hours * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h === 0) return `${m} хв`;
  return `${h} год ${m} хв`;
}

function translateOsrmManeuver(maneuver, streetName) {
  const type = maneuver.type;
  const modifier = maneuver.modifier || '';
  const street = streetName ? ` на ${streetName}` : '';

  if (type === 'depart') return `Початок руху${street}`;
  if (type === 'arrive') return `Пункт призначення досягнуто!`;

  let action = 'Продовжуйте рух';
  if (modifier.includes('slight right')) action = 'Тримайтеся правіше';
  else if (modifier.includes('slight left')) action = 'Тримайтеся лівіше';
  else if (modifier.includes('right')) action = 'Поверніть праворуч';
  else if (modifier.includes('left')) action = 'Поверніть ліворуч';
  else if (modifier.includes('straight')) action = 'Прямо';
  if (type === 'roundabout') action = `На кільці візьміть ${maneuver.exit || 1}-й з'їзд`;
  if (type === 'merge') action = 'Виїжджайте на основну дорогу';
  if (type === 'fork') action = modifier.includes('right') ? 'На розвилці тримайтеся правіше' : 'На розвилці тримайтеся лівіше';

  return `${action}${street}`;
}
