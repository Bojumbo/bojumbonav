/**
 * Clamp bounding box to maximum 0.25 deg (~25 km) to prevent Overpass timeouts on long routes
 */
function clampBbox(bbox) {
  let [minLat, minLon, maxLat, maxLon] = bbox;
  if (maxLat - minLat > 0.3) {
    minLat = maxLat - 0.25;
  }
  if (maxLon - minLon > 0.3) {
    minLon = maxLon - 0.25;
  }
  return [minLat, minLon, maxLat, maxLon];
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter'
];

export async function fetchOverpassHgvRestAreas(bbox) {
  const [minLat, minLon, maxLat, maxLon] = clampBbox(bbox);
  const bboxStr = `${minLat},${minLon},${maxLat},${maxLon}`;

  const query = `
    [out:json][timeout:15];
    (
      node["highway"="rest_area"](${bboxStr});
      way["highway"="rest_area"](${bboxStr});
      node["amenity"="parking"]["hgv"="yes"](${bboxStr});
      way["amenity"="parking"]["hgv"="yes"](${bboxStr});
      node["amenity"="parking"]["hgv"="only"](${bboxStr});
      way["amenity"="parking"]["hgv"="only"](${bboxStr});
    );
    out center 50;
  `;

  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'TruckNavApp/1.0 (https://trucknav.app)'
        },
        body: 'data=' + encodeURIComponent(query),
      });

      if (!response.ok) continue;

      const data = await response.json();
      if (!data.elements || !Array.isArray(data.elements)) continue;

      return data.elements.map(el => {
        const tags = el.tags || {};
        const lat = el.lat || (el.center && el.center.lat);
        const lon = el.lon || (el.center && el.center.lon);

        if (!lat || !lon) return null;

        const name = tags.name || tags.operator || tags.ref || 'TIR Стоянка (OSM)';
        const descParts = [];
        if (tags.capacity) descParts.push(`Місць: ${tags.capacity}`);
        if (tags.toilets === 'yes') descParts.push('Туалет 🚽');
        if (tags.shower === 'yes') descParts.push('Душ 🚿');
        if (tags.fee === 'yes') descParts.push('Платна 💳');
        if (tags.fee === 'no') descParts.push('Безкоштовна 🆓');

        return {
          id: `osm-${el.type}-${el.id}`,
          name: name,
          category: 'parking',
          coordinates: [lon, lat],
          description: descParts.length > 0 ? descParts.join(' • ') : 'Паркінг для вантажного транспорту',
          importedFrom: 'OSM Overpass',
          updatedAt: new Date().toISOString(),
        };
      }).filter(Boolean);
    } catch (e) {
      console.warn(`Overpass rest area endpoint ${url} failed:`, e.message);
    }
  }

  return [];
}

/**
 * Service to query OpenStreetMap Overpass API for HGV restrictions & speed limits:
 * - maxheight (Height limits)
 * - maxweight / maxweight:hgv (Weight limits)
 * - hgv=no / hgv=prohibited (No Trucks signs)
 * - maxaxleload (Axle weight limits)
 * - maxspeed (Road Speed Limit signs e.g., 50, 70, 80, 90)
 */
