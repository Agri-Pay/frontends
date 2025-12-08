# Drone Imagery & GIS Server Integration Guide

## 📋 Overview

This guide covers how to handle **large drone imagery files (GBs)** with **raster layers** (NDVI, Moisture, LAI, etc.) for your AgriPay farm monitoring system. We'll explore different architectures from simple to enterprise-grade.

---

## 🎯 Key Requirements

| Requirement       | Description                                           |
| ----------------- | ----------------------------------------------------- |
| **Large Files**   | Drone imagery batches can be 1-10+ GB                 |
| **Raster Layers** | Need to display NDVI, Moisture, Thermal, RGB overlays |
| **Web Display**   | Stream tiles to Leaflet/MapLibre in browser           |
| **Performance**   | Fast tile serving, lazy loading, zoom levels          |
| **Processing**    | Convert raw drone images → GeoTIFF → Tiles            |

---

## 🏗️ Architecture Options

### Option 1: GeoServer (Open Source GIS Server) ⭐ RECOMMENDED

**Best for**: Production systems, large datasets, multiple farms

```
┌─────────────────────────────────────────────────────────────────┐
│                        ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Drone Provider  ──►  Upload Portal  ──►  Processing Pipeline  │
│       │                                          │              │
│       ▼                                          ▼              │
│  Raw Images                              GeoTIFF + COGs         │
│  (JPEG/TIFF)                             (Cloud Optimized)      │
│                                                  │              │
│                                                  ▼              │
│                                          ┌─────────────┐        │
│                                          │  GeoServer  │        │
│                                          │   (WMS/WMTS)│        │
│                                          └──────┬──────┘        │
│                                                 │               │
│                                                 ▼               │
│  React Frontend  ◄──────────────────────  Tile Requests        │
│  (Leaflet)           (XYZ/WMS Tiles)                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### GeoServer Setup

```bash
# Docker deployment (easiest)
docker run -d \
  --name geoserver \
  -p 8080:8080 \
  -v /data/geoserver:/opt/geoserver/data_dir \
  -e GEOSERVER_ADMIN_PASSWORD=mysecretpassword \
  kartoza/geoserver:latest
```

#### Pros

- ✅ Industry standard for GIS
- ✅ Supports WMS, WMTS, WFS, WCS protocols
- ✅ Built-in styling (SLD) for NDVI color ramps
- ✅ Handles massive rasters efficiently
- ✅ REST API for automation
- ✅ Free and open source

#### Cons

- ❌ Requires server setup/maintenance
- ❌ Java-based (heavier resource usage)
- ❌ Learning curve for configuration

#### Cost: **FREE** (self-hosted) or ~$50-200/month (cloud VM)

---

### Option 2: TiTiler (Cloud-Optimized GeoTIFF Server) ⭐ MODERN

**Best for**: Cloud-native, serverless, COG-based workflows

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Drone Images ──► GDAL Processing ──► COG Files ──► S3/R2/GCS  │
│                                                          │      │
│                                                          ▼      │
│                                                    ┌──────────┐ │
│                                                    │ TiTiler  │ │
│                                                    │ (FastAPI)│ │
│                                                    └────┬─────┘ │
│                                                         │       │
│  React/Leaflet  ◄───────────────────────────  Dynamic Tiles    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### TiTiler Setup

```bash
# Docker deployment
docker run -d \
  --name titiler \
  -p 8000:8000 \
  -e AWS_ACCESS_KEY_ID=xxx \
  -e AWS_SECRET_ACCESS_KEY=xxx \
  ghcr.io/developmentseed/titiler:latest

# Usage: Dynamic tiles from COG
# GET /cog/tiles/{z}/{x}/{y}?url=s3://bucket/farm_ndvi.tif
```

#### Convert to COG (Cloud-Optimized GeoTIFF)

```bash
# Using GDAL
gdal_translate input.tif output_cog.tif \
  -co TILED=YES \
  -co COPY_SRC_OVERVIEWS=YES \
  -co COMPRESS=LZW

