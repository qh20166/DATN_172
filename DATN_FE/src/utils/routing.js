import { loadGoogleMapsApi } from './googleMapsApi';

const OSRM_BASE_URL = 'https://router.project-osrm.org';
const ROUTE_CACHE_KEY = 'traffic_web_route_cache_v2';
const GOOGLE_ROUTE_CACHE_KEY = 'traffic_web_google_route_cache_v2';
const SNAP_CACHE_KEY = 'traffic_web_snap_cache_v1';

function getCache() {
  try {
    return JSON.parse(localStorage.getItem(ROUTE_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function setCache(cache) {
  try {
    localStorage.setItem(ROUTE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage failures; routing still works without cache.
  }
}

function getSnapCache() {
  try {
    return JSON.parse(localStorage.getItem(SNAP_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function setSnapCache(cache) {
  try {
    localStorage.setItem(SNAP_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage failures.
  }
}

function getGoogleRouteCache() {
  try {
    return JSON.parse(localStorage.getItem(GOOGLE_ROUTE_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function setGoogleRouteCache(cache) {
  try {
    localStorage.setItem(GOOGLE_ROUTE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage failures.
  }
}

function toPointKey(lon, lat) {
  return [lon, lat].map((value) => Number(value).toFixed(5)).join(':');
}

function haversineDistanceMeters([lat1, lon1], [lat2, lon2]) {
  const earthRadius = 6371000;
  const toRadians = (value) => (value * Math.PI) / 180;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

function normalizeBearing(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }

  let normalized = number % 360;
  if (normalized < 0) {
    normalized += 360;
  }

  return normalized;
}

function oppositeBearing(value) {
  return (value + 180) % 360;
}

function bearingDelta(a, b) {
  const left = normalizeBearing(a);
  const right = normalizeBearing(b);

  if (left === null || right === null) {
    return null;
  }

  const diff = Math.abs(left - right);
  return Math.min(diff, 360 - diff);
}

function computeHeading([lat1, lon1], [lat2, lon2]) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const toDegrees = (value) => (value * 180) / Math.PI;
  const y = Math.sin(toRadians(lon2 - lon1)) * Math.cos(toRadians(lat2));
  const x = Math.cos(toRadians(lat1)) * Math.sin(toRadians(lat2))
    - Math.sin(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.cos(toRadians(lon2 - lon1));

  return normalizeBearing(toDegrees(Math.atan2(y, x)));
}

function decodePolyline(encoded) {
  if (!encoded) {
    return [];
  }

  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates = [];

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push([lat / 1e5, lng / 1e5]);
  }

  return coordinates;
}

function toDirectionsOrigin(place) {
  if (place?.placeId) {
    return { placeId: place.placeId };
  }

  return {
    lat: place.lat,
    lng: place.lon,
  };
}

function toDirectionsDestination(place) {
  if (place?.placeId) {
    return { placeId: place.placeId };
  }

  return {
    lat: place.lat,
    lng: place.lon,
  };
}

async function requestRoute({
  startPoint,
  endPoint,
  bearing,
  useBearing,
  radius,
}) {
  const url = new URL(`/route/v1/driving/${startPoint.lon},${startPoint.lat};${endPoint.lon},${endPoint.lat}`, OSRM_BASE_URL);
  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('steps', 'false');
  url.searchParams.set('alternatives', 'true');
  url.searchParams.set('generate_hints', 'false');
  url.searchParams.set('radiuses', `${radius};${radius}`);

  if (useBearing && bearing !== null) {
    const startBearing = `${bearing},45`;
    const endBearing = `${oppositeBearing(bearing)},45`;
    url.searchParams.set('bearings', `${startBearing};${endBearing}`);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error('Route request failed');
  }

  const payload = await response.json();
  return Array.isArray(payload?.routes) ? payload.routes : [];
}

function scoreRouteCandidate(segment, route) {
  if (!Array.isArray(route?.geometry?.coordinates) || route.geometry.coordinates.length < 2) {
    return null;
  }

  const positions = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
  const rawStart = [segment.latStart, segment.lonStart];
  const rawEnd = [segment.latEnd, segment.lonEnd];

  const start = positions[0];
  const end = positions[positions.length - 1];

  const forwardAnchor = haversineDistanceMeters(rawStart, start) + haversineDistanceMeters(rawEnd, end);
  const reverseAnchor = haversineDistanceMeters(rawStart, end) + haversineDistanceMeters(rawEnd, start);

  const useReversed = reverseAnchor < forwardAnchor;
  const anchoredPositions = useReversed ? [...positions].reverse() : positions;
  const anchorDistance = Math.min(forwardAnchor, reverseAnchor);

  const straightDistance = haversineDistanceMeters(rawStart, rawEnd);
  const detourRatio = route.distance / Math.max(straightDistance, 1);

  const routeHeading = computeHeading(anchoredPositions[0], anchoredPositions[1]);
  const headingGap = bearingDelta(segment.bearing, routeHeading);
  const headingPenalty = headingGap === null ? 0 : (headingGap / 180) * 240;
  const detourPenalty = Math.max(0, detourRatio - 1) * 150;

  return {
    positions: anchoredPositions,
    detourRatio,
    score: anchorDistance + headingPenalty + detourPenalty,
    anchorDistance,
  };
}

async function snapPointToRoad(lon, lat) {
  const cache = getSnapCache();
  const cacheKey = toPointKey(lon, lat);
  if (cache[cacheKey]) {
    return cache[cacheKey];
  }

  const url = new URL(`/nearest/v1/driving/${lon},${lat}`, OSRM_BASE_URL);
  url.searchParams.set('number', '1');

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error('Snap request failed');
  }

  const payload = await response.json();
  const waypoint = payload?.waypoints?.[0];
  const snapped = waypoint?.location;

  if (!snapped?.length) {
    throw new Error('No snapped point');
  }

  const result = {
    lon: snapped[0],
    lat: snapped[1],
  };

  cache[cacheKey] = result;
  setSnapCache(cache);
  return result;
}

export function getRouteCacheKey(segment) {
  return [segment.latStart, segment.lonStart, segment.latEnd, segment.lonEnd].map((value) => Number(value).toFixed(5)).join(':');
}

export function readCachedRoute(segment) {
  const cache = getCache();
  return cache[getRouteCacheKey(segment)] || null;
}

export function writeCachedRoute(segment, route) {
  const cache = getCache();
  cache[getRouteCacheKey(segment)] = route;
  setCache(cache);
}

export async function fetchRoadRoute(segment) {
  const cached = readCachedRoute(segment);
  if (cached) {
    return cached;
  }

  const startPoint = await snapPointToRoad(segment.lonStart, segment.latStart);
  const endPoint = await snapPointToRoad(segment.lonEnd, segment.latEnd);
  const rawStartPoint = { lon: segment.lonStart, lat: segment.latStart };
  const rawEndPoint = { lon: segment.lonEnd, lat: segment.latEnd };
  const bearing = normalizeBearing(segment.bearing);
  const scenarios = [
    { startPoint, endPoint, useBearing: true, radius: 40, bearing },
    { startPoint: rawStartPoint, endPoint: rawEndPoint, useBearing: true, radius: 80, bearing },
    { startPoint, endPoint, useBearing: false, radius: 120, bearing },
    { startPoint: rawStartPoint, endPoint: rawEndPoint, useBearing: false, radius: 200, bearing },
    {
      startPoint: endPoint,
      endPoint: startPoint,
      useBearing: true,
      radius: 80,
      bearing: bearing === null ? null : oppositeBearing(bearing),
    },
  ];

  const candidates = [];

  for (const scenario of scenarios) {
    try {
      const routes = await requestRoute(scenario);
      routes.forEach((route) => {
        const scored = scoreRouteCandidate(segment, route);
        if (scored) {
          candidates.push(scored);
        }
      });
    } catch {
      // Continue trying the next scenario.
    }
  }

  const best = [...candidates].sort((left, right) => left.score - right.score)[0];

  if (!best) {
    throw new Error('No route geometry');
  }

  if (best.detourRatio > 12 || best.anchorDistance > 600) {
    throw new Error('Route detour too large');
  }

  writeCachedRoute(segment, best.positions);
  return best.positions;
}

function getGoogleRouteCacheKey(startPlace, endPlace) {
  return [startPlace.lat, startPlace.lon, endPlace.lat, endPlace.lon]
    .map((value) => Number(value).toFixed(5))
    .join(':');
}

export async function fetchGoogleRoute(startPlace, endPlace) {
  const cache = getGoogleRouteCache();
  const cacheKey = getGoogleRouteCacheKey(startPlace, endPlace);

  if (cache[cacheKey]) {
    return cache[cacheKey];
  }

  const maps = await loadGoogleMapsApi(['routes']);
  
  try {
    // Use new Routes API (recommended since February 2026)
    console.log('[fetchGoogleRoute] Using new Routes.computeRoutes API');
    
    const response = await maps.routes.Route.computeRoutes({
      origin: toDirectionsOrigin(startPlace),
      destination: toDirectionsDestination(endPlace),
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      languageCode: 'vi',
      computeAlternativeRoutes: false,
    });

    console.log('[fetchGoogleRoute] Routes API response:', response);

    if (!response.routes || response.routes.length === 0) {
      throw new Error('No routes returned from Google Routes API');
    }

    const route = response.routes[0];
    const leg = route.legs?.[0];

    if (!route.polyline?.encodedPolyline) {
      throw new Error('No polyline geometry from Routes API');
    }

    // Decode the polyline to get positions
    const positions = decodePolyline(route.polyline.encodedPolyline);

    if (!positions.length) {
      throw new Error('No route geometry from decoded polyline');
    }

    // Extract distance and duration from the route leg
    const distanceMeters = leg?.distanceMeters ?? NaN;
    const durationSeconds = leg?.duration ? Math.round(leg.duration.seconds) : NaN;

    const result = {
      positions,
      distanceText: leg ? `${(distanceMeters / 1000).toFixed(1)} km` : '',
      durationText: leg && durationSeconds ? `${Math.round(durationSeconds / 60)} phút` : '',
      distanceMeters: Number.isFinite(distanceMeters) ? distanceMeters : null,
      durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
    };

    cache[cacheKey] = result;
    setGoogleRouteCache(cache);
    return result;
  } catch (error) {
    console.error('[fetchGoogleRoute] Routes API error, falling back to OSRM:', error);
    // Let the caller handle fallback to OSRM route
    throw error;
  }
}
