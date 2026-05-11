import { useCallback, useEffect, useState } from 'react';
import { fetchGoogleRoute, fetchRoadRoute } from '../utils/routing';
import { getPlaceName } from '../utils/geocoding';
import { classifyCongestion, levelLabels } from '../utils/traffic';
import PlacesSearch from './PlacesSearch';
import '../styles/RouteFinderPanel.css';

function haversineDistanceMeters([lat1, lon1], [lat2, lon2]) {
  const earthRadius = 6371000;
  const toRadians = (value) => (value * Math.PI) / 180;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

function getSegmentAnchorPoints(segment) {
  if (Array.isArray(segment.geometry) && segment.geometry.length >= 2) {
    return segment.geometry;
  }

  return [
    [segment.latStart, segment.lonStart],
    [segment.latEnd, segment.lonEnd],
  ];
}

function getRouteCongestion(route, trafficSegments = []) {
  if (!Array.isArray(route) || !trafficSegments.length) {
    return {
      level: 'smooth',
      score: 0.3,
      hasMatch: false,
    };
  }

  let bestMatch = null;

  trafficSegments.forEach((segment) => {
    const anchors = getSegmentAnchorPoints(segment);
    const minDistance = Math.min(
      ...route.map((point) => Math.min(...anchors.map((anchor) => haversineDistanceMeters(point, anchor)))),
    );

    if (minDistance <= 250 && (!bestMatch || minDistance < bestMatch.distance)) {
      bestMatch = {
        distance: minDistance,
        score: Number(segment.score) || 0,
      };
    }
  });

  if (!bestMatch) {
    return {
      level: 'smooth',
      score: 0.3,
      hasMatch: false,
    };
  }

  return {
    level: classifyCongestion(bestMatch.score),
    score: bestMatch.score,
    hasMatch: true,
  };
}

function RouteFinderPanel({
  onRouteFound,
  userPosition,
  trafficSegments = [],
  onSelectionModeChange,
  selectingMode,
  onRegisterMapPointCallback,
}) {
  const [startPlace, setStartPlace] = useState(null);
  const [endPlace, setEndPlace] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [routeResult, setRouteResult] = useState(null);

  // Use user position as start point if available
  useEffect(() => {
    if (userPosition && !startPlace) {
      setStartPlace({
        name: `Vị trí hiện tại (${userPosition[0].toFixed(4)}, ${userPosition[1].toFixed(4)})`,
        lat: userPosition[0],
        lon: userPosition[1],
      });
    }
  }, [userPosition, startPlace]);

  async function handleFindRoute() {
    setError('');
    setRouteResult(null);

    if (!startPlace) {
      setError('Vui lòng chọn điểm bắt đầu');
      return;
    }

    if (!endPlace) {
      setError('Vui lòng chọn điểm kết thúc');
      return;
    }

    setLoading(true);

    try {
      let route;
      let distanceText = '';
      let durationText = '';

      try {
        const googleRoute = await fetchGoogleRoute(startPlace, endPlace);
        route = googleRoute.positions;
        distanceText = googleRoute.distanceText;
        durationText = googleRoute.durationText;
      } catch (googleError) {
        console.warn('Google route failed, falling back to road route:', googleError);

        try {
          route = await fetchRoadRoute({
            latStart: startPlace.lat,
            lonStart: startPlace.lon,
            latEnd: endPlace.lat,
            lonEnd: endPlace.lon,
          });
        } catch (roadError) {
          throw new Error(roadError.message || 'Không thể dựng tuyến đường giao thông');
        }
      }

      if (!route || !Array.isArray(route) || route.length === 0) {
        setError('Không tìm thấy tuyến đường hợp lệ');
        setLoading(false);
        return;
      }

      const congestion = getRouteCongestion(route, trafficSegments);

      const result = {
        route,
        startCoords: { lat: startPlace.lat, lon: startPlace.lon },
        endCoords: { lat: endPlace.lat, lon: endPlace.lon },
        startPlace,
        endPlace,
        distanceText,
        durationText,
        level: congestion.level,
        score: congestion.score,
        hasTrafficData: congestion.hasMatch,
      };

      setRouteResult(result);
      onRouteFound?.(result);
    } catch (err) {
      setError(`Lỗi tìm đường: ${err.message || 'Vui lòng thử lại'}`);
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setStartPlace(null);
    setEndPlace(null);
    setError('');
    setRouteResult(null);
    onSelectionModeChange?.(null);
    onRouteFound?.(null);
  }

  const handleMapPointSelected = useCallback(
    async (coords) => {
      const fallbackName = `Tọa độ: ${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}`;
      let placeName = fallbackName;

      try {
        placeName = await getPlaceName(coords[0], coords[1]);
      } catch {
        placeName = fallbackName;
      }

      if (selectingMode === 'start') {
        setStartPlace({
          name: placeName,
          lat: coords[0],
          lon: coords[1],
        });
        onSelectionModeChange?.('end');
      } else if (selectingMode === 'end') {
        setEndPlace({
          name: placeName,
          lat: coords[0],
          lon: coords[1],
        });
        onSelectionModeChange?.(null);
      }
    },
    [selectingMode, onSelectionModeChange],
  );

  // Register callback with parent component
  useEffect(() => {
    onRegisterMapPointCallback?.(handleMapPointSelected);
  }, [handleMapPointSelected, onRegisterMapPointCallback]);

  return (
    <div className="route-finder-panel">
      <h3>Tìm Đường Đi</h3>

      <div className="route-finder-form">
        <div className="form-group">
          <label htmlFor="start-place">Điểm bắt đầu</label>
          <PlacesSearch
            id="start-place"
            placeholder="Nhập tên địa điểm"
            value={startPlace?.name || ''}
            onPlaceSelected={setStartPlace}
            disabled={selectingMode === 'start'}
            showMapSelect={true}
            onMapSelectClick={() =>
              onSelectionModeChange?.(selectingMode === 'start' ? null : 'start')
            }
          />
        </div>

        <div className="form-group">
          <label htmlFor="end-place">Điểm kết thúc</label>
          <PlacesSearch
            id="end-place"
            placeholder="Nhập tên địa điểm"
            value={endPlace?.name || ''}
            onPlaceSelected={setEndPlace}
            disabled={selectingMode === 'end'}
            showMapSelect={true}
            onMapSelectClick={() =>
              onSelectionModeChange?.(selectingMode === 'end' ? null : 'end')
            }
          />
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={handleFindRoute}
            disabled={loading || !startPlace || !endPlace}
          >
            {loading ? 'Đang tìm...' : 'Tìm Đường'}
          </button>
          <button type="button" className="btn-secondary" onClick={handleClear}>
            Xóa
          </button>
        </div>

        {error && <p className="error-message">{error}</p>}

        {routeResult && (
          <div className="route-result">
            <h4> Kết quả tìm đường</h4>
            <div className="result-places">
              <p>
                <strong>Từ:</strong> {routeResult.startPlace.name}
              </p>
              <p>
                <strong>Đến:</strong> {routeResult.endPlace.name}
              </p>
            </div>
            <div className={`traffic-status status-${routeResult.level}`}>
              <strong>Tình trạng giao thông:</strong>
              <span className="status-label">
                {routeResult.level === 'smooth' && '🟢'}
                {routeResult.level === 'slow' && '🟡'}
                {routeResult.level === 'heavy' && '🔴'}
                {' '}
                {levelLabels[routeResult.level]}
              </span>
            </div>
            <div className="route-info">
              {routeResult.distanceText && (
                <p>
                  <strong>Quãng đường:</strong> {routeResult.distanceText}
                </p>
              )}
              {routeResult.durationText && (
                <p>
                  <strong>Thời gian dự kiến:</strong> {routeResult.durationText}
                </p>
              )}
              <p>
                <strong>Điểm kẹt:</strong> {(routeResult.score * 100).toFixed(1)}%
              </p>
              <p>
                <strong>Dữ liệu giao thông:</strong>{' '}
                {routeResult.hasTrafficData ? '✓ Có dữ liệu' : '⚠️ Mặc định'}
              </p>
              <p className="info-note">
                {routeResult.level === 'smooth' && '✅ Đường thông thoáng'}
                {routeResult.level === 'slow' && '⚠️ Đường có dấu hiệu chậm'}
                {routeResult.level === 'heavy' && '❌ Đường bị kẹt cao'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RouteFinderPanel;
