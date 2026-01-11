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
 * For MicaSense RedEdge-MX bands:
 *   Band 1: Blue (475nm)
 *   Band 2: Green (560nm)
 *   Band 3: Red (668nm)
 *   Band 4: Red Edge (717nm)
 *   Band 5: NIR (840nm)
 */
export const LAYER_CONFIGS = {
  // === Band Composites ===
  rgb: {
    name: "True Color (RGB)",
    description: "Red, Green, Blue composite",
    bidx: "3,2,1", // Red, Green, Blue
    rescale: "0,10000", // Based on percentile_2 to percentile_98 from stats
    colormap: null,
    expression: null,
    nodata: 65535, // MicaSense uses 65535 as nodata/fill value
  },
  cir: {
    name: "False Color (CIR)",
    description: "Color Infrared - vegetation appears red",
    bidx: "5,3,2", // NIR, Red, Green
    rescale: "0,15000",
    colormap: null,
    expression: null,
    nodata: 65535,
  },
  nrg: {
    name: "NIR-RedEdge-Green",
    description: "Highlights vegetation stress",
    bidx: "5,4,2", // NIR, Red Edge, Green
    rescale: "0,15000",
    colormap: null,
    expression: null,
    nodata: 65535,
  },

  // === Individual Bands ===
  blue: {
    name: "Blue Band",
    description: "475nm - Coastal/Aerosol",
    bidx: "1",
    rescale: "500,5000",
    colormap: "blues",
    expression: null,
    nodata: 65535,
  },
  green: {
    name: "Green Band",
    description: "560nm - Visible Green",
    bidx: "2",
    rescale: "500,5000",
    colormap: "greens",
    expression: null,
    nodata: 65535,
  },
  red: {
    name: "Red Band",
    description: "668nm - Visible Red",
    bidx: "3",
    rescale: "500,8000",
    colormap: "reds",
    expression: null,
    nodata: 65535,
  },
  rededge: {
    name: "Red Edge Band",
    description: "717nm - Vegetation stress",
    bidx: "4",
    rescale: "500,10000",
    colormap: "oranges",
    expression: null,
    nodata: 65535,
  },
  nir: {
    name: "NIR Band",
    description: "840nm - Vegetation health",
    bidx: "5",
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
    expression: "(b5-b3)/(b5+b3)", // (NIR - Red) / (NIR + Red)
    // Note: nodata not set for expressions - TiTiler handles mask from source
  },
  ndre: {
    name: "NDRE",
    description: "Normalized Difference Red Edge Index",
    bidx: null,
    rescale: "-0.5,1",
    colormap: "rdylgn",
    expression: "(b5-b4)/(b5+b4)", // (NIR - RedEdge) / (NIR + RedEdge)
  },
  gndvi: {
    name: "GNDVI",
    description: "Green Normalized Difference Vegetation Index",
    bidx: null,
    rescale: "-0.5,1",
    colormap: "rdylgn",
    expression: "(b5-b2)/(b5+b2)", // (NIR - Green) / (NIR + Green)
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
 * MicaSense band definitions for UI
 */
export const MICASENSE_BANDS = {
  1: { name: "Blue", wavelength: "475 nm", color: "#0066ff" },
  2: { name: "Green", wavelength: "560 nm", color: "#00cc00" },
  3: { name: "Red", wavelength: "668 nm", color: "#ff0000" },
  4: { name: "Red Edge", wavelength: "717 nm", color: "#ff6600" },
  5: { name: "NIR", wavelength: "840 nm", color: "#990099" },
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
