// src/DroneImageryPanel.jsx
/**
 * Drone Imagery Layer Panel for TiTiler integration
 * Displays drone imagery with layer switching and controls
 */

import React, { useState, useEffect, useCallback } from "react";
import { TileLayer, useMap, useMapEvents } from "react-leaflet";
import {
  getTileUrl,
  getBounds,
  getStatistics,
  getPointValue,
  checkHealth,
  LAYER_CONFIGS,
} from "./titiler";
import "./droneimagery.css";

const DroneImageryPanel = ({ farmId, droneFlights = [] }) => {
  const map = useMap();

  // State
  const [serverOnline, setServerOnline] = useState(false);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [activeLayerType, setActiveLayerType] = useState("ndvi");
  const [opacity, setOpacity] = useState(0.8);
  const [showPanel, setShowPanel] = useState(true);
  const [loading, setLoading] = useState(true);
  const [pointValue, setPointValue] = useState(null);
  const [stats, setStats] = useState(null);
  const [tileUrl, setTileUrl] = useState(null);

  // Check if TiTiler is running
  useEffect(() => {
    const checkServer = async () => {
      const online = await checkHealth();
      setServerOnline(online);
      setLoading(false);

      if (!online) {
        console.warn(
          "TiTiler server is not running. Start it with: docker-compose up -d"
        );
      }
    };

    checkServer();
  }, []);

  // Set initial flight
  useEffect(() => {
    if (droneFlights.length > 0 && !selectedFlight) {
      setSelectedFlight(droneFlights[0]);
    }
  }, [droneFlights, selectedFlight]);

  // Update tile URL when flight or layer changes
  useEffect(() => {
    if (!selectedFlight || !serverOnline) {
      setTileUrl(null);
      return;
    }

    const filename = getFilename(selectedFlight, activeLayerType);
    const config = LAYER_CONFIGS[activeLayerType] || {};

    const url = getTileUrl(filename, {
      colormap: config.colormap,
      rescale: config.rescale,
      bidx: config.bidx,
    });

    setTileUrl(url);

    // Fetch bounds and zoom to layer
    const loadBounds = async () => {
      try {
        const bounds = await getBounds(filename);
        // bounds is [minx, miny, maxx, maxy] = [minLon, minLat, maxLon, maxLat]
        map.fitBounds(
          [
            [bounds[1], bounds[0]], // [minLat, minLon]
            [bounds[3], bounds[2]], // [maxLat, maxLon]
          ],
          { padding: [20, 20] }
        );
      } catch (error) {
        console.error("Error loading bounds:", error);
      }
    };

    // Fetch statistics
    const loadStats = async () => {
      try {
        const statistics = await getStatistics(filename);
        setStats(statistics);
      } catch (error) {
        console.error("Error loading statistics:", error);
      }
    };

    loadBounds();
    loadStats();
  }, [selectedFlight, activeLayerType, serverOnline, map]);

  // Get filename based on flight and layer type
  const getFilename = (flight, layerType) => {
    // Expected naming: farmId_date_layerType.tif
    // e.g., farm123_20241208_ndvi.tif
    return `${farmId}_${flight.date}_${layerType}.tif`;
  };

  // Handle map click to get point value
  useMapEvents({
    click: async (e) => {
      if (!selectedFlight || !serverOnline) return;

      const { lat, lng } = e.latlng;
      const filename = getFilename(selectedFlight, activeLayerType);

      try {
        const result = await getPointValue(filename, lat, lng);
        setPointValue({
          lat: lat.toFixed(6),
          lon: lng.toFixed(6),
          value: result.values?.[0]?.toFixed(3) || "N/A",
        });
      } catch (error) {
        console.error("Error getting point value:", error);
      }
    },
  });

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    // Handle YYYYMMDD format
    if (dateStr.length === 8) {
      return new Date(
        `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
      ).toLocaleDateString();
    }
    return new Date(dateStr).toLocaleDateString();
  };

  // Get available layer types for current flight
  const getAvailableLayers = () => {
    if (!selectedFlight?.layers) {
      return Object.keys(LAYER_CONFIGS);
    }
    return selectedFlight.layers;
  };

  if (loading) {
    return (
      <div className="drone-imagery-panel open">
        <div className="panel-header">
          <span className="material-symbols-outlined">satellite_alt</span>
          <span>Drone Imagery</span>
        </div>
        <div className="panel-content">
          <div className="loading">Checking server...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Tile Layer from TiTiler */}
      {tileUrl && serverOnline && (
        <TileLayer
          key={tileUrl}
          url={tileUrl}
          opacity={opacity}
          maxZoom={22}
          tileSize={256}
        />
      )}

      {/* Control Panel */}
      <div
        className={`drone-imagery-panel ${showPanel ? "open" : "collapsed"}`}
      >
        <div className="panel-header" onClick={() => setShowPanel(!showPanel)}>
          <span className="material-symbols-outlined">
            {showPanel ? "expand_more" : "satellite_alt"}
          </span>
          <span>Drone Imagery</span>
          {!serverOnline && (
            <span className="status-dot offline" title="Server offline" />
          )}
        </div>

        {showPanel && (
          <div className="panel-content">
            {!serverOnline ? (
              <div className="server-offline">
                <span className="material-symbols-outlined">cloud_off</span>
                <p>TiTiler server is not running</p>
                <code>cd titiler-local && docker-compose up -d</code>
              </div>
            ) : droneFlights.length === 0 ? (
              <div className="no-data">
                <span className="material-symbols-outlined">flight</span>
                <p>No drone imagery available</p>
                <small>Add GeoTIFFs to titiler-local/imagery/</small>
              </div>
            ) : (
              <>
                {/* Flight Selector */}
                <div className="control-group">
                  <label>Flight Date</label>
                  <select
                    value={selectedFlight?.date || ""}
                    onChange={(e) => {
                      const flight = droneFlights.find(
                        (f) => f.date === e.target.value
                      );
                      setSelectedFlight(flight);
                    }}
                  >
                    {droneFlights.map((flight) => (
                      <option key={flight.date} value={flight.date}>
                        {formatDate(flight.date)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Layer Type Buttons */}
                <div className="control-group">
                  <label>Layer Type</label>
                  <div className="layer-buttons">
                    {getAvailableLayers().map((layerType) => {
                      const config = LAYER_CONFIGS[layerType] || {
                        name: layerType,
                      };
                      return (
                        <button
                          key={layerType}
                          className={`layer-btn ${
                            activeLayerType === layerType ? "active" : ""
                          }`}
                          onClick={() => setActiveLayerType(layerType)}
                        >
                          {config.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Opacity Slider */}
                <div className="control-group">
                  <label>Opacity: {Math.round(opacity * 100)}%</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={opacity}
                    onChange={(e) => setOpacity(parseFloat(e.target.value))}
                  />
                </div>

                {/* Statistics */}
                {stats && (
                  <div className="control-group stats">
                    <label>Statistics</label>
                    <div className="stats-grid">
                      <div>
                        <span>Min</span>
                        <strong>{stats.b1?.min?.toFixed(3) || "N/A"}</strong>
                      </div>
                      <div>
                        <span>Max</span>
                        <strong>{stats.b1?.max?.toFixed(3) || "N/A"}</strong>
                      </div>
                      <div>
                        <span>Mean</span>
                        <strong>{stats.b1?.mean?.toFixed(3) || "N/A"}</strong>
                      </div>
                      <div>
                        <span>Std</span>
                        <strong>{stats.b1?.std?.toFixed(3) || "N/A"}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* Point Value (click on map) */}
                {pointValue && (
                  <div className="control-group point-value">
                    <label>Point Value (click map)</label>
                    <div className="point-info">
                      <span>
                        {activeLayerType.toUpperCase()}:{" "}
                        <strong>{pointValue.value}</strong>
                      </span>
                      <small>
                        ({pointValue.lat}, {pointValue.lon})
                      </small>
                    </div>
                  </div>
                )}

                {/* Legend */}
                <div className="control-group legend">
                  <label>Legend</label>
                  <div className={`legend-bar ${activeLayerType}`}>
                    {activeLayerType === "ndvi" && (
                      <>
                        <span className="legend-label left">-1 (Bare)</span>
                        <span className="legend-label right">+1 (Dense)</span>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default DroneImageryPanel;