# Or using rio-cogeo
pip install rio-cogeo
rio cogeo create input.tif output_cog.tif --overview-level 6
```

#### Pros

- ✅ Serverless-friendly (can run on Lambda/Cloud Run)
- ✅ No pre-processing of tiles needed
- ✅ Dynamic styling and band math
- ✅ Works directly with cloud storage
- ✅ Python-based, easy to customize

#### Cons

- ❌ Requires COG format (conversion step)
- ❌ Less mature than GeoServer
- ❌ Need to manage cloud storage

#### Cost: **FREE** (self-hosted) + storage costs (~$0.02/GB/month)

---

### Option 3: Mapbox Tiling Service (Managed)

**Best for**: Fastest setup, no server management

```javascript
// Upload raster to Mapbox
const uploadRaster = async (geotiffUrl) => {
  const response = await fetch("https://api.mapbox.com/uploads/v1/{username}", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tileset: "username.farm-ndvi-2024",
      url: geotiffUrl,
      name: "Farm NDVI Layer",
    }),
  });
};

// Use in Leaflet
L.tileLayer(
  "https://api.mapbox.com/v4/{tileset}/{z}/{x}/{y}.png?access_token={token}"
);
```

#### Pros

- ✅ Zero infrastructure
- ✅ Global CDN
- ✅ Easy integration

#### Cons

- ❌ Expensive at scale ($5 per 1000 tile requests after free tier)
- ❌ Upload limits
- ❌ Less control over processing

#### Cost: **$0-500+/month** depending on usage

---

### Option 4: pg_tileserv + PostGIS Raster (Database-Native)

**Best for**: If you're already using PostGIS heavily

```sql
-- Store raster in PostGIS
CREATE TABLE drone_imagery (
  id SERIAL PRIMARY KEY,
  farm_id UUID REFERENCES farms(id),
  captured_at TIMESTAMP,
  layer_type VARCHAR(50), -- 'ndvi', 'moisture', 'rgb'
  rast RASTER
);

-- Import raster
raster2pgsql -s 4326 -I -C -M farm_ndvi.tif drone_imagery | psql
```

```bash
# Run pg_tileserv
docker run -d \
  --name pg_tileserv \
  -p 7800:7800 \
  -e DATABASE_URL=postgres://user:pass@host/db \
  pramsey/pg_tileserv
```

#### Pros

- ✅ Single database for everything
- ✅ SQL queries on raster data
- ✅ Integrates with existing PostGIS setup

#### Cons

- ❌ Database can get bloated
- ❌ Not ideal for very large rasters
- ❌ More complex queries

#### Cost: **Database costs only**

---

### Option 5: Pre-Generated Tile Pyramid (Static Tiles)

**Best for**: Simple, cheap, read-heavy workloads

```bash
# Generate tiles with GDAL
gdal2tiles.py -z 10-18 -w none farm_ndvi.tif ./tiles/ndvi/

# Output structure:
# tiles/ndvi/{z}/{x}/{y}.png
```

```javascript
// Serve from any static host (S3, R2, Netlify, etc.)
L.tileLayer("/tiles/ndvi/{z}/{x}/{y}.png").addTo(map);
```

#### Pros

- ✅ Simplest architecture
- ✅ Cheapest (just storage costs)
- ✅ Fastest serving (static files + CDN)
- ✅ Works offline

#### Cons

- ❌ Must regenerate tiles when imagery updates
- ❌ Large storage footprint (tiles multiply size)
- ❌ No dynamic styling

#### Cost: **~$0.01-0.05/GB/month** (storage only)

---

## 🔄 Processing Pipeline

Regardless of which serving option you choose, you need a **processing pipeline**:

```
┌─────────────────────────────────────────────────────────────────┐
│                     PROCESSING PIPELINE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. UPLOAD                                                      │
│     ├── Drone provider uploads ZIP/folder                       │
│     ├── Store raw files in cold storage (S3 Glacier, B2)        │
│     └── Trigger processing job                                  │
│                                                                 │
│  2. ORTHO-MOSAIC (if needed)                                    │
│     ├── Stitch individual photos into single raster             │
│     ├── Tools: ODM (OpenDroneMap), Pix4D, DroneDeploy           │
│     └── Output: GeoTIFF with georeferencing                     │
│                                                                 │
│  3. BAND CALCULATION                                            │
│     ├── Calculate vegetation indices from multispectral         │
│     │   NDVI = (NIR - Red) / (NIR + Red)                        │
│     │   NDRE = (NIR - RedEdge) / (NIR + RedEdge)                │
│     │   Moisture = (NIR - SWIR) / (NIR + SWIR)                  │
│     ├── Tools: GDAL, Rasterio, QGIS                             │
│     └── Output: Separate GeoTIFF per index                      │
│                                                                 │
│  4. OPTIMIZE                                                    │
│     ├── Convert to Cloud-Optimized GeoTIFF (COG)                │
│     ├── Add overviews (pyramids) for fast zoom                  │
│     └── Compress (LZW, DEFLATE)                                 │
│                                                                 │
│  5. STORE & SERVE                                               │
│     ├── Upload to tile server or cloud storage                  │
│     └── Register in database with metadata                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Python Processing Script Example

