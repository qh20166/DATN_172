import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet';
import { getLevelColor, levelLabels, classifySpeedLevel, getSpeedLevelColor } from '../utils/traffic';
import { useTrafficData } from '../utils/useTrafficData';
import { fetchRoadRoute } from '../utils/routing';
import RouteFinderPanel from '../components/RouteFinderPanel';
import MapClickHandler from '../components/MapClickHandler';
import TrafficLegend from '../components/TrafficLegend';

const HCMC_CENTER = [10.7769, 106.7009];
const ROUTE_CONCURRENCY = 5;

function RecenterMap({ position }) {
  const map = useMap();

  useEffect(() => {
    if (!position) {
      return;
    }

    map.flyTo(position, 15, { animate: true, duration: 0.8 });
  }, [map, position]);

  return null;
}

function MapPage() {
  const { data, loading, error } = useTrafficData();
  const [routeMap, setRouteMap] = useState({});
  const [showTraffic, setShowTraffic] = useState(true);
  const [missingRoutes, setMissingRoutes] = useState(0);
  const [routeStatus, setRouteStatus] = useState('Đang bám tuyến đường thực...');
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [userPosition, setUserPosition] = useState(null);
  const [foundRoute, setFoundRoute] = useState(null);
  const [showRoutePanel, setShowRoutePanel] = useState(true);
  const [selectingMode, setSelectingMode] = useState(null);
  const mapPointCallbackRef = useRef(null);
  const hasRequestedLocation = useRef(false);

  const segments = useMemo(() => data?.segments ?? [], [data]);
  const visibleSegments = useMemo(() => [...segments].sort((a, b) => b.score - a.score), [segments]);
  const segmentsWithGeometry = useMemo(
    () => visibleSegments.filter((segment) => Array.isArray(segment.geometry) && segment.geometry.length >= 2),
    [visibleSegments],
  );
  const segmentsNeedRouting = useMemo(
    () => visibleSegments.filter((segment) => !Array.isArray(segment.geometry) || segment.geometry.length < 2),
    [visibleSegments],
  );

  useEffect(() => {
    let active = true;

    async function loadRoutes() {
      if (!visibleSegments.length) {
        setRouteMap({});
        setMissingRoutes(0);
        return;
      }

      setRouteStatus(`Đang bám tuyến đường thực cho ${visibleSegments.length} đoạn...`);

      const nextMap = Object.fromEntries(
        visibleSegments.map((segment) => [
          segment.id,
          segment.geometry || [
            [segment.latStart, segment.lonStart],
            [segment.latEnd, segment.lonEnd],
          ],
        ]),
      );
      setRouteMap({ ...nextMap });

      let missingCount = 0;

      if (!segmentsNeedRouting.length) {
        setMissingRoutes(0);
        setRouteStatus(`Đã dùng asset/geometry.csv cho ${segmentsWithGeometry.length}/${visibleSegments.length} đoạn`);
        return;
      }

      for (let index = 0; index < segmentsNeedRouting.length; index += ROUTE_CONCURRENCY) {
        const batch = segmentsNeedRouting.slice(index, index + ROUTE_CONCURRENCY);

        const batchEntries = await Promise.all(
          batch.map(async (segment) => {
            try {
              const route = await fetchRoadRoute(segment);
              return [segment.id, route];
            } catch {
              return [segment.id, null];
            }
          }),
        );

        if (!active) {
          return;
        }

        batchEntries.forEach(([segmentId, route]) => {
          if (route) {
            nextMap[segmentId] = route;
          } else {
            delete nextMap[segmentId];
            missingCount += 1;
          }
        });

        setRouteMap({ ...nextMap });
        setMissingRoutes(missingCount);
        setRouteStatus(
          `Geometry sẵn có: ${segmentsWithGeometry.length}. Bổ sung tuyến OSRM: ${segmentsNeedRouting.length - missingCount}/${segmentsNeedRouting.length}`,
        );
      }

      if (active) {
        setRouteStatus(`Đã hoàn tất bám tuyến: geometry ${segmentsWithGeometry.length}, OSRM ${segmentsNeedRouting.length - missingCount}`);
      }
    }

    loadRoutes();

    return () => {
      active = false;
    };
  }, [segmentsNeedRouting, segmentsWithGeometry.length, visibleSegments]);

  function locateUser() {
    if (!navigator.geolocation) {
      setLocationError('Trình duyệt không hỗ trợ định vị.');
      return;
    }

    setIsLocating(true);
    setLocationError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        setUserPosition([position.coords.latitude, position.coords.longitude]);
      },
      (geoError) => {
        setIsLocating(false);
        setLocationError(geoError.message || 'Không thể lấy vị trí hiện tại.');
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 60000,
      },
    );
  }

  useEffect(() => {
    if (hasRequestedLocation.current) {
      return;
    }

    hasRequestedLocation.current = true;
    locateUser();
  }, []);

  // Hide traffic when route is found
  useEffect(() => {
    if (foundRoute) {
      setShowTraffic(false);
    }
  }, [foundRoute]);

  // Create callback function for map point selection
  const handleMapPointSelected = useCallback((coords) => {
    if (mapPointCallbackRef.current) {
      mapPointCallbackRef.current(coords);
    }
  }, []);

  if (loading) {
    return <p className="loading">Đang tải dữ liệu giao thông...</p>;
  }

  if (error) {
    return <p className="error">{error}</p>;
  }

  return (
    <div className="map-page">
      <section className="page-head">
        <div>
          <h2>Bản đồ kẹt xe TP.HCM</h2>
        </div>
        <div className="tag-group">
          <button
            type="button"
            className="map-toggle-btn"
            onClick={locateUser}
            disabled={isLocating}
          >
            {isLocating ? 'Đang lấy vị trí...' : 'Vị trí của tôi'}
          </button>
          <button
            type="button"
            className="map-toggle-btn"
            onClick={() => setShowTraffic((prev) => !prev)}
            aria-pressed={showTraffic}
          >
            {showTraffic ? 'Ẩn đường giao thông' : 'Hiện đường giao thông'}
          </button>
          <button
            type="button"
            className="map-toggle-btn"
            onClick={() => setShowRoutePanel((prev) => !prev)}
            aria-pressed={showRoutePanel}
          >
            {showRoutePanel ? 'Ẩn tìm đường' : 'Hiện tìm đường'}
          </button>
        </div>
      </section>

      <div className="map-wrapper">
        {showRoutePanel && (
          <aside className="map-sidebar">
            <RouteFinderPanel
              onRouteFound={setFoundRoute}
              userPosition={userPosition}
              trafficSegments={visibleSegments}
              onSelectionModeChange={setSelectingMode}
              selectingMode={selectingMode}
              onRegisterMapPointCallback={(callback) => {
                mapPointCallbackRef.current = callback;
              }}
            />
          </aside>
        )}

        <MapContainer center={HCMC_CENTER} zoom={12} scrollWheelZoom className="leaflet-map">
          <RecenterMap position={userPosition} />
          <MapClickHandler isActive={!!selectingMode} onMapClick={handleMapPointSelected} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {userPosition ? (
            <CircleMarker
              center={userPosition}
              radius={9}
              pathOptions={{ color: '#004aad', fillColor: '#006be6', fillOpacity: 0.82, weight: 2 }}
            >
              <Popup>Bạn đang ở đây</Popup>
            </CircleMarker>
          ) : null}

          {/* Display found route */}
          {foundRoute && (
            <Fragment>
              {/* Start marker */}
              <CircleMarker
                center={[foundRoute.startCoords.lat, foundRoute.startCoords.lon]}
                radius={7}
                pathOptions={{ color: '#0066cc', fillColor: '#0066cc', fillOpacity: 1, weight: 2 }}
              />

              {/* End marker */}
              <CircleMarker
                center={[foundRoute.endCoords.lat, foundRoute.endCoords.lon]}
                radius={7}
                pathOptions={{ color: '#ff6600', fillColor: '#ff6600', fillOpacity: 1, weight: 2 }}
              />

              {/* Route line */}
              <Polyline
                positions={foundRoute.route}
                pathOptions={{
                  color: '#22c55e',
                  weight: 6,
                  opacity: 0.9,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              >
                <Tooltip sticky>
                  <div className="map-tooltip">
                    <strong>Đường Tìm Kiếm</strong>
                    <p>Tình trạng: {levelLabels[foundRoute.level]}</p>
                    <p>Điểm kẹt: {(foundRoute.score * 100).toFixed(1)}%</p>
                  </div>
                </Tooltip>
              </Polyline>
            </Fragment>
          )}

          {showTraffic
            ? visibleSegments.map((segment) => (
              <Fragment key={segment.id}>
                <Polyline
                  positions={routeMap[segment.id] || [
                    [segment.latStart, segment.lonStart],
                    [segment.latEnd, segment.lonEnd],
                  ]}
                  pathOptions={{
                    color: getSpeedLevelColor(classifySpeedLevel(segment.currentSpeed)),
                    weight: Math.max(2, 5 - segment.score * 2),
                    opacity: segment.level === 'heavy' ? 0.92 : 0.7,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                >
                  <Tooltip sticky>
                    <div className="map-tooltip">
                      <strong>{segment.name}</strong>
                      <p>Mức độ: {levelLabels[segment.level]}</p>
                      <p>Điểm kẹt: {(segment.score * 100).toFixed(1)}%</p>
                      <p>Tốc độ: {segment.currentSpeed} km/h</p>
                      <p>Thời tiết: {segment.weatherDescription}</p>
                    </div>
                  </Tooltip>
                </Polyline>
              </Fragment>
            ))
            : null}
        </MapContainer>

        {/* Traffic Speed Legend */}
        {showTraffic && (
          <div className="map-legend-overlay">
            <TrafficLegend />
          </div>
        )}
      </div>
      {locationError ? <p className="error">{locationError}</p> : null}
    </div>
  );
}

export default MapPage;
