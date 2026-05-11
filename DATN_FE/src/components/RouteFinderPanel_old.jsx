import { useCallback, useEffect, useState } from 'react';
import { fetchRoadRoute } from '../utils/routing';
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

function RouteFinderPanel({ onRouteFound, userPosition, trafficSegments = [], onSelectionModeChange, selectingMode, onRegisterMapPointCallback }) {
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

  function parseCoordinates(input) {
    const match = input.trim().match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
    if (match) {
      return {
        lat: parseFloat(match[1]),
        lon: parseFloat(match[2]),
      };
    }
    return null;
  }

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

      try {
        route = await fetchRoadRoute({
          latStart: startPlace.lat,
          lonStart: startPlace.lon,
          latEnd: endPlace.lat,
          lonEnd: endPlace.lon,
        });
      } catch {
        route = [
          [startPlace.lat, startPlace.lon],
          [endPlace.lat, endPlace.lon],
        ];
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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleFindRoute();
    }
  };

  const handleMapPointSelected = useCallback((coords) => {
    if (selectingMode === 'start') {
      setStartPlace({
        name: `Tọa độ: ${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}`,
        lat: coords[0],
        lon: coords[1],
      });
      onSelectionModeChange?.('end');
    } else if (selectingMode === 'end') {
      setEndPlace({
        name: `Tọa độ: ${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}`,
        lat: coords[0],
        lon: coords[1],
      });
      onSelectionModeChange?.(null);
    }
  }, [selectingMode, onSelectionModeChange]);

  // Register callback with parent component
  useEffect(() => {
    onRegisterMapPointCallback?.(handleMapPointSelected);
  }, [handleMapPointSelected, onRegisterMapPointCallback]);

  return (
    <div className="route-finder-panel">
      <h3>Tìm Đường Đi</h3>

      <div className="route-finder-form">
        <div className="form-group">
          <label htmlFor="start-input">Điểm bắt đầu</label>
          <input
            id="start-input"
            type="text"
            placeholder="lat, lon (e.g., 10.7769, 106.7009)"
            value={startInput}
            onChange={(e) => setStartInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={selectingMode === 'start'}
          />
          <div className="form-controls">
            <button
              type="button"
              className={`use-current-btn ${selectingMode === 'start' ? 'active' : ''}`}
              onClick={() => onSelectionModeChange?.(selectingMode === 'start' ? null : 'start')}
              title={selectingMode === 'start' ? 'Đang chọn. Click để hủy' : 'Chọn điểm trên bản đồ'}
            >
              {selectingMode === 'start' ? '✓ Chọn từ bản đồ' : ' Chọn từ bản đồ'}
            </button>
            {userPosition && (
              <button
                type="button"
                className="use-current-btn"
                onClick={() => setStartInput(`${userPosition[0].toFixed(4)}, ${userPosition[1].toFixed(4)}`)}
              >
                Vị trí hiện tại
              </button>
            )}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="end-input">Điểm kết thúc</label>
          <input
            id="end-input"
            type="text"
            placeholder="lat, lon (e.g., 10.7769, 106.7009)"
            value={endInput}
            onChange={(e) => setEndInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={selectingMode === 'end'}
          />
          <button
            type="button"
            className={`use-current-btn ${selectingMode === 'end' ? 'active' : ''}`}
            onClick={() => onSelectionModeChange?.(selectingMode === 'end' ? null : 'end')}
            title={selectingMode === 'end' ? 'Đang chọn. Click để hủy' : 'Chọn điểm trên bản đồ'}
          >
            {selectingMode === 'end' ? '✓ Chọn từ bản đồ' : ' Chọn từ bản đồ'}
          </button>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={handleFindRoute}
            disabled={loading || !startInput || !endInput}
          >
            {loading ? 'Đang tìm...' : 'Tìm Đường'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleClear}
          >
            Xóa
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {routeResult && (
        <div className="route-result">
          <h4>Kết Quả Đường Đi</h4>
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
            <p><strong>Khoảng cách:</strong> ~{(routeResult.route.length * 0.0001).toFixed(2)} km</p>
            <p><strong>Điểm kẹt:</strong> {(routeResult.score * 100).toFixed(1)}%</p>
            <p><strong>Dữ liệu giao thông:</strong> {routeResult.hasTrafficData ? 'Có dữ liệu khớp tuyến' : 'Không có dữ liệu, mặc định thông thoáng'}</p>
            <p className="info-note">
              {routeResult.level === 'smooth' && '✅ Đường thông thoáng'}
              {routeResult.level === 'slow' && '⚠️ Đường có dấu hiệu chậm hoặc kẹt nhẹ'}
              {routeResult.level === 'heavy' && '❌ Đường bị kẹt cao, nên tránh'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default RouteFinderPanel;
