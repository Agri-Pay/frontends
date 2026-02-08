// src/SatelliteImagerySection.jsx
/**
 * Satellite Imagery Section for Farm Details Page
 * Displays Sentinel-2 satellite imagery with interactive map and layer selection
 * Supports date selection, index switching, and click-to-value features
 */

import { useState, useEffect, useCallback } from "react";
import {
    MapContainer,
    TileLayer,
    ImageOverlay,
    useMap,
    useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
    getAvailableDates,
    getSentinelNDVI,
    getSentinelTrueColor,
    getSentinelSAVI,
    getSentinelMoisture,
    getSentinelLAI,
    getPointStats,
} from "./sentinelhub";
import "./satelliteimagery.css";

// Satellite indices configuration
const SATELLITE_INDICES = {
    trueColor: {
        name: "True Color",
        description: "Natural RGB satellite view",
        icon: "image",
        fetchFn: getSentinelTrueColor,
    },
    ndvi: {
        name: "NDVI",
        description: "Vegetation health index",
        icon: "eco",
        fetchFn: getSentinelNDVI,
    },
    savi: {
        name: "SAVI",
        description: "Soil-adjusted vegetation",
        icon: "grass",
        fetchFn: getSentinelSAVI,
    },
    moisture: {
        name: "Moisture",
        description: "Plant water stress",
        icon: "water_drop",
        fetchFn: getSentinelMoisture,
    },
    lai: {
        name: "LAI",
        description: "Leaf area index",
        icon: "forest",
        fetchFn: getSentinelLAI,
    },
};

// Cloud cover quality configuration
const CLOUD_QUALITY = {
    excellent: { maxCloud: 15, label: "Excellent", color: "#22c55e", badge: "🟢" },
    good: { maxCloud: 30, label: "Good", color: "#eab308", badge: "🟡" },
    moderate: { maxCloud: 50, label: "Moderate", color: "#f97316", badge: "🟠" },
    poor: { maxCloud: 100, label: "Poor", color: "#ef4444", badge: "🔴" },
};

// Helper component to fit map to bounds
const FitBounds = ({ bounds }) => {
    const map = useMap();
    useEffect(() => {
        if (bounds) {
            map.fitBounds(bounds, { padding: [20, 20] });
        }
    }, [map, bounds]);
    return null;
};

// Helper component for map click events
const MapClickHandler = ({ onClick }) => {
    useMapEvents({
        click: (e) => {
            onClick({ lat: e.latlng.lat, lng: e.latlng.lng });
        },
    });
    return null;
};

