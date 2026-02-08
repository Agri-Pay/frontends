// src/thingsboard.js
// Frontend service for ThingsBoard IoT data via Supabase Edge Functions

import { supabase } from "./createclient";

/**
 * Get IoT devices linked to a farm
 * @param {string} farmId - Farm UUID
 * @returns {Promise<Array>} List of devices
 */
export const getFarmIoTDevices = async (farmId) => {
    const { data, error } = await supabase
        .from("iot_devices")
        .select("*, iot_sensor_types(name, unit)")
        .eq("farm_id", farmId)
        .eq("is_active", true)
        .not("thingsboard_device_id", "is", null);

    if (error) {
        console.error("Error fetching IoT devices:", error);
        return [];
    }

    // Transform to consistent format
    return (data || []).map((device) => ({
        id: device.id,
        device_id: device.thingsboard_device_id,
        device_name: device.display_name,
        device_type: device.iot_sensor_types?.name || "unknown",
        telemetry_keys: device.config?.telemetry_keys || [],
        last_reading_at: device.last_reading_at,
    }));
};

/**
 * Get latest telemetry for a device
 * @param {string} deviceId - ThingsBoard device ID
 * @param {string[]} keys - Telemetry keys to fetch
 * @returns {Promise<Object>} Latest telemetry values
 */
export const getLatestTelemetry = async (deviceId, keys = []) => {
    const { data, error } = await supabase.functions.invoke("thingsboard-telemetry", {
        body: { deviceId, keys, limit: 1 },
    });

    if (error) {
        console.error("Error fetching telemetry:", error);
        throw error;
    }

    // Transform response: { key: [{ ts, value }] } => { key: value, key_ts: ts }
    const result = {};
    for (const [key, values] of Object.entries(data || {})) {
        if (Array.isArray(values) && values.length > 0) {
            result[key] = parseFloat(values[0].value) || values[0].value;
            result[`${key}_ts`] = values[0].ts;
        }
    }
    return result;
};

/**
 * Get historical telemetry for a device
 * @param {string} deviceId - ThingsBoard device ID
 * @param {string[]} keys - Telemetry keys to fetch
 * @param {number} startTs - Start timestamp in ms
 * @param {number} endTs - End timestamp in ms
 * @returns {Promise<Object>} Historical telemetry data
 */
export const getTelemetryHistory = async (deviceId, keys, startTs, endTs) => {
    const { data, error } = await supabase.functions.invoke("thingsboard-telemetry", {
        body: { deviceId, keys, startTs, endTs },
    });

    if (error) {
        console.error("Error fetching telemetry history:", error);
        throw error;
    }

    return data || {};
};

/**
 * Get all IoT data for a farm (devices + latest readings)
 * @param {string} farmId - Farm UUID
 * @returns {Promise<Array>} Devices with their latest telemetry
 */
export const getFarmIoTData = async (farmId) => {
    const devices = await getFarmIoTDevices(farmId);

    // Fetch latest telemetry for each device in parallel
    const devicesWithData = await Promise.all(
        devices.map(async (device) => {
            try {
                const telemetry = await getLatestTelemetry(device.device_id, device.telemetry_keys);
                return { ...device, telemetry };
            } catch (error) {
                console.error(`Error fetching telemetry for ${device.device_name}:`, error);
                return { ...device, telemetry: null, error: true };
            }
        })
    );

    return devicesWithData;
};

// Virtual sensor device ID for satellite data
export const VIRTUAL_SENSOR_ID = "281e6cd0-0322-11f1-a7c1-43f8f9a544af";

/**
 * Check if satellite data for a capture date has already been published
 * Queries ThingsBoard directly - no database storage needed
 * @param {string} captureDate - Satellite capture date (YYYY-MM-DD)
 * @returns {Promise<boolean>} True if already published
 */
const isAlreadyPublished = async (captureDate) => {
    try {
        // Get the latest capture_date from virtual sensor
        const latestTelemetry = await getLatestTelemetry(VIRTUAL_SENSOR_ID, ["capture_date"]);
        const lastCaptureDate = latestTelemetry?.capture_date;

        if (lastCaptureDate === captureDate) {
            return true;
        }
        return false;
    } catch (error) {
        // If we can't check (e.g., no data yet), allow publish
        console.log("Could not check existing telemetry, allowing publish:", error.message);
        return false;
    }
};

/**
 * Publish satellite telemetry to ThingsBoard virtual sensor
 * Only publishes if cloud cover ≤ 15% and not already published for this capture date
 * @param {string} farmId - Farm UUID (for logging)
 * @param {Object} stats - Vegetation stats from getVegetationStats()
 * @param {Object} dateInfo - Date info with cloudCover from getAvailableDates()
 * @returns {Promise<boolean>} True if published successfully
 */
export const publishSatelliteTelemetry = async (farmId, stats, dateInfo) => {
    // Skip if cloud cover > 15%
    if (!dateInfo || dateInfo.cloudCover > 15) {
        console.log("Skipping satellite publish - cloud cover too high:", dateInfo?.cloudCover);
        return false;
    }

    const captureDate = stats?.acquisitionDate?.split("T")[0] || dateInfo.date;

    // Check deduplication by querying ThingsBoard
    const alreadyPublished = await isAlreadyPublished(captureDate);
    if (alreadyPublished) {
        console.log("Skipping satellite publish - already published for:", captureDate);
        return false;
    }

    // Build telemetry payload
    const telemetry = {
        ndvi: stats.ndvi?.mean ?? null,
        ndvi_min: stats.ndvi?.min ?? null,
        ndvi_max: stats.ndvi?.max ?? null,
        savi: stats.savi?.mean ?? null,
        lai: stats.lai?.mean ?? null,
        moisture: stats.moisture?.mean ?? null,
        cloud_cover: dateInfo.cloudCover,
        capture_date: captureDate,
        data_source: "satellite",
    };

    // Filter out null values
    const cleanTelemetry = Object.fromEntries(
        Object.entries(telemetry).filter(([_, v]) => v !== null)
    );

    try {
        const { data, error } = await supabase.functions.invoke("thingsboard-publish", {
            body: {
                deviceId: VIRTUAL_SENSOR_ID,
                telemetry: cleanTelemetry,
            },
        });

        if (error) throw error;

        console.log("Satellite telemetry published successfully for:", captureDate);
        return true;
    } catch (error) {
        console.error("Error publishing satellite telemetry:", error);
        return false;
    }
};
