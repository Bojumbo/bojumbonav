import { kml, gpx } from '@tmcw/togeojson';

/**
 * Parses user uploaded file (.kml, .geojson, .json, .gpx) into structured TruckNav POI array
 * @param {File} file 
 * @returns {Promise<{pois: Array, filename: string}>}
 */
export async function parsePoiFile(file) {
  const filename = file.name;
  const extension = filename.split('.').pop().toLowerCase();
  const text = await file.text();

  let geojson = null;

  if (extension === 'geojson' || extension === 'json') {
    try {
      geojson = JSON.parse(text);
    } catch (e) {
      throw new Error('Недійсний JSON/GeoJSON файл.');
    }
  } else if (extension === 'kml' || extension === 'xml') {
    try {
      const parser = new DOMParser();
      const kmlDoc = parser.parseFromString(text, 'text/xml');
      geojson = kml(kmlDoc);
    } catch (e) {
      throw new Error('Помилка зчитування KML файлу.');
    }
  } else if (extension === 'gpx') {
    try {
      const parser = new DOMParser();
      const gpxDoc = parser.parseFromString(text, 'text/xml');
      geojson = gpx(gpxDoc);
    } catch (e) {
      throw new Error('Помилка зчитування GPX файлу.');
    }
  } else {
    throw new Error('Непідтримуваний формат файлу. Використовуйте .kml, .geojson або .gpx');
  }

  if (!geojson || !geojson.features || !Array.isArray(geojson.features)) {
    throw new Error('У файлі не знайдено геометричних точок (Features).');
  }

  const pois = [];

  for (const feature of geojson.features) {
    if (!feature.geometry) continue;

    let coords = null;
    if (feature.geometry.type === 'Point') {
      coords = feature.geometry.coordinates; // [lon, lat, alt?]
    } else if (feature.geometry.type === 'LineString' || feature.geometry.type === 'Polygon') {
      // Use first coordinate or centroid for lines/polygons
      const flat = feature.geometry.coordinates.flat(2);
      if (flat.length >= 2) {
        coords = [flat[0], flat[1]];
      }
    }

    if (coords && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      const props = feature.properties || {};
      const name = props.name || props.title || props.Name || 'Маркер без назви';
      const description = props.description || props.desc || props.Snippet || '';

      pois.push({
        name: String(name).trim(),
        description: cleanHtmlDescription(String(description).trim()),
        coordinates: [coords[0], coords[1]], // [longitude, latitude]
      });
    }
  }

  return {
    filename,
    pois,
  };
}

function cleanHtmlDescription(str) {
  if (!str) return '';
  // Strip basic HTML tags from Google My Maps descriptions while keeping text
  return str.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
}
