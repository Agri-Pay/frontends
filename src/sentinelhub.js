// src/api/sentinelHub.js
// Sentinel Hub API integration for satellite imagery and vegetation indices

import { supabase } from "./createclient";

const SENTINEL_API_BASE = "https://services.sentinel-hub.com";

/**
 * Get OAuth2 access token from Sentinel Hub via Supabase Edge Function
 * Tokens are cached in Supabase to avoid hitting rate limits
 */
const getAccessToken = async () => {
  // Try to get cached token from Supabase
  const { data: tokenData, error } = await supabase
    .from("sentinel_tokens")
    .select("*")
    .single();

  // Check if token exists and is still valid (with 5 min buffer)
  if (
    tokenData &&
    new Date(tokenData.expires_at) > new Date(Date.now() + 5 * 60 * 1000)
  ) {
    return tokenData.access_token;
  }

  // Token expired or doesn't exist - get new one via Edge Function
  const { data, error: fnError } = await supabase.functions.invoke(
    "sentinel-auth",
    {
      body: {},
    }
  );

  if (fnError) {
    console.error("Error getting Sentinel token:", fnError);
    throw new Error("Failed to authenticate with Sentinel Hub");
  }

  return data.access_token;
};

/**
 * Format coordinates to WKT (Well-Known Text) format for Sentinel API
 */
const coordsToWKT = (coords) => {
  // coords is array of {lat, lng} objects
  const wktCoords = coords.map((p) => `${p.lng} ${p.lat}`).join(", ");
  // Close the polygon
  const firstPoint = coords[0];
  return `POLYGON((${wktCoords}, ${firstPoint.lng} ${firstPoint.lat}))`;
};

/**
 * Format coordinates to bounding box [minLng, minLat, maxLng, maxLat]
 */
const coordsToBBox = (coords) => {
  const lngs = coords.map((p) => p.lng);
  const lats = coords.map((p) => p.lat);
  return [
    Math.min(...lngs),
    Math.min(...lats),
    Math.max(...lngs),
    Math.max(...lats),
  ];
};

/**
 * Format coordinates to GeoJSON Polygon
 */
const coordsToGeoJSON = (coords) => {
  const geoCoords = coords.map((p) => [p.lng, p.lat]);
  // Close the polygon
  geoCoords.push([coords[0].lng, coords[0].lat]);
  return {
    type: "Polygon",
    coordinates: [geoCoords],
  };
};


/**
 * Get available imagery dates with cloud cover for a farm polygon
 * Returns dates sorted by most recent first, with quality indicators
 * @param {Array} coords - Array of {lat, lng} coordinates
 * @param {number} days - Number of days to look back (default 180 = 6 months)
 * @returns {Promise<{dates: Array<{date: string, cloudCover: number, quality: string}>}>}
 */
export const getAvailableDates = async (coords, days = 180) => {
  const token = await getAccessToken();
  const bbox = coordsToBBox(coords);

  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const searchBody = {
    bbox: bbox,
    datetime: `${startDate}T00:00:00Z/${endDate}T23:59:59Z`,
    collections: ["sentinel-2-l2a"],
    limit: 100, // Get up to 100 scenes
    fields: {
      include: ["properties.datetime", "properties.eo:cloud_cover"],
    },
  };

  const response = await fetch(
    `${SENTINEL_API_BASE}/api/v1/catalog/1.0.0/search`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(searchBody),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Sentinel Dates Search Error:", response.status, errorText);
    throw new Error(`Failed to get available dates: ${response.status}`);
  }

  const data = await response.json();

  // Parse features into dates array
  const datesMap = new Map(); // Use map to deduplicate by date

  (data.features || []).forEach((feature) => {
    const datetime = feature.properties?.datetime;
    const cloudCover = feature.properties?.["eo:cloud_cover"] ?? 100;

    if (datetime) {
      const dateStr = datetime.split("T")[0]; // Extract YYYY-MM-DD

      // Keep the lowest cloud cover for each date
      const existing = datesMap.get(dateStr);
      if (!existing || cloudCover < existing.cloudCover) {
        datesMap.set(dateStr, {
          date: dateStr,
          cloudCover: Math.round(cloudCover * 10) / 10, // Round to 1 decimal
          quality: getCloudQuality(cloudCover),
        });
      }
    }
  });

  // Convert to array and sort by date (most recent first)
  const dates = Array.from(datesMap.values()).sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  console.log("Sentinel Available Dates:", dates);
  return { dates };
};