export async function fetchOverpassHgvRestrictions(bbox) {
  const [minLat, minLon, maxLat, maxLon] = clampBbox(bbox);
  const bboxStr = `${minLat},${minLon},${maxLat},${maxLon}`;

  const query = `
    [out:json][timeout:15];
    (
      node["maxheight"](${bboxStr});
      way["maxheight"](${bboxStr});
      node["maxweight"](${bboxStr});
      way["maxweight"](${bboxStr});
      node["maxweight:hgv"](${bboxStr});
      way["maxweight:hgv"](${bboxStr});
      node["hgv"="no"](${bboxStr});
      way["hgv"="no"](${bboxStr});
      node["hgv"="prohibited"](${bboxStr});
      way["hgv"="prohibited"](${bboxStr});
      node["maxaxleload"](${bboxStr});
      way["maxaxleload"](${bboxStr});
      node["maxspeed"](${bboxStr});
      way["maxspeed"](${bboxStr});
    );
    out center 70;
  `;

  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'TruckNavApp/1.0 (https://trucknav.app)'
        },
        body: 'data=' + encodeURIComponent(query),
      });

      if (!response.ok) continue;

      const data = await response.json();
      if (!data.elements || !Array.isArray(data.elements)) continue;

      const seen = new Set();
      return data.elements.map(el => {
        const tags = el.tags || {};
        const lat = el.lat || (el.center && el.center.lat);
        const lon = el.lon || (el.center && el.center.lon);

        if (!lat || !lon) return null;

        const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
        if (seen.has(key)) return null;
        seen.add(key);

        let type = 'restriction';
        let label = '⛔';
        let title = 'Обмеження HGV';
        let detail = '';
        let speedVal = null;

        if (tags.maxheight) {
          type = 'height';
          label = `${tags.maxheight}m`;
          title = `Обмеження висоти: ${tags.maxheight} м`;
          detail = tags.bridge === 'yes' ? 'Проїзд під мостом' : 'Обмеження габаритної висоти';
        } else if (tags.maxweight || tags['maxweight:hgv']) {
          const w = tags.maxweight || tags['maxweight:hgv'];
          type = 'weight';
          label = `${w}t`;
          title = `Обмеження ваги: ${w} т`;
          detail = 'Максимальна дозволена маса ТЗ';
        } else if (tags.maxaxleload) {
          type = 'axle';
          label = `${tags.maxaxleload}t`;
          title = `Обмеження на вісь: ${tags.maxaxleload} т`;
          detail = 'Максимальне навантаження на вісь';
        } else if (tags.hgv === 'no' || tags.hgv === 'prohibited') {
          type = 'no_hgv';
          label = '🚫';
          title = "Рух вантажівок заборонено (HGV=NO)";
          detail = tags.name ? `Вулиця: ${tags.name}` : "Заборона в'їзду вантажного транспорту";
        } else if (tags.maxspeed) {
          const s = parseInt(tags.maxspeed, 10);
          if (isNaN(s) || s <= 0 || s > 130) return null;
          type = 'speed_limit';
          label = `${s}`;
          title = `Обмеження швидкості: ${s} км/год`;
          detail = tags.name ? `Ділянка: ${tags.name}` : `Ділянка з обмеженням ${s} км/год`;
          speedVal = s;
        }

        return {
          id: `hgv-restr-${el.type}-${el.id}`,
          category: type === 'speed_limit' ? 'speed_limit' : 'hgv_restriction',
          type,
          label,
          title,
          description: detail,
          coordinates: [lon, lat],
          speedLimit: speedVal,
          tags,
        };
      }).filter(Boolean);
    } catch (e) {
      console.warn(`Overpass restriction endpoint ${url} failed:`, e.message);
    }
  }

  return [];
}

/**
 * Query signs along an entire route geometry by sampling key transit points in parallel
 */
export async function fetchOverpassRouteSigns(routeCoordinates) {
  if (!routeCoordinates || routeCoordinates.length === 0) return [];

  const len = routeCoordinates.length;
  const sampleIndices = [0];
  if (len > 20) sampleIndices.push(Math.floor(len * 0.2));
  if (len > 40) sampleIndices.push(Math.floor(len * 0.4));
  if (len > 60) sampleIndices.push(Math.floor(len * 0.6));
  if (len > 80) sampleIndices.push(Math.floor(len * 0.8));
  sampleIndices.push(len - 1);

  const samplePoints = sampleIndices.map(i => routeCoordinates[i]).filter(Boolean);

  // Execute all sample segment queries in PARALLEL for speed and resilience
  const promises = samplePoints.map(([lon, lat]) => {
    const bbox = [lat - 0.09, lon - 0.09, lat + 0.09, lon + 0.09];
    return fetchOverpassHgvRestrictions(bbox);
  });

  const results = await Promise.allSettled(promises);

  const allSigns = [];
  const seenIds = new Set();

  results.forEach(res => {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      res.value.forEach(s => {
        if (s && s.id && !seenIds.has(s.id)) {
          seenIds.add(s.id);
          allSigns.push(s);
        }
      });
    }
  });

  return allSigns;
}
