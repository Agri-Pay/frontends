/**
 * Geometry conversion utilities for AgriPay
 * Handles conversion between Leaflet LatLng format and GeoJSON format
 * 
 * Leaflet format: [{lat: 30.123, lng: 72.456}, ...]
 * GeoJSON format: {"type": "Polygon", "coordinates": [[[lng, lat], ...]]}
 */

/**
 * Convert Leaflet LatLng array to GeoJSON Polygon geometry
 * Used when creating farms via the RPC function
 * 
 * @param {Array<{lat: number, lng: number}>} leafletCoords - Array of Leaflet LatLng objects
 * @returns {Object} GeoJSON Polygon geometry object
 * @throws {Error} If coordinates are invalid
 */
export const leafletToGeoJSON = (leafletCoords) => {
  if (!leafletCoords || leafletCoords.length < 3) {
    throw new Error('A polygon requires at least 3 points');
  }

  // Convert from {lat, lng} to [lng, lat] (GeoJSON is lng,lat order!)
  const coords = leafletCoords.map(p => [p.lng, p.lat]);
  
  // Ensure polygon is closed (first point = last point)
  const firstPoint = coords[0];
  const lastPoint = coords[coords.length - 1];
  if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
    coords.push([...firstPoint]);
  }

  return {
    type: "Polygon",
    coordinates: [coords]
  };
};

/**
 * Convert GeoJSON Polygon geometry to Leaflet LatLng array
 * Used when displaying farms on Leaflet maps or calling AgroMonitoring API
 * 
 * @param {Object} geoJsonPolygon - GeoJSON Polygon geometry object
 * @returns {Array<{lat: number, lng: number}>} Array of Leaflet LatLng objects
 */
export const geoJSONToLeaflet = (geoJsonPolygon) => {
  if (!geoJsonPolygon || !geoJsonPolygon.coordinates) {
    return [];
  }
  
  // Handle both Polygon and MultiPolygon (take first ring of first polygon)
  let coords;
  if (geoJsonPolygon.type === 'MultiPolygon') {
    coords = geoJsonPolygon.coordinates[0][0];
  } else {
    coords = geoJsonPolygon.coordinates[0];
  }
  
  // Convert from [lng, lat] to {lat, lng}
  return coords.map(([lng, lat]) => ({ lat, lng }));
};

/**
 * Calculate the center point of a GeoJSON Polygon
 * Simple centroid calculation (average of all points)
 * 
 * @param {Object} geoJsonPolygon - GeoJSON Polygon geometry object
 * @returns {{lat: number, lng: number}} Center point as Leaflet LatLng
 */
export const getPolygonCenter = (geoJsonPolygon) => {
  if (!geoJsonPolygon || !geoJsonPolygon.coordinates) {
    return { lat: 0, lng: 0 };
  }
  
  const coords = geoJsonPolygon.coordinates[0];
  const lngs = coords.map(c => c[0]);
  const lats = coords.map(c => c[1]);
  
  return {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2
  };
};

/**
 * Validate if a polygon has the minimum required points
 * @param {Array} coords - Array of coordinates (either Leaflet or GeoJSON format)
 * @returns {boolean} True if valid
 */
export const isValidPolygon = (coords) => {
  if (!coords || !Array.isArray(coords)) return false;
  return coords.length >= 3;
};

/**
 * Convert a GeoJSON geometry to Mapbox Static Image URL format
 * Used for generating farm thumbnail images
 * 
 * @param {Object} geoJsonGeometry - GeoJSON Polygon geometry
 * @param {string} accessToken - Mapbox access token
 * @param {Object} options - Optional parameters (width, height, padding, style)
 * @returns {string} Mapbox Static Image URL
 */
export const getMapboxStaticImageUrl = (geoJsonGeometry, accessToken, options = {}) => {
  const {
    width = 350,
    height = 150,
    padding = 20,
    style = 'satellite-v9'
  } = options;

  if (!geoJsonGeometry || !accessToken) {
    return `https://via.placeholder.com/${width}x${height}?text=Map+Unavailable`;
  }

  try {
    const encodedGeoJson = encodeURIComponent(JSON.stringify(geoJsonGeometry));
    return `https://api.mapbox.com/styles/v1/mapbox/${style}/static/geojson(${encodedGeoJson})/auto/${width}x${height}?padding=${padding}&access_token=${accessToken}`;
  } catch (e) {
    console.error('Error generating Mapbox URL:', e);
    return `https://via.placeholder.com/${width}x${height}?text=Map+Error`;
  }
};

/**
 * Extract polygon geometry from a KML-parsed GeoJSON FeatureCollection
 * The @tmcw/togeojson library returns a FeatureCollection
 * 
 * @param {Object} geoJsonFeatureCollection - GeoJSON FeatureCollection from KML parsing
 * @returns {Object|null} First Polygon geometry found, or null
 */
export const extractPolygonFromFeatureCollection = (geoJsonFeatureCollection) => {
  if (!geoJsonFeatureCollection || !geoJsonFeatureCollection.features) {
    return null;
  }

  // Find the first feature with a Polygon or MultiPolygon geometry
  const polygonFeature = geoJsonFeatureCollection.features.find(
    f => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
  );

  return polygonFeature ? polygonFeature.geometry : null;
};

// ============================================
// ALIASES for backward compatibility
// These provide alternate names used in various components
// ============================================

/**
 * Convert GeoJSON to Mapbox Static Image URL
 * Alias for getMapboxStaticImageUrl
 */
export const geoJSONToMapboxURL = (geoJsonGeometry, accessToken, options = {}) => {
  return getMapboxStaticImageUrl(geoJsonGeometry, accessToken, options);
};

/**
 * Convert Leaflet coordinates to Mapbox Static Image URL
 * Combines leafletToGeoJSON and getMapboxStaticImageUrl
 * 
 * @param {Array<{lat: number, lng: number}>} leafletCoords - Array of Leaflet LatLng objects
 * @param {string} accessToken - Mapbox access token
 * @param {Object} options - Optional parameters
 * @returns {string} Mapbox Static Image URL
 */
export const leafletToMapboxURL = (leafletCoords, accessToken, options = {}) => {
  try {
    const geoJson = leafletToGeoJSON(leafletCoords);
    return getMapboxStaticImageUrl(geoJson, accessToken, options);
  } catch (e) {
    console.error('Error converting Leaflet to Mapbox URL:', e);
    const { width = 350, height = 150 } = options;
    return `https://via.placeholder.com/${width}x${height}?text=Map+Error`;
  }
};