```python
# process_drone_imagery.py
import rasterio
from rasterio.enums import Resampling
import numpy as np
from rio_cogeo.cogeo import cog_translate
from rio_cogeo.profiles import cog_profiles

def calculate_ndvi(nir_band, red_band):
    """Calculate NDVI from NIR and Red bands"""
    ndvi = (nir_band.astype(float) - red_band.astype(float)) / \
           (nir_band.astype(float) + red_band.astype(float) + 0.0001)
    return np.clip(ndvi, -1, 1)

def process_multispectral(input_path, output_dir, farm_id):
    """Process multispectral drone image"""
    with rasterio.open(input_path) as src:
        # Assuming band order: Blue, Green, Red, RedEdge, NIR
        red = src.read(3)
        nir = src.read(5)

        # Calculate NDVI
        ndvi = calculate_ndvi(nir, red)

        # Save NDVI as GeoTIFF
        profile = src.profile
        profile.update(count=1, dtype='float32')

        ndvi_path = f"{output_dir}/{farm_id}_ndvi.tif"
        with rasterio.open(ndvi_path, 'w', **profile) as dst:
            dst.write(ndvi.astype('float32'), 1)

        # Convert to COG
        cog_path = f"{output_dir}/{farm_id}_ndvi_cog.tif"
        cog_translate(ndvi_path, cog_path, cog_profiles.get("deflate"))

        return cog_path

# Usage
cog_file = process_multispectral(
    "uploads/farm_123_drone.tif",
    "processed/",
    "farm_123"
)
```

---

## 🖥️ Frontend Integration with Leaflet

### Using WMS (GeoServer)

```jsx
// components/DroneImageryLayer.jsx
import { WMSTileLayer, LayersControl } from "react-leaflet";

const DroneImageryLayers = ({ farmId }) => {
  const geoserverUrl = "https://your-geoserver.com/geoserver/wms";

  return (
    <LayersControl position="topright">
      <LayersControl.BaseLayer checked name="RGB">
        <WMSTileLayer
          url={geoserverUrl}
          layers={`agripay:${farmId}_rgb`}
          format="image/png"
          transparent={true}
        />
      </LayersControl.BaseLayer>

      <LayersControl.Overlay name="NDVI">
        <WMSTileLayer
          url={geoserverUrl}
          layers={`agripay:${farmId}_ndvi`}
          format="image/png"
          transparent={true}
          styles="ndvi_colormap"
        />
      </LayersControl.Overlay>

      <LayersControl.Overlay name="Moisture">
        <WMSTileLayer
          url={geoserverUrl}
          layers={`agripay:${farmId}_moisture`}
          format="image/png"
          transparent={true}
          styles="moisture_colormap"
        />
      </LayersControl.Overlay>
    </LayersControl>
  );
};
```

### Using TiTiler (COG)

