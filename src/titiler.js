// src/titiler.js
/**
 * TiTiler API service for drone imagery
 * Handles COG tile serving with dynamic styling
 */

const TITILER_URL = import.meta.env.VITE_TITILER_URL || "";

// Check if we're in a production environment (no local TiTiler)
export const isLocalMode = () => {
  return TITILER_URL && TITILER_URL.includes("localhost");
};

// Check if TiTiler is configured at all
export const isTiTilerConfigured = () => {
  return !!TITILER_URL && TITILER_URL.length > 0;
};

/**
 * Build tile URL for Leaflet TileLayer
 * @param {string} filename - Name of file in imagery folder (e.g., 'farm1_ndvi.tif')
 * @param {object} options - Tile options
 */
export const getTileUrl = (filename, options = {}) => {
  const fileUrl = `file:///data/${filename}`;
  const params = new URLSearchParams({
    url: fileUrl,
  });

  // Add colormap for indices
  if (options.colormap) {
    params.append("colormap_name", options.colormap);
  }

  // Add rescale for proper color mapping
  if (options.rescale) {
    params.append("rescale", options.rescale);
  }

  // Add band selection - TiTiler expects separate bidx params
  if (options.bidx) {
    const bands = options.bidx.split(",");
    bands.forEach((band) => {
      params.append("bidx", band.trim());
    });
  }

  // Add expression for computed indices
  if (options.expression) {
    params.append("expression", options.expression);
  }

  // Add nodata parameter to make empty areas transparent
  // 0 is commonly used as nodata for drone imagery
  if (options.nodata !== undefined) {
    params.append("nodata", options.nodata.toString());
  }

  // TiTiler requires TileMatrixSetId (WebMercatorQuad) in the URL path
  return `${TITILER_URL}/cog/tiles/WebMercatorQuad/{z}/{x}/{y}?${params.toString()}`;
};

/**
 * Get raster bounds for fitting map view
 * Note: TiTiler doesn't have a separate /cog/bounds endpoint,
 * bounds are included in the /cog/info response
 */
export const getBounds = async (filename) => {
  const fileUrl = `file:///data/${filename}`;
  const response = await fetch(
    `${TITILER_URL}/cog/info?url=${encodeURIComponent(fileUrl)}`
  );

  if (!response.ok) {
    throw new Error("Failed to get bounds");
  }

  const data = await response.json();
  // Info response includes bounds: [minx, miny, maxx, maxy]
  return data.bounds;
};

/**
 * Get raster info (CRS, dimensions, bands, etc.)
 */
export const getInfo = async (filename) => {
  const fileUrl = `file:///data/${filename}`;
  const response = await fetch(
    `${TITILER_URL}/cog/info?url=${encodeURIComponent(fileUrl)}`
  );

  if (!response.ok) {
    throw new Error("Failed to get info");
  }

  return response.json();
};

/**
 * Get band statistics (min, max, mean, std)
 */
export const getStatistics = async (filename) => {
  const fileUrl = `file:///data/${filename}`;
  const response = await fetch(
    `${TITILER_URL}/cog/statistics?url=${encodeURIComponent(fileUrl)}`
  );

  if (!response.ok) {
    throw new Error("Failed to get statistics");
  }

  return response.json();
};

/**
 * Get pixel value at a specific point
 */
export const getPointValue = async (filename, lat, lon) => {
  const fileUrl = `file:///data/${filename}`;
  const response = await fetch(
    `${TITILER_URL}/cog/point/${lon},${lat}?url=${encodeURIComponent(fileUrl)}`
  );

  if (!response.ok) {
    throw new Error("Failed to get point value");
  }

  return response.json();
};

/**
 * Get preview image URL
 */
export const getPreviewUrl = (filename, options = {}) => {
  const fileUrl = `file:///data/${filename}`;
  const params = new URLSearchParams({
    url: fileUrl,
    max_size: options.maxSize || 512,
  });

  if (options.colormap) {
    params.append("colormap_name", options.colormap);
  }

  if (options.rescale) {
    params.append("rescale", options.rescale);
  }

  // Add band selection - TiTiler expects separate bidx params for each band
  // e.g., "3,2,1" becomes &bidx=3&bidx=2&bidx=1
  if (options.bidx) {
    const bands = options.bidx.split(",");
    bands.forEach((band) => {
      params.append("bidx", band.trim());
    });
  }

  // Add expression for computed indices (e.g., NDVI)
  if (options.expression) {
    params.append("expression", options.expression);
  }

  return `${TITILER_URL}/cog/preview?${params.toString()}`;
};

