import { MapContainer, Polyline, TileLayer } from 'react-leaflet';
import { useEffect, useMemo, useState } from 'react';
import { fetchRoadRoute } from '../../utils/routing';

const FALLBACK_CENTER = [10.7769, 106.7009];

function parseCoordinates(route) {
  if (!route) {
    return [];
  }

  const source = route.coordinates || route.path || [];

  if (!Array.isArray(source)) {
    return [];
  }

  return source
    .map((point) => {
      if (Array.isArray(point) && point.length >= 2) {
        const a = Number(point[0]);
        const b = Number(point[1]);
        if (Number.isFinite(a) && Number.isFinite(b)) {
          // Detect [lon, lat] ordering (common in GeoJSON) and swap to [lat, lon]
          if (Math.abs(a) > 90 && Math.abs(b) <= 90) {
            return [b, a];
          }
          return [a, b];
        }
        return null;
      }

      if (point && typeof point === 'object' && Number.isFinite(point.lat) && Number.isFinite(point.lng)) {
        return [point.lat, point.lng];
      }

      if (point && typeof point === 'object' && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)) {
        return [point.latitude, point.longitude];
      }

      return null;
    })
    .filter((point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite));
}

function TrafficMapPanel({ routeData }) {
  const bestRouteCoords = parseCoordinates(routeData?.best_route);
  const alternativeCoords = (routeData?.alternatives || []).map(parseCoordinates).filter((arr) => arr.length > 1);

  const [enrichedRoutes, setEnrichedRoutes] = useState({});
  const [loadingRoutes, setLoadingRoutes] = useState(false);

  useEffect(() => {
    let active = true;

    async function enrich() {
      setLoadingRoutes(true);

      try {
        const routes = [routeData?.best_route, ...(routeData?.alternatives || [])].filter(Boolean);
        const results = {};

        await Promise.all(routes.map(async (route, idx) => {
          const coords = parseCoordinates(route);
          if (!coords.length) return;

          // If route already has many points, skip OSRM fetch
          if (coords.length >= 6) {
            results[route.id || route.name || `r-${idx}`] = coords;
            return;
          }

          try {
            const start = coords[0];
            const end = coords[coords.length - 1];

            if (!start || !end) {
              results[route.id || route.name || `r-${idx}`] = coords;
              return;
            }

            const fetched = await fetchRoadRoute({
              latStart: Number(start[0]),
              lonStart: Number(start[1]),
              latEnd: Number(end[0]),
              lonEnd: Number(end[1]),
            });

            if (active && Array.isArray(fetched) && fetched.length) {
              results[route.id || route.name || `r-${idx}`] = fetched;
            } else {
              results[route.id || route.name || `r-${idx}`] = coords;
            }
          } catch {
            results[route.id || route.name || `r-${idx}`] = coords;
          }
        }));

        if (active) {
          setEnrichedRoutes(results);
        }
      } finally {
        if (active) setLoadingRoutes(false);
      }
    }

    enrich();

    return () => {
      active = false;
    };
  }, [routeData]);

  const bestCoordsToRender = useMemo(() => {
    const key = routeData?.best_route?.id || routeData?.best_route?.name || 'best';
    return enrichedRoutes[key] || bestRouteCoords;
  }, [enrichedRoutes, bestRouteCoords, routeData]);

  const alternativeCoordsToRender = useMemo(() => {
    return (routeData?.alternatives || []).map((r, idx) => {
      const key = r?.id || r?.name || `alt-${idx}`;
      return enrichedRoutes[key] || parseCoordinates(r);
    }).filter((arr) => arr.length > 1);
  }, [enrichedRoutes, routeData]);

  const center = bestCoordsToRender[0] || alternativeCoordsToRender[0]?.[0] || FALLBACK_CENTER;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Route Map</h3>
      <p className="mt-1 text-sm text-slate-500">Blue line is best route, orange lines are alternatives.</p>

      <div className="relative mt-4 h-72 overflow-hidden rounded-xl border border-slate-200 md:h-96">
        <MapContainer center={center} zoom={13} scrollWheelZoom className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {alternativeCoordsToRender.map((coords, index) => (
            <Polyline
              key={`alt-route-${index + 1}`}
              positions={coords}
              pathOptions={{ color: '#f97316', weight: 5, opacity: 0.85, dashArray: '6 8' }}
            />
          ))}

          {bestCoordsToRender.length > 1 ? (
            <Polyline positions={bestCoordsToRender} pathOptions={{ color: '#0284c7', weight: 7, opacity: 0.95 }} />
          ) : null}

        </MapContainer>

        {loadingRoutes ? (
          <div style={{ position: 'absolute', right: 12, top: 12, zIndex: 999 }} className="rounded px-3 py-1 text-xs font-semibold bg-white shadow">Loading route geometry...</div>
        ) : null}
      
      </div>
    </section>
  );
}

export default TrafficMapPanel;