```jsx
// components/COGLayer.jsx
import { useEffect, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

const COGLayer = ({ cogUrl, colormap = "rdylgn" }) => {
  const map = useMap();
  const titilerUrl = "https://your-titiler.com";

  useEffect(() => {
    // Get COG bounds
    fetch(`${titilerUrl}/cog/bounds?url=${encodeURIComponent(cogUrl)}`)
      .then((res) => res.json())
      .then((data) => {
        const bounds = data.bounds;

        // Add tile layer
        const layer = L.tileLayer(
          `${titilerUrl}/cog/tiles/{z}/{x}/{y}?url=${encodeURIComponent(
            cogUrl
          )}&colormap=${colormap}`,
          {
            bounds: [
              [bounds[1], bounds[0]],
              [bounds[3], bounds[2]],
            ],
            maxZoom: 22,
          }
        );

        layer.addTo(map);
        map.fitBounds([
          [bounds[1], bounds[0]],
          [bounds[3], bounds[2]],
        ]);

        return () => map.removeLayer(layer);
      });
  }, [cogUrl, map, colormap]);

  return null;
};
```

### Layer Switcher Component

```jsx
// components/ImageryLayerSwitcher.jsx
import React, { useState } from "react";

const LAYER_TYPES = [
  { id: "rgb", name: "True Color", colormap: null },
  { id: "ndvi", name: "NDVI", colormap: "rdylgn" },
  { id: "ndre", name: "NDRE", colormap: "rdylgn" },
  { id: "moisture", name: "Moisture", colormap: "blues" },
  { id: "thermal", name: "Thermal", colormap: "inferno" },
];

const ImageryLayerSwitcher = ({
  droneFlightId,
  activeLayer,
  onLayerChange,
}) => {
  const [opacity, setOpacity] = useState(1);

  return (
    <div className="layer-switcher">
      <h4>Drone Imagery Layers</h4>

      <div className="layer-buttons">
        {LAYER_TYPES.map((layer) => (
          <button
            key={layer.id}
            className={activeLayer === layer.id ? "active" : ""}
            onClick={() => onLayerChange(layer.id)}
          >
            {layer.name}
          </button>
        ))}
      </div>

      <div className="opacity-slider">
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
    </div>
  );
};
```

---

## 📊 Database Schema for Drone Imagery

```sql
-- Drone flights/missions
CREATE TABLE drone_flights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID REFERENCES farms(id) ON DELETE CASCADE,
  captured_at TIMESTAMP NOT NULL,
  provider VARCHAR(100), -- 'DJI', 'senseFly', etc.
  drone_model VARCHAR(100),
  flight_altitude_m DECIMAL(6,2),
  gsd_cm DECIMAL(5,2), -- Ground Sample Distance
  total_images INTEGER,
  coverage_area_ha DECIMAL(10,2),
  raw_data_size_gb DECIMAL(6,2),
  status VARCHAR(50) DEFAULT 'processing', -- 'processing', 'ready', 'failed'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Individual imagery layers
CREATE TABLE drone_imagery_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id UUID REFERENCES drone_flights(id) ON DELETE CASCADE,
  layer_type VARCHAR(50) NOT NULL, -- 'rgb', 'ndvi', 'ndre', 'moisture', 'thermal'
  storage_path TEXT NOT NULL, -- 's3://bucket/path/to/cog.tif'
  storage_type VARCHAR(50), -- 'cog', 'tiles', 'wms'
  tile_url TEXT, -- Pre-computed tile URL template
  bounds JSONB, -- [minLon, minLat, maxLon, maxLat]
  min_zoom INTEGER,
  max_zoom INTEGER,
  file_size_mb DECIMAL(10,2),
  statistics JSONB, -- { min, max, mean, std, histogram }
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_drone_flights_farm ON drone_flights(farm_id);
CREATE INDEX idx_drone_imagery_flight ON drone_imagery_layers(flight_id);
CREATE INDEX idx_drone_imagery_type ON drone_imagery_layers(layer_type);
```

---

## 💰 Cost Comparison

