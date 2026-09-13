/**
 * Route Safety Utility: Detects conflicts between a route and HGV restriction signs
 */

export function detectRouteSignConflicts(routeData, hgvRestrictions) {
  if (!routeData || !routeData.geojson || !hgvRestrictions || hgvRestrictions.length === 0) {
    return [];
  }

  let coords = [];
  const gj = routeData.geojson;
  if (gj.type === 'FeatureCollection') {
    coords = gj.features[0]?.geometry?.coordinates || [];
  } else if (gj.type === 'Feature') {
    coords = gj.geometry?.coordinates || [];
  } else if (gj.geometry) {
    coords = gj.geometry.coordinates || [];
  }

  if (coords.length < 2) return [];

  const conflicts = [];
  const seenIds = new Set();

  hgvRestrictions.forEach(restr => {
    if (!restr.coordinates || seenIds.has(restr.id)) return;
    const [rLon, rLat] = restr.coordinates;

    // Check min distance to any segment of the route (within ~180 meters)
    for (let i = 0; i < coords.length - 1; i++) {
      const [lon1, lat1] = coords[i];
      const [lon2, lat2] = coords[i + 1];

      const distKm = distToSegment(rLat, rLon, lat1, lon1, lat2, lon2);
      if (distKm <= 0.18) {
        conflicts.push(restr);
        seenIds.add(restr.id);
        break;
      }
    }
  });

  return conflicts;
}

// Distance from point (pLat, pLon) to line segment (lat1, lon1) -> (lat2, lon2) in km
function distToSegment(pLat, pLon, lat1, lon1, lat2, lon2) {
  const dx = lon2 - lon1;
  const dy = lat2 - lat1;
  if (dx === 0 && dy === 0) return Math.hypot((pLat - lat1) * 111.32, (pLon - lon1) * 111.32 * Math.cos(pLat * Math.PI / 180));

  const t = Math.max(0, Math.min(1, ((pLon - lon1) * dx + (pLat - lat1) * dy) / (dx * dx + dy * dy)));
  const projLon = lon1 + t * dx;
  const projLat = lat1 + t * dy;

  const latDiff = (pLat - projLat) * 111.32;
  const lonDiff = (pLon - projLon) * 111.32 * Math.cos(pLat * Math.PI / 180);
  return Math.hypot(latDiff, lonDiff);
}