const SatelliteImagerySection = ({ farmId, coords }) => {
    // State
    const [selectedIndex, setSelectedIndex] = useState("ndvi");
    const [selectedDate, setSelectedDate] = useState(null);
    const [availableDates, setAvailableDates] = useState([]);
    const [imageUrl, setImageUrl] = useState(null);
    const [mapBounds, setMapBounds] = useState(null);
    const [opacity, setOpacity] = useState(0.85);
    const [loading, setLoading] = useState(false);
    const [datesLoading, setDatesLoading] = useState(false);
    const [error, setError] = useState(null);
    const [pointValue, setPointValue] = useState(null);
    const [pointLoading, setPointLoading] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Convert coords to bounds for map
    const coordsToBounds = useCallback((coords) => {
        if (!coords || coords.length < 3) return null;
        const lats = coords.map((c) => c.lat);
        const lngs = coords.map((c) => c.lng);
        return [
            [Math.min(...lats), Math.min(...lngs)],
            [Math.max(...lats), Math.max(...lngs)],
        ];
    }, []);

    // Fetch available dates on mount
    useEffect(() => {
        if (!coords || coords.length < 3) return;

        const fetchDates = async () => {
            setDatesLoading(true);
            try {
                const { dates } = await getAvailableDates(coords, 180);
                setAvailableDates(dates);

                // Auto-select most recent date with excellent quality (≤15% cloud cover)
                const excellentDate = dates.find((d) => d.cloudCover <= 15);
                if (excellentDate) {
                    setSelectedDate(excellentDate.date);
                } else if (dates.length > 0) {
                    // Fallback to most recent
                    setSelectedDate(dates[0].date);
                }
            } catch (err) {
                console.error("Failed to fetch available dates:", err);
                setError("Failed to load available dates");
            } finally {
                setDatesLoading(false);
            }
        };

        fetchDates();
        setMapBounds(coordsToBounds(coords));
    }, [coords, coordsToBounds]);

    // Fetch image when index or date changes
    useEffect(() => {
        if (!coords || coords.length < 3 || !selectedDate) return;

        const fetchImage = async () => {
            setLoading(true);
            setError(null);

            try {
                const indexConfig = SATELLITE_INDICES[selectedIndex];
                if (!indexConfig) {
                    throw new Error(`Unknown index: ${selectedIndex}`);
                }

                const url = await indexConfig.fetchFn(coords, 512, 512, selectedDate);
                setImageUrl(url);
            } catch (err) {
                console.error("Failed to fetch satellite image:", err);
                setError(`Failed to load ${SATELLITE_INDICES[selectedIndex]?.name || selectedIndex} image`);
                setImageUrl(null);
            } finally {
                setLoading(false);
            }
        };

        fetchImage();
    }, [coords, selectedIndex, selectedDate]);

    // Handle map click for vegetation values
    const handleMapClick = useCallback(
        async ({ lat, lng }) => {
            if (!selectedDate) return;

            setPointLoading(true);
            setPointValue(null);

            try {
                const stats = await getPointStats(lat, lng, selectedDate);
                setPointValue(stats);
            } catch (err) {
                console.error("Failed to get point stats:", err);
                setPointValue({ lat, lng, error: true });
            } finally {
                setPointLoading(false);
            }
        },
        [selectedDate]
    );

    // Format date for display
    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    // Get quality badge for cloud cover
    const getQualityBadge = (cloudCover) => {
        if (cloudCover <= 15) return CLOUD_QUALITY.excellent;
        if (cloudCover <= 30) return CLOUD_QUALITY.good;
        if (cloudCover <= 50) return CLOUD_QUALITY.moderate;
        return CLOUD_QUALITY.poor;
    };

    // Get map center from bounds
    const getMapCenter = () => {
        if (!mapBounds) return [31.47, 74.41]; // Default to LUMS area
        return [
            (mapBounds[0][0] + mapBounds[1][0]) / 2,
            (mapBounds[0][1] + mapBounds[1][1]) / 2,
        ];
    };

    // Get health badge color
    const getHealthBadgeColor = (health) => {
        switch (health) {
            case "Very Healthy":
                return "#22c55e";
            case "Healthy":
                return "#65a30d";
            case "Moderate":
                return "#eab308";
            case "Sparse":
                return "#f97316";
            case "Bare Soil":
                return "#dc2626";
            case "Water/Shadow":
                return "#0ea5e9";
            default:
                return "#94a3b8";
        }
    };

    // Polygon removed - satellite image overlay already shows farm area

    // Don't render if no coords
    if (!coords || coords.length < 3) {
        return (
            <div className="data-card satellite-imagery-card">
                <h3>Sentinel-2 Satellite Imagery</h3>
                <div className="satellite-placeholder">
                    <span className="material-symbols-outlined">satellite_alt</span>
                    <p>No farm boundary defined</p>
                </div>
            </div>
        );
    }

    return (
        <div className="data-card satellite-imagery-card">
            {/* Header */}
            <div className="satellite-header">
                <h3>
                    <span className="material-symbols-outlined header-icon">satellite_alt</span>
                    Sentinel-2 Satellite Imagery
                </h3>
            </div>

            {/* Controls Row */}
            <div className="satellite-controls">
                {/* Index Selector */}
                <div className="control-group">
                    <label>Index</label>
                    <div className="index-buttons">
                        {Object.entries(SATELLITE_INDICES).map(([key, config]) => (
                            <button
                                key={key}
                                className={`index-btn ${selectedIndex === key ? "active" : ""}`}
                                onClick={() => setSelectedIndex(key)}
                                title={config.description}
                            >
                                <span className="material-symbols-outlined">{config.icon}</span>
                                <span className="btn-label">{config.name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Date Selector */}
                <div className="control-group date-control">
                    <label>Date</label>
                    <div className="date-dropdown-container">
                        <button
                            className="date-dropdown-trigger"
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            disabled={datesLoading}
                        >
                            {datesLoading ? (
                                <span>Loading dates...</span>
                            ) : selectedDate ? (
                                <>
                                    <span className="selected-date">{formatDate(selectedDate)}</span>
                                    <span
                                        className="cloud-badge"
                                        style={{
                                            backgroundColor: getQualityBadge(
                                                availableDates.find((d) => d.date === selectedDate)?.cloudCover || 0
                                            ).color,
                                        }}
                                    >
                                        ☁️{" "}
                                        {Math.round(
                                            availableDates.find((d) => d.date === selectedDate)?.cloudCover || 0
                                        )}
                                        %
                                    </span>
                                </>
                            ) : (
                                <span>Select date...</span>
                            )}
                            <span className="material-symbols-outlined dropdown-arrow">
                                {isDropdownOpen ? "expand_less" : "expand_more"}
                            </span>
                        </button>

                        {isDropdownOpen && (
                            <div className="date-dropdown-menu">
                                {availableDates.length === 0 ? (
                                    <div className="date-option disabled">No dates available</div>
                                ) : (
                                    availableDates.map((dateInfo) => {
                                        const quality = getQualityBadge(dateInfo.cloudCover);
                                        const isPoor = dateInfo.cloudCover > 50;

                                        return (
                                            <button
                                                key={dateInfo.date}
                                                className={`date-option ${selectedDate === dateInfo.date ? "selected" : ""
                                                    } ${isPoor ? "poor-quality" : ""}`}
                                                onClick={() => {
                                                    setSelectedDate(dateInfo.date);
                                                    setIsDropdownOpen(false);
                                                }}
                                            >
                                                <span className="date-text">{formatDate(dateInfo.date)}</span>
                                                <span className="cloud-info">
                                                    <span className="cloud-icon">☁️</span>
                                                    <span className="cloud-percent">
                                                        {Math.round(dateInfo.cloudCover)}%
                                                    </span>
                                                    <span
                                                        className="quality-badge"
                                                        style={{ backgroundColor: quality.color }}
                                                    >
                                                        {quality.label}
                                                    </span>
                                                </span>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Opacity Control */}
                <div className="control-group opacity-control">
                    <label>Opacity</label>
                    <div className="opacity-slider-container">
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={opacity}
                            onChange={(e) => setOpacity(parseFloat(e.target.value))}
                            className="opacity-slider"
                        />
                        <span className="opacity-value">{Math.round(opacity * 100)}%</span>
                    </div>
                </div>
            </div>

            {/* Map Container */}
            <div className="satellite-map-container">
                {loading && (
                    <div className="map-loading-overlay">
                        <div className="loader"></div>
                        <p>Loading {SATELLITE_INDICES[selectedIndex]?.name || "image"}...</p>
                    </div>
                )}

                {error && (
                    <div className="map-error-overlay">
                        <span className="material-symbols-outlined">error</span>
                        <p>{error}</p>
                    </div>
                )}

                <MapContainer
                    center={getMapCenter()}
                    zoom={17}
                    className="satellite-map"
                    scrollWheelZoom={true}
                >
                    <TileLayer
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        attribution="&copy; Esri"
                    />

                    {mapBounds && <FitBounds bounds={mapBounds} />}

                    {/* Note: Farm boundary polygon removed - satellite image overlay shows the farm area */}

                    {/* Satellite image overlay */}
                    {imageUrl && mapBounds && (
                        <ImageOverlay url={imageUrl} bounds={mapBounds} opacity={opacity} />
                    )}

                    <MapClickHandler onClick={handleMapClick} />
                </MapContainer>

                {/* Point Value Display */}
                {(pointValue || pointLoading) && (
                    <div className="point-value-display satellite-point">
                        <button
                            className="close-point-value"
                            onClick={() => setPointValue(null)}
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>

                        {pointLoading ? (
                            <div className="point-loading">
                                <div className="loader small"></div>
                                <span>Loading values...</span>
                            </div>
                        ) : pointValue?.error ? (
                            <div className="point-error">
                                <span className="material-symbols-outlined">error</span>
                                <span>Failed to load values</span>
                            </div>
                        ) : (
                            <>
                                {/* Health Status Badge */}
                                <div
                                    className="health-badge"
                                    style={{
                                        backgroundColor: getHealthBadgeColor(pointValue.health),
                                    }}
                                >
                                    {pointValue.health}
                                </div>

                                {/* Coordinates */}
                                <div className="point-coords">
                                    <span>
                                        {pointValue.lat?.toFixed(5)}, {pointValue.lng?.toFixed(5)}
                                    </span>
                                </div>

                                {/* Vegetation Indices Grid */}
                                <div className="indices-grid">
                                    <div className="index-item">
                                        <span className="index-label">NDVI</span>
                                        <span className="index-value">
                                            {pointValue.ndvi !== null ? pointValue.ndvi.toFixed(3) : "—"}
                                        </span>
                                    </div>
                                    <div className="index-item">
                                        <span className="index-label">SAVI</span>
                                        <span className="index-value">
                                            {pointValue.savi !== null ? pointValue.savi.toFixed(3) : "—"}
                                        </span>
                                    </div>
                                    <div className="index-item">
                                        <span className="index-label">Moisture</span>
                                        <span className="index-value">
                                            {pointValue.moisture !== null
                                                ? pointValue.moisture.toFixed(3)
                                                : "—"}
                                        </span>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Scene Info Footer */}
            {selectedDate && !loading && (
                <div className="scene-info">
                    <span className="material-symbols-outlined">info</span>
                    <span>
                        Showing {SATELLITE_INDICES[selectedIndex]?.name} from {formatDate(selectedDate)}
                        {availableDates.find((d) => d.date === selectedDate) && (
                            <> • Cloud cover: {Math.round(availableDates.find((d) => d.date === selectedDate).cloudCover)}%</>
                        )}
                    </span>
                </div>
            )}
        </div>
    );
};

export default SatelliteImagerySection;
