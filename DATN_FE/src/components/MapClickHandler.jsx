import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

/**
 * Component để lắng nghe click trên bản đồ
 * Được sử dụng trong MapContainer để capture tọa độ khi click
 */
function MapClickHandler({ isActive, onMapClick }) {
  const map = useMap();

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const handleMapClick = (e) => {
      const { lat, lng } = e.latlng;
      onMapClick?.([lat, lng]);
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, isActive, onMapClick]);

  return null;
}

export default MapClickHandler;
