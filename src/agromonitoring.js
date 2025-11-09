// src/api/agroMonitoring.js

const API_KEY = import.meta.env.VITE_AGROMONITORING_API_KEY;
const API_BASE_URL = "https://api.agromonitoring.com/agro/1.0";
// Function to format our coordinates into GeoJSON
const formatCoordsToGeoJSON = (coords) => {
  // AgroMonitoring needs [longitude, latitude]
  const geoJsonCoords = coords.map((p) => [p.lng, p.lat]);

  // Ensure the polygon is "closed" (first and last points are the same)
  if (
    geoJsonCoords.length > 0 &&
    (geoJsonCoords[0][0] !== geoJsonCoords[geoJsonCoords.length - 1][0] ||
      geoJsonCoords[0][1] !== geoJsonCoords[geoJsonCoords.length - 1][1])
  ) {
    geoJsonCoords.push(geoJsonCoords[0]);
  }

  // The Fix: Wrap the Polygon geometry inside a standard Feature object
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [geoJsonCoords],
    },
  };
};

export const registerPolygonWithAgro = async (farmName, coordinates) => {
  const apiKey = import.meta.env.VITE_AGROMONITORING_API_KEY;
  if (!apiKey) {
    throw new Error("AgroMonitoring API key is not configured.");
  }

  const API_URL = `https://api.agromonitoring.com/agro/1.0/polygons?appid=${apiKey}`;

  const geoJson = formatCoordsToGeoJSON(coordinates);

  const requestBody = {
    name: farmName,
    geo_json: geoJson,
  };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      errorData.message || "Failed to register polygon with AgroMonitoring."
    );
  }

  const data = await response.json();
  return data.id; // Return the unique Polygon ID
};

export const getWeatherForPolygon = async (polyId) => {
  if (!polyId) throw new Error("Polygon ID is required.");
  const response = await fetch(
    `${API_BASE_URL}/weather/forecast?polyid=${polyId}&appid=${API_KEY}`
  );
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Weather API Error:", response.status, errorText);
    throw new Error(`Failed to fetch weather data: ${response.status}`);
  }
  const data = await response.json();
  console.log("Weather API Response:", data);
  // The forecast API returns { list: [...] }, we need to return the list
  return data.list || data;
};

/**
 * Fetches current soil temperature and moisture for a polygon.
 */
export const getSoilDataForPolygon = async (polyId) => {
  if (!polyId) throw new Error("Polygon ID is required.");
  const response = await fetch(
    `${API_BASE_URL}/soil?polyid=${polyId}&appid=${API_KEY}`
  );
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Soil API Error:", response.status, errorText);
    throw new Error(`Failed to fetch soil data: ${response.status}`);
  }
  const data = await response.json();
  console.log("Soil API Response:", data);
  return data;
};

/**
 * Fetches historical NDVI data for a polygon.
 */
export const getNdviHistoryForPolygon = async (polyId) => {
  if (!polyId) throw new Error("Polygon ID is required.");
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 30;
  const now = Math.floor(Date.now() / 1000);
  const response = await fetch(
    `${API_BASE_URL}/ndvi/history?polyid=${polyId}&start=${thirtyDaysAgo}&end=${now}&appid=${API_KEY}`
  );
  if (!response.ok) {
    const errorText = await response.text();
    console.error("NDVI API Error:", response.status, errorText);
    throw new Error(`Failed to fetch NDVI history: ${response.status}`);
  }
  const data = await response.json();
  console.log("NDVI API Response:", data);
  return data;
};

/**
 * Searches for available satellite imagery for a polygon.
 * Returns metadata including URLs for different image types.
 */
export const searchSatelliteImages = async (polyId) => {
  if (!polyId) throw new Error("Polygon ID is required.");
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 30;
  const now = Math.floor(Date.now() / 1000);
  const response = await fetch(
    `${API_BASE_URL}/image/search?start=${thirtyDaysAgo}&end=${now}&polyid=${polyId}&appid=${API_KEY}`
  );
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Satellite Image API Error:", response.status, errorText);
    throw new Error(`Failed to search for satellite images: ${response.status}`);
  }
  const images = await response.json();
  console.log("Satellite Images API Response:", images);
  // Return the most recent available image metadata, if any
  return images.length > 0 ? images[0] : null;
};