/**
 * Get preview URL using expression (for computed indices like NDVI)
 */
export const getExpressionPreviewUrl = (filename, expression, options = {}) => {
  const fileUrl = `file:///data/${filename}`;
  const params = new URLSearchParams({
    url: fileUrl,
    expression: expression,
    max_size: options.maxSize || 512,
  });

  if (options.colormap) {
    params.append("colormap_name", options.colormap);
  }

  if (options.rescale) {
    params.append("rescale", options.rescale);
  }

  return `${TITILER_URL}/cog/preview?${params.toString()}`;
};

/**
 * Predefined layer configurations
 * For 10-band MicaSense imagery:
 *   Band 1: Blue-444 (444nm)
 *   Band 2: Blue (475nm)
 *   Band 3: Green-531 (531nm)
 *   Band 4: Green (560nm)
 *   Band 5: Red-650 (650nm)
 *   Band 6: Red (668nm)
 *   Band 7: Red Edge 705 (705nm)
 *   Band 8: Red Edge (717nm)
 *   Band 9: Red Edge 740 (740nm)
 *   Band 10: NIR (842nm)
 */
export const LAYER_CONFIGS = {
  // === Band Composites ===
  rgb: {
    name: "True Color (RGB)",
    description: "Red, Green, Blue composite",
    bidx: "5,3,1", // Red-650, Green-531, Blue-444
    rescale: "0,10000", // Based on percentile_2 to percentile_98 from stats
    colormap: null,
    expression: null,
    nodata: 65535, // MicaSense uses 65535 as nodata/fill value
  },
  cir: {
    name: "False Color (CIR)",
    description: "Color Infrared - vegetation appears red",
    bidx: "10,5,3", // NIR, Red-650, Green-531
    rescale: "0,15000",
    colormap: null,
    expression: null,
    nodata: 65535,
  },
  nrg: {
    name: "NIR-RedEdge-Green",
    description: "Highlights vegetation stress",
    bidx: "10,7,3", // NIR, Red Edge 705, Green-531
    rescale: "0,15000",
    colormap: null,
    expression: null,
    nodata: 65535,
  },

  // === Individual Bands ===
  blue444: {
    name: "Blue 444nm",
    description: "444nm - Deep Blue",
    bidx: "1",
    rescale: "500,5000",
    colormap: "blues",
    expression: null,
    nodata: 65535,
  },
  blue: {
    name: "Blue 475nm",
    description: "475nm - Blue",
    bidx: "2",
    rescale: "500,5000",
    colormap: "blues",
    expression: null,
    nodata: 65535,
  },
  green531: {
    name: "Green 531nm",
    description: "531nm - Green",
    bidx: "3",
    rescale: "500,5000",
    colormap: "greens",
    expression: null,
    nodata: 65535,
  },
  green: {
    name: "Green 560nm",
    description: "560nm - Green",
    bidx: "4",
    rescale: "500,5000",
    colormap: "greens",
    expression: null,
    nodata: 65535,
  },
  red650: {
    name: "Red 650nm",
    description: "650nm - Red",
    bidx: "5",
    rescale: "500,8000",
    colormap: "reds",
    expression: null,
    nodata: 65535,
  },
  red: {
    name: "Red 668nm",
    description: "668nm - Red",
    bidx: "6",
    rescale: "500,8000",
    colormap: "reds",
    expression: null,
    nodata: 65535,
  },
  rededge705: {
    name: "Red Edge 705nm",
    description: "705nm - Red Edge",
    bidx: "7",
    rescale: "500,10000",
    colormap: "oranges",
    expression: null,
    nodata: 65535,
  },
  rededge: {
    name: "Red Edge 717nm",
    description: "717nm - Red Edge",
    bidx: "8",
    rescale: "500,10000",
    colormap: "oranges",
    expression: null,
    nodata: 65535,
  },
  rededge740: {
    name: "Red Edge 740nm",
    description: "740nm - Red Edge",
    bidx: "9",
    rescale: "500,10000",
    colormap: "oranges",
    expression: null,
    nodata: 65535,
  },
  nir: {
    name: "NIR 842nm",
    description: "842nm - Near Infrared",
    bidx: "10",
    rescale: "500,15000",
    colormap: "purples",
    expression: null,
    nodata: 65535,
  },

  // === Computed Indices ===
  ndvi: {
    name: "NDVI",
    description: "Normalized Difference Vegetation Index",
    bidx: null,
    rescale: "-0.5,1",
    colormap: "rdylgn",
    expression: "(b10-b5)/(b10+b5)", // (NIR - Red650) / (NIR + Red650)
    nodata: 65535, // Mask nodata pixels for transparency
  },
  ndre: {
    name: "NDRE",
    description: "Normalized Difference Red Edge Index",
    bidx: null,
    rescale: "-0.5,1",
    colormap: "rdylgn",
    expression: "(b10-b7)/(b10+b7)", // (NIR - RedEdge705) / (NIR + RedEdge705)
    nodata: 65535, // Mask nodata pixels for transparency
  },
  gndvi: {
    name: "GNDVI",
    description: "Green Normalized Difference Vegetation Index",
    bidx: null,
    rescale: "-0.5,1",
    colormap: "rdylgn",
    expression: "(b10-b3)/(b10+b3)", // (NIR - Green531) / (NIR + Green531)
    nodata: 65535, // Mask nodata pixels for transparency
  },

  // === Legacy configs (for backwards compatibility) ===
  moisture: {
    name: "Moisture",
    colormap: "blues",
    rescale: "0,1",
    bidx: null,
    expression: null,
  },
  thermal: {
    name: "Thermal",
    colormap: "inferno",
    rescale: "20,45",
    bidx: null,
    expression: null,
  },
  lai: {
    name: "LAI",
    colormap: "greens",
    rescale: "0,8",
    bidx: null,
    expression: null,
  },
};

