const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const GOOGLE_MAPS_SCRIPT_ID = 'google-maps-js-api';

let googleMapsApiPromise = null;

function buildScriptUrl(libraries = []) {
  const params = new URLSearchParams({
    key: GOOGLE_MAPS_API_KEY,
    v: 'weekly',
    language: 'vi',
    region: 'VN',
    loading: 'async',
  });

  if (libraries.length > 0) {
    params.set('libraries', libraries.join(','));
  }

  return `https://maps.googleapis.com/maps/api/js?${params}`;
}

export function hasGoogleMapsApiKey() {
  return Boolean(GOOGLE_MAPS_API_KEY);
}

export function loadGoogleMapsApi(libraries = ['places']) {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps API can only be loaded in the browser'));
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(new Error('Thiếu VITE_GOOGLE_MAPS_API_KEY'));
  }

  if (!googleMapsApiPromise) {
    googleMapsApiPromise = new Promise((resolve, reject) => {
      const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID);
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(window.google.maps), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Không thể tải Google Maps JavaScript API')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.id = GOOGLE_MAPS_SCRIPT_ID;
      script.src = buildScriptUrl(libraries);
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.google.maps);
      script.onerror = () => reject(new Error('Không thể tải Google Maps JavaScript API'));
      document.head.appendChild(script);
    });
  }

  return googleMapsApiPromise;
}