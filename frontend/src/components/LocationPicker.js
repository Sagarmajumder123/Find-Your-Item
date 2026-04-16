import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix default marker icon issue with webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Component to handle map clicks
const MapClickHandler = ({ onLocationSelect }) => {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

// Component to fly to a location
const FlyToLocation = ({ lat, lng }) => {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.flyTo([lat, lng], 15, { duration: 1.5 });
    }
  }, [lat, lng, map]);
  return null;
};

const LocationPicker = ({
  onLocationSelect,
  initialLat = null,
  initialLng = null,
  label = 'Location',
  required = false,
}) => {
  const [position, setPosition] = useState(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );
  const [address, setAddress] = useState('');
  const [locationName, setLocationName] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState('');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const geocodeTimerRef = useRef(null);
  const searchTimerRef = useRef(null);
  const searchWrapperRef = useRef(null);

  // Default center: India
  const defaultCenter = [20.5937, 78.9629];
  const defaultZoom = 5;

  // Close search results on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ===== FORWARD GEOCODING (Search location) =====
  const searchLocation = useCallback((query) => {
    if (!query || query.length < 3) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    // Debounce: 600ms to respect Nominatim rate limits
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await response.json();
        setSearchResults(data || []);
        setShowResults(true);
      } catch (err) {
        console.error('Location search failed:', err);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 600);
  }, []);

  const handleSearchInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    searchLocation(value);
  };

  const handleSearchResultClick = (result) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setPosition({ lat, lng });
    setAddress(result.display_name);
    const parts = result.display_name.split(',');
    const shortName = parts.slice(0, 3).join(',').trim();
    setLocationName(shortName);
    setSearchQuery(result.display_name);
    setShowResults(false);
    setError('');

    if (onLocationSelect) {
      onLocationSelect(lat, lng, shortName);
    }
  };

  // ===== REVERSE GEOCODING (click → address) =====
  const reverseGeocode = useCallback((lat, lng) => {
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);

    geocodeTimerRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await response.json();
        if (data && data.display_name) {
          setAddress(data.display_name);
          const parts = data.display_name.split(',');
          const shortName = parts.slice(0, 3).join(',').trim();
          setLocationName(shortName);
          setSearchQuery(data.display_name);
        }
      } catch (err) {
        console.error('Reverse geocode failed:', err);
        setAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        setLocationName(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      }
    }, 800);
  }, []);

  // Handle location selection from map click
  const handleLocationSelect = useCallback((lat, lng) => {
    setPosition({ lat, lng });
    setError('');
    reverseGeocode(lat, lng);
    if (onLocationSelect) {
      onLocationSelect(lat, lng, locationName);
    }
  }, [onLocationSelect, reverseGeocode, locationName]);

  // Update parent when locationName changes
  useEffect(() => {
    if (position && onLocationSelect) {
      onLocationSelect(position.lat, position.lng, locationName);
    }
  }, [locationName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-detect location
  const detectLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setDetecting(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setPosition({ lat: latitude, lng: longitude });
        reverseGeocode(latitude, longitude);
        if (onLocationSelect) {
          onLocationSelect(latitude, longitude, locationName);
        }
        setDetecting(false);
      },
      (err) => {
        setError('Unable to detect location. Please search or click on the map.');
        setDetecting(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Handle manual location name change
  const handleLocationNameChange = (e) => {
    setLocationName(e.target.value);
  };

  return (
    <div className="location-picker-wrapper">
      <label className="location-picker-label">
        {label} {required && <span className="required-star">*</span>}
      </label>

      {/* Search Bar */}
      <div className="location-search-wrapper" ref={searchWrapperRef}>
        <div className="location-search-input-wrapper">
          <span className="location-search-icon">🔍</span>
          <input
            type="text"
            className="location-search-input"
            placeholder="Search for a place, address, city..."
            value={searchQuery}
            onChange={handleSearchInputChange}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
          />
          {searchLoading && (
            <span className="location-search-spinner">
              <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></span>
            </span>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showResults && searchResults.length > 0 && (
          <div className="location-search-results">
            {searchResults.map((result, index) => (
              <div
                key={index}
                className="location-search-result-item"
                onClick={() => handleSearchResultClick(result)}
              >
                <span className="result-icon">📍</span>
                <div className="result-info">
                  <div className="result-name">
                    {result.display_name.split(',').slice(0, 2).join(',')}
                  </div>
                  <div className="result-full">
                    {result.display_name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showResults && searchResults.length === 0 && searchQuery.length >= 3 && !searchLoading && (
          <div className="location-search-results">
            <div className="location-search-no-results">
              No places found for "{searchQuery}"
            </div>
          </div>
        )}
      </div>

      {/* Detect Location Button */}
      <div className="location-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm detect-btn"
          onClick={detectLocation}
          disabled={detecting}
        >
          {detecting ? (
            <>
              <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></span>
              Detecting...
            </>
          ) : (
            '📍 Detect My Location'
          )}
        </button>
        <span className="location-help-text">or click on the map to select</span>
      </div>

      {error && <div className="location-error">{error}</div>}

      {/* Map */}
      <div className="map-container">
        <MapContainer
          center={position ? [position.lat, position.lng] : defaultCenter}
          zoom={position ? 15 : defaultZoom}
          style={{ height: '300px', width: '100%', borderRadius: '12px' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onLocationSelect={handleLocationSelect} />
          {position && (
            <>
              <Marker position={[position.lat, position.lng]} />
              <FlyToLocation lat={position.lat} lng={position.lng} />
            </>
          )}
        </MapContainer>
      </div>

      {/* Location Name Input */}
      {position && (
        <div className="location-details">
          <div className="location-coords">
            <span>📍 {position.lat.toFixed(4)}, {position.lng.toFixed(4)}</span>
          </div>
          <input
            type="text"
            placeholder="Location name (e.g., Central Park, NYC)"
            value={locationName}
            onChange={handleLocationNameChange}
            className="location-name-input"
          />
          {address && (
            <p className="location-address">{address}</p>
          )}
        </div>
      )}

      {required && !position && (
        <p className="category-hint">Please select a location on the map</p>
      )}
    </div>
  );
};

export default LocationPicker;