/**
 * 10-band MicaSense band definitions for UI
 */
export const MICASENSE_BANDS = {
  1: { name: "Blue 444", wavelength: "444 nm", color: "#0044cc" },
  2: { name: "Blue", wavelength: "475 nm", color: "#0066ff" },
  3: { name: "Green 531", wavelength: "531 nm", color: "#00aa00" },
  4: { name: "Green", wavelength: "560 nm", color: "#00cc00" },
  5: { name: "Red 650", wavelength: "650 nm", color: "#dd0000" },
  6: { name: "Red", wavelength: "668 nm", color: "#ff0000" },
  7: { name: "Red Edge 705", wavelength: "705 nm", color: "#ff4400" },
  8: { name: "Red Edge", wavelength: "717 nm", color: "#ff6600" },
  9: { name: "Red Edge 740", wavelength: "740 nm", color: "#ff8800" },
  10: { name: "NIR", wavelength: "842 nm", color: "#990099" },
};

/**
 * Compute vegetation indices from raw 10-band MicaSense values
 * @param {Array<number>} values - Array of 10 band values [b1, b2, ..., b10]
 * @returns {Object|null} Object with computed indices or null if nodata
 */
export const computeVegetationIndices = (values) => {
  if (!values || values.length < 10) return null;

  const [b1, b2, b3, b4, b5, b6, b7, b8, b9, b10] = values;

  // Check for nodata (65535 indicates no data in MicaSense imagery)
  if (b5 === 65535 || b10 === 65535 || b3 === 65535 || b7 === 65535) {
    return null;
  }

  // Check for division by zero
  const ndviDenom = b10 + b5;
  const ndreDenom = b10 + b7;
  const gndviDenom = b10 + b3;

  return {
    ndvi: ndviDenom !== 0 ? (b10 - b5) / ndviDenom : null,
    ndre: ndreDenom !== 0 ? (b10 - b7) / ndreDenom : null,
    gndvi: gndviDenom !== 0 ? (b10 - b3) / gndviDenom : null,
  };
};

/**
 * Get health status description based on NDVI value
 * @param {number} ndvi - NDVI value (-1 to 1)
 * @returns {Object} Object with status label and color
 */
export const getNdviHealthStatus = (ndvi) => {
  if (ndvi === null || ndvi === undefined) return { label: "No Data", color: "#888" };
  if (ndvi < 0) return { label: "Water/Shadow", color: "#2c3e50" };
  if (ndvi < 0.1) return { label: "Bare Soil", color: "#a0522d" };
  if (ndvi < 0.2) return { label: "Sparse", color: "#daa520" };
  if (ndvi < 0.4) return { label: "Moderate", color: "#9acd32" };
  if (ndvi < 0.6) return { label: "Healthy", color: "#228b22" };
  return { label: "Very Healthy", color: "#006400" };
};

/**
 * Check if TiTiler server is available
 */
export const checkHealth = async () => {
  // If no TiTiler URL configured, return false immediately
  if (!isTiTilerConfigured()) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    const response = await fetch(`${TITILER_URL}/healthz`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
};
