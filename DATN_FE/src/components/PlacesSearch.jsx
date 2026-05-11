import { useCallback, useEffect, useRef, useState } from 'react';
import { searchPlaces } from '../utils/geocoding';
import './PlacesSearch.css';

/**
 * Component tìm kiếm địa điểm với autocomplete
 */
function PlacesSearch({
  id,
  placeholder = 'Nhập tên địa điểm',
  onPlaceSelected,
  onInputChange,
  disabled = false,
  value = '',
  showMapSelect = false,
  onMapSelectClick,
}) {
  const [searchInput, setSearchInput] = useState(value);
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const searchRequestIdRef = useRef(0);
  const userIsInputtingRef = useRef(false);

  // Sync parent value prop to local state, but only if user is not actively typing
  useEffect(() => {
    if (!userIsInputtingRef.current && value !== searchInput) {
      setSearchInput(value);
    }
  }, [value]);

  // Debounced search effect tied to the local query state
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmedQuery = searchInput.trim();
    if (disabled || trimmedQuery.length < 1) {
      setSuggestions([]);
      setIsSearching(false);
      return undefined;
    }

    console.log(`[PlacesSearch-${id}] Searching for: "${trimmedQuery}"`);
    setIsSearching(true);
    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        console.log(`[PlacesSearch-${id}] Calling searchPlaces API...`);
        const results = await searchPlaces(trimmedQuery);
        console.log(`[PlacesSearch-${id}] API Response:`, results);
        if (searchRequestIdRef.current === requestId) {
          setSuggestions(results);
          setShowSuggestions(true);
        }
      } catch (error) {
        console.error(`[PlacesSearch-${id}] Search failed:`, error);
        if (searchRequestIdRef.current === requestId) {
          setSuggestions([]);
        }
      } finally {
        if (searchRequestIdRef.current === requestId) {
          setIsSearching(false);
        }
      }
    }, 350);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [disabled, searchInput]);

  // Handle input change immediately; the effect below performs the debounced search
  const handleInputChange = useCallback((e) => {
    const nextValue = e.target.value;
    userIsInputtingRef.current = true;
    setSearchInput(nextValue);
    onInputChange?.(nextValue);
    setShowSuggestions(true);
  }, [onInputChange]);

  // Handle suggestion click
  const handleSuggestionClick = useCallback(
    (suggestion) => {
      userIsInputtingRef.current = false;
      setSearchInput(suggestion.name);
      onInputChange?.(suggestion.name);
      setShowSuggestions(false);
      onPlaceSelected?.(suggestion);
      setSuggestions([]);
    },
    [onInputChange, onPlaceSelected],
  );

  // Handle focus
  const handleFocus = useCallback(() => {
    if (searchInput.trim().length >= 1 && suggestions.length > 0) {
      setShowSuggestions(true);
    }
  }, [searchInput, suggestions]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target) && inputRef.current && !inputRef.current.contains(e.target)) {
        userIsInputtingRef.current = false;
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      searchRequestIdRef.current += 1;
    };
  }, []);

  return (
    <div className="places-search-container">
      <div className="places-search-input-wrapper">
        <input
          id={id}
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={searchInput}
          onChange={handleInputChange}
          onFocus={handleFocus}
          disabled={disabled}
          className="places-search-input"
          autoComplete="off"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && suggestions.length > 0) {
              e.preventDefault();
              handleSuggestionClick(suggestions[0]);
            }
          }}
        />
        {isSearching && <span className="places-search-loading">⌛</span>}
        {showMapSelect && (
          <button
            type="button"
            className="places-map-select-btn"
            onClick={onMapSelectClick}
            disabled={disabled}
            title="Chọn điểm từ bản đồ"
          >
            
          </button>
        )}
      </div>

      {showSuggestions && searchInput.trim().length >= 1 && suggestions.length > 0 && (
        <div ref={suggestionsRef} className="places-suggestions-dropdown">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              className="places-suggestion-item"
              onClick={() => handleSuggestionClick(suggestion)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSuggestionClick(suggestion);
                }
              }}
            >
              <div className="places-suggestion-name">{suggestion.name}</div>
              {suggestion.address && (
                <div className="places-suggestion-address">
                  {suggestion.address.city || suggestion.address.province || suggestion.address.country}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default PlacesSearch;
