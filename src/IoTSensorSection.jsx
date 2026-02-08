// src/IoTSensorSection.jsx
// Component for displaying IoT sensor data from ThingsBoard

import React, { useState, useEffect, useCallback } from "react";
import { getFarmIoTData, getTelemetryHistory } from "./thingsboard";
import { Line } from "react-chartjs-2";
import "./iotsensor.css";

const IoTSensorSection = ({ farmId }) => {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [historyData, setHistoryData] = useState(null);
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [historyDays, setHistoryDays] = useState(7);

    // Fetch all devices and their latest readings
    const fetchData = useCallback(async () => {
        if (!farmId) return;

        setLoading(true);
        setError(null);
        try {
            const data = await getFarmIoTData(farmId);
            setDevices(data);
            if (data.length > 0 && !selectedDevice) {
                setSelectedDevice(data[0]);
            }
        } catch (err) {
            console.error("Error fetching IoT data:", err);
            setError("Failed to load IoT sensor data");
        } finally {
            setLoading(false);
        }
    }, [farmId, selectedDevice]);

    // Fetch historical data for selected device
    const fetchHistory = useCallback(async () => {
        if (!selectedDevice) return;

        const endTs = Date.now();
        const startTs = endTs - historyDays * 24 * 60 * 60 * 1000;

        try {
            const history = await getTelemetryHistory(
                selectedDevice.device_id,
                ["soilMoisture_%"],
                startTs,
                endTs
            );
            setHistoryData(history);
        } catch (err) {
            console.error("Error fetching history:", err);
        }
    }, [selectedDevice, historyDays]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    // Format timestamp to readable time
    const formatTime = (ts) => {
        if (!ts) return "N/A";
        const date = new Date(ts);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins} min ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
        return date.toLocaleDateString();
    };

    // Prepare chart data
    const chartData = historyData?.["soilMoisture_%"]
        ? {
            labels: historyData["soilMoisture_%"]
                .map((d) => new Date(d.ts).toLocaleDateString())
                .reverse(),
            datasets: [
                {
                    label: "Soil Moisture %",
                    data: historyData["soilMoisture_%"]
                        .map((d) => parseFloat(d.value))
                        .reverse(),
                    borderColor: "#3b82f6",
                    backgroundColor: "rgba(59, 130, 246, 0.1)",
                    fill: true,
                    tension: 0.3,
                },
            ],
        }
        : null;

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
        },
        scales: {
            y: {
                beginAtZero: true,
                max: 100,
                title: { display: true, text: "Moisture %" },
            },
        },
    };

    if (loading && devices.length === 0) {
        return (
            <div className="iot-section">
                <h3 className="iot-title">🌱 IoT Sensors</h3>
                <div className="iot-loading">Loading sensor data...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="iot-section">
                <h3 className="iot-title">🌱 IoT Sensors</h3>
                <div className="iot-error">{error}</div>
            </div>
        );
    }

    if (devices.length === 0) {
        return (
            <div className="iot-section">
                <h3 className="iot-title">🌱 IoT Sensors</h3>
                <div className="iot-empty">No IoT sensors linked to this farm</div>
            </div>
        );
    }

    return (
        <div className="iot-section">
            <div className="iot-header">
                <h3 className="iot-title">🌱 IoT Sensors</h3>
                <button className="iot-refresh-btn" onClick={fetchData} disabled={loading}>
                    {loading ? "Refreshing..." : "Refresh"}
                </button>
            </div>

            {/* Device Cards */}
            <div className="iot-devices-grid">
                {devices.map((device) => (
                    <div
                        key={device.device_id}
                        className={`iot-device-card ${selectedDevice?.device_id === device.device_id ? "selected" : ""}`}
                        onClick={() => setSelectedDevice(device)}
                    >
                        <div className="iot-device-name">{device.device_name}</div>

                        {device.telemetry ? (
                            <div className="iot-readings">
                                <div className="iot-reading">
                                    <span className="iot-reading-value">
                                        {device.telemetry["soilMoisture_%"]?.toFixed(1) ?? "--"}%
                                    </span>
                                    <span className="iot-reading-label">Moisture</span>
                                </div>
                                {device.telemetry.temperature !== undefined && (
                                    <div className="iot-reading">
                                        <span className="iot-reading-value">
                                            {device.telemetry.temperature}°C
                                        </span>
                                        <span className="iot-reading-label">Temp</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="iot-no-data">No data</div>
                        )}

                        <div className="iot-device-updated">
                            {formatTime(device.telemetry?.["soilMoisture_%_ts"])}
                        </div>
                    </div>
                ))}
            </div>

            {/* Historical Chart */}
            {chartData && (
                <div className="iot-chart-container">
                    <div className="iot-chart-header">
                        <span>Soil Moisture History - {selectedDevice?.device_name}</span>
                        <select
                            value={historyDays}
                            onChange={(e) => setHistoryDays(Number(e.target.value))}
                            className="iot-days-select"
                        >
                            <option value={1}>Last 24h</option>
                            <option value={7}>Last 7 days</option>
                            <option value={30}>Last 30 days</option>
                        </select>
                    </div>
                    <div className="iot-chart">
                        <Line data={chartData} options={chartOptions} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default IoTSensorSection;