| Solution                    | Storage (10GB/farm) | Compute     | Monthly (100 farms) |
| --------------------------- | ------------------- | ----------- | ------------------- |
| **GeoServer (Self-hosted)** | $0 (local)          | $50-100 VM  | ~$50-100            |
| **TiTiler + R2**            | $2                  | $20-50      | ~$70-250            |
| **Mapbox**                  | N/A                 | Per request | $200-1000+          |
| **Static Tiles + CDN**      | $5-10               | $0          | ~$10-20             |
| **PostGIS Raster**          | Database            | Database    | ~$50-200            |

---

## 🎯 Recommended Stack for AgriPay

Given your current setup (Supabase + Leaflet + Sentinel Hub), I recommend:

### Starter (< 50 farms)

```
Static Tiles (gdal2tiles) → Cloudflare R2 → Leaflet
```

- Cheapest option
- Process tiles offline, upload to R2
- Simple and reliable

### Growth (50-500 farms)

```
TiTiler → Cloudflare R2 (COGs) → Leaflet
```

- Dynamic tile generation
- No pre-processing of tiles
- Scales well

### Enterprise (500+ farms)

```
GeoServer → S3/MinIO → Leaflet + MapLibre
```

- Full GIS capabilities
- WMS/WMTS standards
- Advanced styling and queries

---

## 🚀 Quick Start Implementation

### Step 1: Set Up Storage

```javascript
// supabase storage bucket for raw uploads
const { data, error } = await supabase.storage.createBucket("drone-imagery", {
  public: false,
  fileSizeLimit: 10737418240, // 10GB
});
```

### Step 2: Upload Handler

```javascript
// components/DroneUpload.jsx
const DroneUpload = ({ farmId }) => {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (files) => {
    setUploading(true);

    for (const file of files) {
      const path = `${farmId}/${Date.now()}_${file.name}`;

      const { error } = await supabase.storage
        .from("drone-imagery")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        toast.error(`Failed to upload ${file.name}`);
        continue;
      }

      // Trigger processing via Edge Function
      await supabase.functions.invoke("process-drone-imagery", {
        body: { farmId, path },
      });
    }

    toast.success("Upload complete! Processing will take 5-10 minutes.");
    setUploading(false);
  };

  return (
    <div className="drone-upload">
      <input
        type="file"
        multiple
        accept=".tif,.tiff,.jpg,.jpeg"
        onChange={(e) => handleUpload(e.target.files)}
        disabled={uploading}
      />
    </div>
  );
};
```

### Step 3: Processing Edge Function

```typescript
// supabase/functions/process-drone-imagery/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const { farmId, path } = await req.json();

  // Option 1: Call external processing service (recommended)
  const processingResponse = await fetch(
    "https://your-processing-api.com/process",
    {
      method: "POST",
      body: JSON.stringify({ farmId, path }),
    }
  );

  // Option 2: Queue for background worker
  // Add to processing queue in database

  return new Response(JSON.stringify({ status: "queued" }));
});
```

---

## 📚 Additional Resources

- [GeoServer Documentation](https://docs.geoserver.org/)
- [TiTiler Documentation](https://developmentseed.org/titiler/)
- [Cloud-Optimized GeoTIFF Guide](https://www.cogeo.org/)
- [GDAL Raster Processing](https://gdal.org/programs/gdal_translate.html)
- [OpenDroneMap](https://www.opendronemap.org/) - Free ortho-mosaicing
- [Rasterio Python Library](https://rasterio.readthedocs.io/)

---

## ❓ FAQ

**Q: Do I need a GIS server if drone providers already give processed images?**
A: If providers give you GeoTIFFs with NDVI/indices pre-calculated, you can skip processing. You still need a tile server (GeoServer/TiTiler) or convert to static tiles for web display.

**Q: How long does processing take?**
A: Depends on image size. A 5GB multispectral dataset takes ~5-15 minutes to process indices and generate COGs.

**Q: Can I use Supabase Storage for COGs?**
A: Yes, but TiTiler works best with S3-compatible storage that supports Range requests. Cloudflare R2 is ideal (S3-compatible + free egress).

**Q: What about real-time streaming from drones?**
A: That's a different architecture involving WebRTC/RTMP streams. This guide covers post-flight processed imagery.
