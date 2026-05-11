import { loadGoogleMapsApi } from './googleMapsApi';

/**
 * Geocoding utilities using Google Maps Platform.
 */

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

function extractAddress(addressComponents = []) {
  const find = (...types) => {
    const component = addressComponents.find((item) => types.some((type) => item.types?.includes(type)));
    return component?.long_name || '';
  };

  return {
    city: find('administrative_area_level_2', 'locality', 'sublocality_level_1'),
    province: find('administrative_area_level_1'),
    country: find('country'),
  };
}

function dedupeByLatLon(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${Number(item.lat).toFixed(6)}:${Number(item.lon).toFixed(6)}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function searchPlacesWithGoogleTextSearch(query) {
  console.log('[searchPlacesWithGoogleTextSearch] Loading Google Maps API...');
  const maps = await loadGoogleMapsApi(['places']);
  console.log('[searchPlacesWithGoogleTextSearch] Google Maps loaded');

  try {
    // Use new AutocompleteSuggestion API (recommended since March 2025)
    const autocompleteSessionToken = new maps.places.AutocompleteSessionToken();
    
    console.log('[AutocompleteSuggestion] Requesting suggestions for:', query);
    const { suggestions } = await maps.places.AutocompleteSuggestion.fromQuery({
      input: query,
      sessionToken: autocompleteSessionToken,
      language: 'vi',
      region: 'vn',
      componentRestrictions: { country: 'vn' },
    });

    console.log('[AutocompleteSuggestion] Got suggestions count:', suggestions?.length || 0);

    if (!suggestions || suggestions.length === 0) {
      return [];
    }

    const geocoder = new maps.Geocoder();
    const detailedResults = await Promise.all(
      suggestions.slice(0, 8).map(async (suggestion) => {
        try {
          // Get place details using the placeId from suggestion
          const placeId = suggestion.place_id || suggestion.placeId;
          const geocodeResults = await new Promise((resolve) => {
            geocoder.geocode({ placeId }, (results, status) => {
              resolve({ results: results || [], status });
            });
          });

          const result = geocodeResults.results?.[0];
          if (!result?.geometry?.location) {
            return null;
          }

          return {
            name: suggestion.description || suggestion.main_text || '',
            displayName: suggestion.main_text || suggestion.description || '',
            lat: result.geometry.location.lat(),
            lon: result.geometry.location.lng(),
            type: result.types?.[0] || 'place',
            address: extractAddress(result.address_components || []),
            placeId: placeId,
          };
        } catch (error) {
          console.warn('[searchPlacesWithGoogleTextSearch] Error processing suggestion:', error);
          return null;
        }
      }),
    );

    return detailedResults.filter((item) => item && Number.isFinite(item.lat) && Number.isFinite(item.lon));
  } catch (error) {
    console.error('[searchPlacesWithGoogleTextSearch] AutocompleteSuggestion failed:', error);
    throw error;
  }
}

async function searchPlacesWithNominatim(query) {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: 10,
    countrycodes: 'vn',
  });

  const response = await fetch(`${NOMINATIM_BASE_URL}/search?${params}`, {
    headers: {
      'Accept-Language': 'vi,en',
    },
  });

  if (!response.ok) {
    throw new Error(`Geocoding fallback error: ${response.status}`);
  }

  const results = await response.json();
  return results.map((item) => ({
    name: item.display_name,
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
    type: item.type,
    address: item.address || {},
  }));
}

async function reverseGeocodeWithNominatim(lat, lon) {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    format: 'json',
    zoom: 18,
  });

  const response = await fetch(`${NOMINATIM_BASE_URL}/reverse?${params}`, {
    headers: {
      'Accept-Language': 'vi,en',
    },
  });

  if (!response.ok) {
    throw new Error(`Reverse geocoding fallback error: ${response.status}`);
  }

  const result = await response.json();
  return result.display_name || result.name || `${lat}, ${lon}`;
}

/**
 * Search for place names and get coordinates.
 * @param {string} query - Place name to search (e.g., "Bến Thành, TP.HCM")
 * @returns {Promise<Array>} Array of results with {name, lat, lon, type}
 */
export async function searchPlaces(query) {
  if (!query || query.trim().length < 1) {
    return [];
  }

  const normalizedQuery = query.trim();
  console.log('[searchPlaces] Starting search for:', normalizedQuery);

  try {
    console.log('[searchPlaces] Trying Google Maps API...');
    const results = await searchPlacesWithGoogleTextSearch(normalizedQuery);
    console.log('[searchPlaces] Google Maps API success, results:', results);
    return results;
  } catch (error) {
    console.warn('[searchPlaces] Google geocoding failed, falling back to Nominatim:', error);

    try {
      console.log('[searchPlaces] Trying Nominatim API...');
      const fallbackResults = await searchPlacesWithNominatim(normalizedQuery);
      console.log('[searchPlaces] Nominatim API success, results:', fallbackResults);
      return fallbackResults;
    } catch (fallbackError) {
      console.error('[searchPlaces] Both geocoding methods failed:', fallbackError);
      return [];
    }
  }
}

/**
 * Get place name from coordinates (reverse geocoding).
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<string>} Place name
 */
export async function getPlaceName(lat, lon) {
  try {
    const maps = await loadGoogleMapsApi();
    const geocoder = new maps.Geocoder();
    const payload = await new Promise((resolve) => {
      geocoder.geocode({ location: { lat, lng: lon } }, (results, status) => {
        resolve({ results: results || [], status });
      });
    });
    const result = payload.results?.[0];
    return result?.formatted_address || result?.address_components?.[0]?.long_name || `${lat}, ${lon}`;
  } catch (error) {
    console.warn('Google reverse geocoding failed, falling back to Nominatim:', error);

    try {
      return await reverseGeocodeWithNominatim(lat, lon);
    } catch (fallbackError) {
      console.error('Reverse geocoding fallback error:', fallbackError);
      return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    }
  }
}

/**
 * Extract coordinates from search result
 * @param {Object} searchResult - Result from searchPlaces
 * @returns {Object} {lat, lon} coordinates
 */
export function extractCoordinates(searchResult) {
  if (!searchResult) {
    return null;
  }
  return {
    lat: searchResult.lat,
    lon: searchResult.lon,
  };
}

/**
 * Common place names in Ho Chi Minh City for quick access
 */
export const POPULAR_PLACES_HCMC = [];
