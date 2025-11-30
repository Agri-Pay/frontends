// src/api/agroMonitoring.js
// All API calls now go through the Supabase Edge Function to hide API key

import { supabase } from "./createclient";

/**
 * Helper function to call the agromonitoring-proxy Edge Function
 */
const callAgroProxy = async (action, params = {}) => {
  const { data, error } = await supabase.functions.invoke("agromonitoring-proxy", {
    body: { action, ...params },
  });

  // Check for errors in the response data first (Edge Function returns errors in body)
  if (data?.error) {
    console.error(`AgroMonitoring ${action} error:`, data.error);
    throw new Error(data.error);
  }

  // Then check for Supabase function invocation errors
  if (error) {
    console.error(`AgroMonitoring ${action} invocation error:`, error);
    // error.message contains the actual error from Supabase
    throw new Error(error.message || `Failed to ${action}`);
  }

  return data;
};

/**
 * Register a polygon with AgroMonitoring
 * @param {string} farmName - Name of the farm
 * @param {Array<{lat: number, lng: number}>} coordinates - Array of coordinates
 * @returns {string} The AgroMonitoring polygon ID
 */
export const registerPolygonWithAgro = async (farmName, coordinates) => {
  const result = await callAgroProxy("registerPolygon", { farmName, coordinates });
  return result.id;
};

/**
 * Fetches weather forecast for a polygon.
 */
export const getWeatherForPolygon = async (polyId) => {
  if (!polyId) throw new Error("Polygon ID is required.");
  return await callAgroProxy("getWeatherForecast", { polyId });
};

/**
 * Fetches current soil temperature and moisture for a polygon.
 */
export const getSoilDataForPolygon = async (polyId) => {
  if (!polyId) throw new Error("Polygon ID is required.");
  return await callAgroProxy("getSoilData", { polyId });
};

/**
 * Fetches historical NDVI data for a polygon.
 */
export const getNdviHistoryForPolygon = async (polyId, days = 30) => {
  if (!polyId) throw new Error("Polygon ID is required.");
  return await callAgroProxy("getNdviHistory", { polyId, days });
};

/**
 * Searches for available satellite imagery for a polygon.
 * Returns the most recent image metadata.
 */
export const searchSatelliteImages = async (polyId, days = 30) => {
  if (!polyId) throw new Error("Polygon ID is required.");
  return await callAgroProxy("searchSatelliteImages", { polyId, days });
};

/**
 * Fetches current weather data for a polygon (not forecast).
 */
export const getCurrentWeatherForPolygon = async (polyId) => {
  if (!polyId) throw new Error("Polygon ID is required.");
  return await callAgroProxy("getCurrentWeather", { polyId });
};

/**
 * Fetches UV Index data for a polygon.
 */
export const getUviForPolygon = async (polyId) => {
  if (!polyId) throw new Error("Polygon ID is required.");
  return await callAgroProxy("getUvi", { polyId });
};

/**
 * Fetches historical EVI (Enhanced Vegetation Index) data for a polygon.
 */
export const getEviHistoryForPolygon = async (polyId, days = 30) => {
  if (!polyId) throw new Error("Polygon ID is required.");
  return await callAgroProxy("getEviHistory", { polyId, days });
};

/**
 * Fetches Accumulated Active Temperature (AAT) data for a polygon.
 * @param {string} polyId - The polygon ID
 * @param {number} threshold - Temperature threshold in Kelvin (default: 283.15K = 10°C)
 */
export const getAccumulatedTemperature = async (polyId, threshold = 283.15) => {
  if (!polyId) throw new Error("Polygon ID is required.");
  return await callAgroProxy("getAccumulatedTemperature", { polyId, threshold });
};

/**
 * Fetches Accumulated Precipitation data for a polygon.
 */
export const getAccumulatedPrecipitation = async (polyId) => {
  if (!polyId) throw new Error("Polygon ID is required.");
  return await callAgroProxy("getAccumulatedPrecipitation", { polyId });
};

/**
 * Fetches historical weather data for a polygon.
 */
export const getWeatherHistoryForPolygon = async (polyId) => {
  if (!polyId) throw new Error("Polygon ID is required.");
  return await callAgroProxy("getWeatherHistory", { polyId });
};

/**
 * Fetches all available satellite imagery for a polygon within a date range.
 */
export const getAllSatelliteImages = async (polyId, days = 30) => {
  if (!polyId) throw new Error("Polygon ID is required.");
  return await callAgroProxy("getAllSatelliteImages", { polyId, days });
};

/**
 * Fetches specific satellite image statistics (NDVI, EVI, etc.) for an image.
 * @param {string} imageUrl - The stats URL from the satellite image metadata
 */
export const getSatelliteImageStats = async (imageUrl) => {
  if (!imageUrl) throw new Error("Image URL is required.");
  return await callAgroProxy("getSatelliteImageStats", { imageUrl });
};

/**
 * Fetches polygon information from AgroMonitoring.
 */
export const getPolygonInfo = async (polyId) => {
  if (!polyId) throw new Error("Polygon ID is required.");
  return await callAgroProxy("getPolygonInfo", { polyId });
};

/**
 * Fetches all data from AgroMonitoring API for a polygon.
 * This is a convenience function to get all available data in one call.
 */
export const getAllAgroDataForPolygon = async (polyId) => {
  if (!polyId) throw new Error("Polygon ID is required.");
  return await callAgroProxy("getAllData", { polyId });
};