/**
 * Get cloud cover quality rating
 * @param {number} cloudCover - Cloud cover percentage
 * @returns {string} Quality rating: 'excellent' | 'good' | 'moderate' | 'poor'
 */
const getCloudQuality = (cloudCover) => {
  if (cloudCover <= 15) return "excellent";
  if (cloudCover <= 30) return "good";
  if (cloudCover <= 50) return "moderate";
  return "poor";
};

/**
 * Build time range for Process API
 * @param {string|null} date - Specific date (YYYY-MM-DD) or null for most recent
 * @param {number} fallbackDays - Days to look back if no date specified
 * @returns {{from: string, to: string}}
 */
const buildTimeRange = (date, fallbackDays = 30) => {
  if (date) {
    // Use specific date: entire day
    return {
      from: `${date}T00:00:00Z`,
      to: `${date}T23:59:59Z`,
    };
  }
  // Fallback: last N days
  return {
    from: new Date(Date.now() - fallbackDays * 24 * 60 * 60 * 1000).toISOString(),
    to: new Date().toISOString(),
  };
};

/**
 * Search for available Sentinel-2 scenes for a given area
 */
export const searchSentinelScenes = async (coords, days = 30) => {
  const token = await getAccessToken();
  const bbox = coordsToBBox(coords);

  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const searchBody = {
    bbox: bbox,
    datetime: `${startDate}T00:00:00Z/${endDate}T23:59:59Z`,
    collections: ["sentinel-2-l2a"],
    limit: 10,
    filter: {
      op: "<=",
      args: [{ property: "eo:cloud_cover" }, 30], // Max 30% cloud cover
    },
  };

  const response = await fetch(
    `${SENTINEL_API_BASE}/api/v1/catalog/1.0.0/search`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(searchBody),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Sentinel Search Error:", response.status, errorText);
    throw new Error(`Failed to search Sentinel scenes: ${response.status}`);
  }

  const data = await response.json();
  console.log("Sentinel Scenes:", data);
  return data.features || [];
};

/**
 * Get NDVI image from Sentinel-2
 * @param {Array} coords - Array of {lat, lng} coordinates
 * @param {number} width - Image width in pixels
 * @param {number} height - Image height in pixels
 * @param {string|null} date - Optional specific date (YYYY-MM-DD)
 */
export const getSentinelNDVI = async (coords, width = 512, height = 512, date = null) => {
  const token = await getAccessToken();
  const bbox = coordsToBBox(coords);
  const timeRange = buildTimeRange(date, 30);
  // If user specified a date, accept any cloud cover; otherwise limit to 30%
  const maxCloudCoverage = date ? 100 : 30;

  const evalscript = `
    //VERSION=3
    function setup() {
      return {
        input: ["B04", "B08", "dataMask"],
        output: { bands: 4 }
      };
    }

    function evaluatePixel(sample) {
      let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
      
      // Color mapping for NDVI
      if (ndvi < -0.2) return [0.05, 0.05, 0.05, sample.dataMask]; // Water/shadows
      if (ndvi < 0) return [0.75, 0.75, 0.75, sample.dataMask];    // Bare soil
      if (ndvi < 0.1) return [0.86, 0.78, 0.55, sample.dataMask];  // Sparse vegetation
      if (ndvi < 0.2) return [0.93, 0.91, 0.71, sample.dataMask];  // Light vegetation
      if (ndvi < 0.3) return [0.78, 0.89, 0.55, sample.dataMask];  // Moderate vegetation
      if (ndvi < 0.4) return [0.55, 0.80, 0.38, sample.dataMask];  // Good vegetation
      if (ndvi < 0.5) return [0.30, 0.70, 0.24, sample.dataMask];  // Dense vegetation
      if (ndvi < 0.6) return [0.16, 0.58, 0.14, sample.dataMask];  // Very dense
      return [0.04, 0.45, 0.04, sample.dataMask];                   // Extremely dense
    }
  `;

  const requestBody = {
    input: {
      bounds: {
        bbox: bbox,
        properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
      },
      data: [
        {
          type: "sentinel-2-l2a",
          dataFilter: {
            timeRange: timeRange,
            maxCloudCoverage: maxCloudCoverage,
          },
          processing: { harmonizeValues: true },
        },
      ],
    },
    output: {
      width: width,
      height: height,
      responses: [{ identifier: "default", format: { type: "image/png" } }],
    },
    evalscript: evalscript,
  };

  const response = await fetch(`${SENTINEL_API_BASE}/api/v1/process`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "image/png",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Sentinel NDVI Error:", response.status, errorText);
    throw new Error(`Failed to get NDVI image: ${response.status}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

/**
 * Get True Color (RGB) image from Sentinel-2
 * @param {Array} coords - Array of {lat, lng} coordinates
 * @param {number} width - Image width in pixels
 * @param {number} height - Image height in pixels
 * @param {string|null} date - Optional specific date (YYYY-MM-DD)
 */
export const getSentinelTrueColor = async (
  coords,
  width = 512,
  height = 512,
  date = null
) => {
  const token = await getAccessToken();
  const bbox = coordsToBBox(coords);
  const timeRange = buildTimeRange(date, 30);
  const maxCloudCoverage = date ? 100 : 30;

  const evalscript = `
    //VERSION=3
    function setup() {
      return {
        input: ["B04", "B03", "B02", "dataMask"],
        output: { bands: 4 }
      };
    }

    function evaluatePixel(sample) {
      return [2.5 * sample.B04, 2.5 * sample.B03, 2.5 * sample.B02, sample.dataMask];
    }
  `;

  const requestBody = {
    input: {
      bounds: {
        bbox: bbox,
        properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
      },
      data: [
        {
          type: "sentinel-2-l2a",
          dataFilter: {
            timeRange: timeRange,
            maxCloudCoverage: maxCloudCoverage,
          },
        },
      ],
    },
    output: {
      width: width,
      height: height,
      responses: [{ identifier: "default", format: { type: "image/png" } }],
    },
    evalscript: evalscript,
  };

  const response = await fetch(`${SENTINEL_API_BASE}/api/v1/process`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "image/png",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Sentinel True Color Error:", response.status, errorText);
    throw new Error(`Failed to get true color image: ${response.status}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

/**
 * Get SAVI (Soil Adjusted Vegetation Index) - better for sparse vegetation
 * @param {Array} coords - Array of {lat, lng} coordinates
 * @param {number} width - Image width in pixels
 * @param {number} height - Image height in pixels
 * @param {string|null} date - Optional specific date (YYYY-MM-DD)
 */
export const getSentinelSAVI = async (coords, width = 512, height = 512, date = null) => {
  const token = await getAccessToken();
  const bbox = coordsToBBox(coords);
  const timeRange = buildTimeRange(date, 30);
  const maxCloudCoverage = date ? 100 : 30;

  const evalscript = `
    //VERSION=3
    function setup() {
      return {
        input: ["B04", "B08", "dataMask"],
        output: { bands: 4 }
      };
    }

    function evaluatePixel(sample) {
      // SAVI = ((NIR - RED) / (NIR + RED + L)) * (1 + L), where L = 0.5
      let L = 0.5;
      let savi = ((sample.B08 - sample.B04) / (sample.B08 + sample.B04 + L)) * (1 + L);
      
      // Color mapping
      if (savi < 0) return [0.5, 0.5, 0.5, sample.dataMask];
      if (savi < 0.1) return [0.86, 0.78, 0.55, sample.dataMask];
      if (savi < 0.2) return [0.78, 0.89, 0.55, sample.dataMask];
      if (savi < 0.3) return [0.55, 0.80, 0.38, sample.dataMask];
      if (savi < 0.4) return [0.30, 0.70, 0.24, sample.dataMask];
      return [0.04, 0.50, 0.04, sample.dataMask];
    }
  `;

  const requestBody = {
    input: {
      bounds: {
        bbox: bbox,
        properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
      },
      data: [
        {
          type: "sentinel-2-l2a",
          dataFilter: {
            timeRange: timeRange,
            maxCloudCoverage: maxCloudCoverage,
          },
        },
      ],
    },
    output: {
      width: width,
      height: height,
      responses: [{ identifier: "default", format: { type: "image/png" } }],
    },
    evalscript: evalscript,
  };

  const response = await fetch(`${SENTINEL_API_BASE}/api/v1/process`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "image/png",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Sentinel SAVI Error:", response.status, errorText);
    throw new Error(`Failed to get SAVI image: ${response.status}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

/**
 * Get Moisture Index (NDWI/NDMI) - for water stress detection
 * @param {Array} coords - Array of {lat, lng} coordinates
 * @param {number} width - Image width in pixels
 * @param {number} height - Image height in pixels
 * @param {string|null} date - Optional specific date (YYYY-MM-DD)
 */
export const getSentinelMoisture = async (
  coords,
  width = 512,
  height = 512,
  date = null
) => {
  const token = await getAccessToken();
  const bbox = coordsToBBox(coords);
  const timeRange = buildTimeRange(date, 30);
  const maxCloudCoverage = date ? 100 : 30;

  const evalscript = `
    //VERSION=3
    function setup() {
      return {
        input: ["B08", "B11", "dataMask"],
        output: { bands: 4 }
      };
    }

    function evaluatePixel(sample) {
      // NDMI = (NIR - SWIR) / (NIR + SWIR)
      let ndmi = (sample.B08 - sample.B11) / (sample.B08 + sample.B11);
      
      // Color mapping - blue for wet, red for dry
      if (ndmi < -0.4) return [0.8, 0.2, 0.1, sample.dataMask];  // Very dry
      if (ndmi < -0.2) return [0.9, 0.5, 0.2, sample.dataMask];  // Dry
      if (ndmi < 0) return [0.95, 0.8, 0.4, sample.dataMask];    // Moderate dry
      if (ndmi < 0.2) return [0.8, 0.9, 0.6, sample.dataMask];   // Moderate wet
      if (ndmi < 0.4) return [0.4, 0.7, 0.9, sample.dataMask];   // Wet
      return [0.1, 0.4, 0.8, sample.dataMask];                    // Very wet
    }
  `;

  const requestBody = {
    input: {
      bounds: {
        bbox: bbox,
        properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
      },
      data: [
        {
          type: "sentinel-2-l2a",
          dataFilter: {
            timeRange: timeRange,
            maxCloudCoverage: maxCloudCoverage,
          },
        },
      ],
    },
    output: {
      width: width,
      height: height,
      responses: [{ identifier: "default", format: { type: "image/png" } }],
    },
    evalscript: evalscript,
  };

  const response = await fetch(`${SENTINEL_API_BASE}/api/v1/process`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "image/png",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Sentinel Moisture Error:", response.status, errorText);
    throw new Error(`Failed to get moisture image: ${response.status}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

/**
 * Get LAI (Leaf Area Index) - crop growth indicator
 * @param {Array} coords - Array of {lat, lng} coordinates
 * @param {number} width - Image width in pixels
 * @param {number} height - Image height in pixels
 * @param {string|null} date - Optional specific date (YYYY-MM-DD)
 */
export const getSentinelLAI = async (coords, width = 512, height = 512, date = null) => {
  const token = await getAccessToken();
  const bbox = coordsToBBox(coords);
  const timeRange = buildTimeRange(date, 30);
  const maxCloudCoverage = date ? 100 : 30;

  const evalscript = `
    //VERSION=3
    function setup() {
      return {
        input: ["B03", "B04", "B05", "B06", "B07", "B8A", "B11", "B12", "dataMask"],
        output: { bands: 4 }
      };
    }

    function evaluatePixel(sample) {
      // Simplified LAI estimation using NDVI relationship
      let ndvi = (sample.B8A - sample.B04) / (sample.B8A + sample.B04);
      let lai = 0;
      
      if (ndvi > 0) {
        lai = -Math.log((0.69 - ndvi) / 0.59) / 2.13;
        if (lai < 0) lai = 0;
        if (lai > 6) lai = 6;
      }
      
      // Normalize LAI to 0-1 range and apply color
      let norm = lai / 6;
      return [1 - norm, norm, 0.2, sample.dataMask];
    }
  `;

  const requestBody = {
    input: {
      bounds: {
        bbox: bbox,
        properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
      },
      data: [
        {
          type: "sentinel-2-l2a",
          dataFilter: {
            timeRange: timeRange,
            maxCloudCoverage: maxCloudCoverage,
          },
        },
      ],
    },
    output: {
      width: width,
      height: height,
      responses: [{ identifier: "default", format: { type: "image/png" } }],
    },
    evalscript: evalscript,
  };

  const response = await fetch(`${SENTINEL_API_BASE}/api/v1/process`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "image/png",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Sentinel LAI Error:", response.status, errorText);
    throw new Error(`Failed to get LAI image: ${response.status}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

/**
 * Get vegetation index values at a specific point (for click-to-value feature)
 * Uses the Statistical API to get mean values for a small bbox around the point
 * @param {number} lat - Latitude of the clicked point
 * @param {number} lng - Longitude of the clicked point
 * @param {string|null} date - Optional specific date (YYYY-MM-DD)
 * @returns {Promise<{ndvi: number, savi: number, moisture: number, health: string}>}
 */
export const getPointStats = async (lat, lng, date = null) => {
  const token = await getAccessToken();
  const timeRange = buildTimeRange(date, 30);

  // Create a small bbox around the point (~22m buffer at equator)
  // Sentinel-2 has 10m resolution, so this covers a few pixels for averaging
  const buffer = 0.0002;
  const bbox = [lng - buffer, lat - buffer, lng + buffer, lat + buffer];

  // Evalscript for Statistical API - must have separate outputs with IDs
  // and a dataMask output to exclude invalid pixels
  const evalscript = `
//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "B11", "dataMask"] }],
    output: [
      { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
      { id: "savi", bands: 1, sampleType: "FLOAT32" },
      { id: "moisture", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}

function evaluatePixel(samples) {
  // NDVI = (NIR - Red) / (NIR + Red)
  let ndvi = (samples.B08 - samples.B04) / (samples.B08 + samples.B04 + 0.0001);
  
  // SAVI = ((NIR - Red) / (NIR + Red + L)) * (1 + L), L = 0.5
  let L = 0.5;
  let savi = ((samples.B08 - samples.B04) / (samples.B08 + samples.B04 + L)) * (1 + L);
  
  // NDMI (Moisture) = (NIR - SWIR) / (NIR + SWIR)
  let moisture = (samples.B08 - samples.B11) / (samples.B08 + samples.B11 + 0.0001);
  
  return {
    ndvi: [ndvi],
    savi: [savi],
    moisture: [moisture],
    dataMask: [samples.dataMask]
  };
}
`;

  // Statistical API request body - different structure from Process API
  const requestBody = {
    input: {
      bounds: {
        bbox: bbox,
        properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
      },
      data: [
        {
          type: "sentinel-2-l2a",
          dataFilter: {
            mosaickingOrder: "leastRecent",
          },
        },
      ],
    },
    aggregation: {
      timeRange: timeRange,
      aggregationInterval: { of: "P1D" },
      evalscript: evalscript,
      resx: 10,
      resy: 10,
    },
  };

  try {
    // Use Statistical API endpoint, NOT Process API
    const response = await fetch(`${SENTINEL_API_BASE}/api/v1/statistics`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Sentinel Point Stats Error:", response.status, errorText);
      throw new Error(`Failed to get point stats: ${response.status}`);
    }

    const data = await response.json();
    console.log("Sentinel Point Stats Raw:", data);

    // Parse Statistical API response format:
    // { data: [{ interval: {...}, outputs: { ndvi: { bands: { B0: { stats: { mean: ... } } } } } }] }
    if (data.data && data.data.length > 0) {
      // Get the most recent interval
      const latest = data.data[data.data.length - 1];

      // Extract mean values from each output
      const ndvi = latest.outputs?.ndvi?.bands?.B0?.stats?.mean ?? null;
      const savi = latest.outputs?.savi?.bands?.B0?.stats?.mean ?? null;
      const moisture = latest.outputs?.moisture?.bands?.B0?.stats?.mean ?? null;

      // Check if we have valid data
      if (ndvi !== null) {
        return {
          lat: lat,
          lng: lng,
          ndvi: Math.round(ndvi * 1000) / 1000,
          savi: savi !== null ? Math.round(savi * 1000) / 1000 : null,
          moisture: moisture !== null ? Math.round(moisture * 1000) / 1000 : null,
          health: getNdviHealthStatus(ndvi),
        };
      }
    }

    console.warn("No valid data in point stats response:", data);
    return { lat, lng, ndvi: null, savi: null, moisture: null, health: "No Data" };
  } catch (error) {
    console.error("Error getting point stats:", error);
    return { lat, lng, ndvi: null, savi: null, moisture: null, health: "Error" };
  }
};

/**
 * Get health status label from NDVI value
 * @param {number|null} ndvi - NDVI value
 * @returns {string} Health status label
 */
const getNdviHealthStatus = (ndvi) => {
  if (ndvi === null || ndvi === undefined) return "Unknown";
  if (ndvi < -0.1) return "Water/Shadow";
  if (ndvi < 0.1) return "Bare Soil";
  if (ndvi < 0.2) return "Sparse";
  if (ndvi < 0.4) return "Moderate";
  if (ndvi < 0.6) return "Healthy";
  return "Very Healthy";
};

/**
 * Get statistical values for a polygon (NDVI mean, min, max, std)
 */
export const getSentinelStats = async (coords, days = 30) => {
  const token = await getAccessToken();
  const geometry = coordsToGeoJSON(coords);

  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const evalscript = `
    //VERSION=3
    function setup() {
      return {
        input: ["B04", "B08", "dataMask"],
        output: [
          { id: "ndvi", bands: 1 },
          { id: "dataMask", bands: 1 }
        ]
      };
    }

    function evaluatePixel(sample) {
      let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
      return {
        ndvi: [ndvi],
        dataMask: [sample.dataMask]
      };
    }
  `;

  const requestBody = {
    input: {
      bounds: {
        geometry: geometry,
        properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
      },
      data: [
        {
          type: "sentinel-2-l2a",
          dataFilter: {
            timeRange: {
              from: `${startDate}T00:00:00Z`,
              to: `${endDate}T23:59:59Z`,
            },
            maxCloudCoverage: 30,
          },
        },
      ],
    },
    aggregation: {
      timeRange: {
        from: `${startDate}T00:00:00Z`,
        to: `${endDate}T23:59:59Z`,
      },
      aggregationInterval: { of: "P5D" }, // 5-day intervals
      evalscript: evalscript,
      resx: 10,
      resy: 10,
    },
    calculations: {
      default: {
        statistics: {
          default: {
            percentiles: { k: [25, 50, 75] },
          },
        },
      },
    },
  };

  const response = await fetch(`${SENTINEL_API_BASE}/api/v1/statistics`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Sentinel Stats Error:", response.status, errorText);
    throw new Error(`Failed to get statistics: ${response.status}`);
  }

  const data = await response.json();
  console.log("Sentinel Statistics:", data);
  return data;
};

/**
 * Get comprehensive vegetation statistics (NDVI, SAVI, Moisture, LAI) as numeric values
 * Returns mean, min, max, and standard deviation for each index
 */
export const getVegetationStats = async (coords, days = 30) => {
  const token = await getAccessToken();
  const geometry = coordsToGeoJSON(coords);

  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  // Evalscript that calculates all vegetation indices
  const evalscript = `
    //VERSION=3
    function setup() {
      return {
        input: ["B02", "B03", "B04", "B08", "B8A", "B11", "dataMask"],
        output: [
          { id: "ndvi", bands: 1 },
          { id: "savi", bands: 1 },
          { id: "moisture", bands: 1 },
          { id: "lai", bands: 1 },
          { id: "dataMask", bands: 1 }
        ]
      };
    }

    function evaluatePixel(sample) {
      // NDVI = (NIR - Red) / (NIR + Red)
      let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04 + 0.0001);
      
      // SAVI = ((NIR - Red) / (NIR + Red + L)) * (1 + L), L = 0.5
      let L = 0.5;
      let savi = ((sample.B08 - sample.B04) / (sample.B08 + sample.B04 + L)) * (1 + L);
      
      // NDMI (Moisture) = (NIR - SWIR) / (NIR + SWIR)
      let moisture = (sample.B8A - sample.B11) / (sample.B8A + sample.B11 + 0.0001);
      
      // Simplified LAI estimation based on NDVI
      // LAI ≈ -ln((0.69 - NDVI) / 0.59) / 0.91 (capped at 0-8 range)
      let lai = 0;
      if (ndvi > 0.1) {
        lai = Math.max(0, Math.min(8, -Math.log((0.69 - ndvi) / 0.59) / 0.91));
      }
      
      return {
        ndvi: [ndvi],
        savi: [savi],
        moisture: [moisture],
        lai: [lai],
        dataMask: [sample.dataMask]
      };
    }
  `;

  const requestBody = {
    input: {
      bounds: {
        geometry: geometry,
        properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
      },
      data: [
        {
          type: "sentinel-2-l2a",
          dataFilter: {
            timeRange: {
              from: `${startDate}T00:00:00Z`,
              to: `${endDate}T23:59:59Z`,
            },
            maxCloudCoverage: 30,
            mosaickingOrder: "leastCC",
          },
        },
      ],
    },
    aggregation: {
      timeRange: {
        from: `${startDate}T00:00:00Z`,
        to: `${endDate}T23:59:59Z`,
      },
      aggregationInterval: { of: "P30D" },
      evalscript: evalscript,
      resx: 10,
      resy: 10,
    },
    calculations: {
      default: {
        statistics: {
          default: {
            percentiles: { k: [25, 50, 75] },
          },
        },
      },
    },
  };

  const response = await fetch(`${SENTINEL_API_BASE}/api/v1/statistics`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      "Sentinel Vegetation Stats Error:",
      response.status,
      errorText
    );
    throw new Error(`Failed to get vegetation statistics: ${response.status}`);
  }

  const data = await response.json();
  console.log("Sentinel Vegetation Statistics Raw:", data);

  // Parse the statistics into a cleaner format
  const stats = {
    ndvi: null,
    savi: null,
    moisture: null,
    lai: null,
    acquisitionDate: null,
  };

  if (data.data && data.data.length > 0) {
    const latestData = data.data[data.data.length - 1];
    stats.acquisitionDate = latestData.interval?.from;

    if (latestData.outputs) {
      ["ndvi", "savi", "moisture", "lai"].forEach((index) => {
        if (latestData.outputs[index]?.bands?.B0?.stats) {
          const s = latestData.outputs[index].bands.B0.stats;
          stats[index] = {
            mean: s.mean,
            min: s.min,
            max: s.max,
            stDev: s.stDev,
            median: s.percentiles?.p50,
            p25: s.percentiles?.p25,
            p75: s.percentiles?.p75,
          };
        }
      });
    }
  }

  return stats;
};

/**
 * Fetch all Sentinel data for a farm
 */
export const getAllSentinelDataForFarm = async (coords) => {
  const results = await Promise.allSettled([
    getSentinelTrueColor(coords),
    getSentinelNDVI(coords),
    getSentinelSAVI(coords),
    getSentinelMoisture(coords),
    getSentinelLAI(coords),
    searchSentinelScenes(coords),
  ]);

  const dataNames = ["trueColor", "ndvi", "savi", "moisture", "lai", "scenes"];
  const data = {};
  const errors = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      data[dataNames[index]] = result.value;
    } else {
      errors.push({ api: dataNames[index], error: result.reason.message });
      data[dataNames[index]] = null;
    }
  });

  return { data, errors };
};

/**
 * Get historical vegetation index time series data for charts
 * Returns data points every 5 days for the last N days
 */
export const getVegetationHistory = async (coords, days = 60) => {
  const token = await getAccessToken();
  const geometry = coordsToGeoJSON(coords);

  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  // Evalscript that calculates all vegetation indices
  const evalscript = `
    //VERSION=3
    function setup() {
      return {
        input: ["B02", "B03", "B04", "B08", "B8A", "B11", "dataMask"],
        output: [
          { id: "ndvi", bands: 1 },
          { id: "savi", bands: 1 },
          { id: "moisture", bands: 1 },
          { id: "lai", bands: 1 },
          { id: "dataMask", bands: 1 }
        ]
      };
    }

    function evaluatePixel(sample) {
      // NDVI = (NIR - Red) / (NIR + Red)
      let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04 + 0.0001);
      
      // SAVI = ((NIR - Red) / (NIR + Red + L)) * (1 + L), L = 0.5
      let L = 0.5;
      let savi = ((sample.B08 - sample.B04) / (sample.B08 + sample.B04 + L)) * (1 + L);
      
      // NDMI (Moisture) = (NIR - SWIR) / (NIR + SWIR)
      let moisture = (sample.B8A - sample.B11) / (sample.B8A + sample.B11 + 0.0001);
      
      // Simplified LAI estimation based on NDVI
      let lai = 0;
      if (ndvi > 0.1) {
        lai = Math.max(0, Math.min(8, -Math.log((0.69 - ndvi) / 0.59) / 0.91));
      }
      
      return {
        ndvi: [ndvi],
        savi: [savi],
        moisture: [moisture],
        lai: [lai],
        dataMask: [sample.dataMask]
      };
    }
  `;

  const requestBody = {
    input: {
      bounds: {
        geometry: geometry,
        properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
      },
      data: [
        {
          type: "sentinel-2-l2a",
          dataFilter: {
            timeRange: {
              from: `${startDate}T00:00:00Z`,
              to: `${endDate}T23:59:59Z`,
            },
            maxCloudCoverage: 50,
            mosaickingOrder: "leastCC",
          },
        },
      ],
    },
    aggregation: {
      timeRange: {
        from: `${startDate}T00:00:00Z`,
        to: `${endDate}T23:59:59Z`,
      },
      aggregationInterval: { of: "P5D" }, // 5-day intervals for time series
      evalscript: evalscript,
      resx: 10,
      resy: 10,
    },
    calculations: {
      default: {
        statistics: {
          default: {
            percentiles: { k: [50] },
          },
        },
      },
    },
  };

  const response = await fetch(`${SENTINEL_API_BASE}/api/v1/statistics`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Sentinel History Error:", response.status, errorText);
    throw new Error(`Failed to get vegetation history: ${response.status}`);
  }

  const responseData = await response.json();
  console.log("Sentinel Vegetation History Raw:", responseData);

  // Parse into chart-friendly format
  const history = {
    ndvi: [],
    savi: [],
    moisture: [],
    lai: [],
  };

  if (responseData.data && responseData.data.length > 0) {
    responseData.data.forEach((interval) => {
      const date = interval.interval?.from;
      if (!date) return;

      // Parse date to timestamp
      const timestamp = new Date(date).getTime() / 1000; // Unix timestamp

      ["ndvi", "savi", "moisture", "lai"].forEach((index) => {
        if (interval.outputs?.[index]?.bands?.B0?.stats?.mean !== undefined) {
          history[index].push({
            dt: timestamp,
            date: date,
            data: {
              mean: interval.outputs[index].bands.B0.stats.mean,
              min: interval.outputs[index].bands.B0.stats.min,
              max: interval.outputs[index].bands.B0.stats.max,
              median: interval.outputs[index].bands.B0.stats.percentiles?.p50,
            },
          });
        }
      });
    });
  }

  console.log("Parsed Vegetation History:", history);
  return history;
};
