# 100% Free Alternatives for Drone Imagery Display

## Comparison of Free Options

| Option                | Server Needed? | Complexity | Best For             |
| --------------------- | -------------- | ---------- | -------------------- |
| **GeoServer (Local)** | Yes (Docker)   | Medium     | Full GIS features    |
| **TiTiler (Local)**   | Yes (Docker)   | Medium     | COG-focused          |
| **Client-side COG**   | No!            | Low        | Small files (<500MB) |
| **Static Tiles**      | No!            | Low        | Pre-generated tiles  |

---

## Option 1: GeoServer Local (Already Set Up)

```powershell
cd frontends/geoserver-local
docker-compose up -d
```

- Access: http://localhost:8080/geoserver
- Credentials: admin / geoserver

---

## Option 2: TiTiler Local (Simpler, COG-focused)

TiTiler is lighter than GeoServer and works directly with Cloud-Optimized GeoTIFFs.

### Setup

```powershell
# Create docker-compose for TiTiler
cd frontends/titiler-local
docker-compose up -d
```

### docker-compose.yml for TiTiler

```yaml
version: "3.8"
services:
  titiler:
    image: ghcr.io/developmentseed/titiler:latest
    container_name: agripay-titiler
    ports:
      - "8000:8000"
    environment:
      - CPL_VSIL_CURL_ALLOWED_EXTENSIONS=.tif,.TIF,.tiff,.TIFF
      - GDAL_CACHEMAX=200
      - GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR
      - GDAL_HTTP_MERGE_CONSECUTIVE_RANGES=YES
      - GDAL_HTTP_MULTIPLEX=YES
      - VSI_CACHE=TRUE
      - VSI_CACHE_SIZE=5000000
    volumes:
      - ./imagery:/data
    restart: unless-stopped
```

### Usage

```javascript
// In React - get tiles from local COG
const cogUrl =
  "http://localhost:8000/cog/tiles/{z}/{x}/{y}?url=file:///data/farm_ndvi.tif";

// With colormap
const ndviUrl =
  "http://localhost:8000/cog/tiles/{z}/{x}/{y}?url=file:///data/farm_ndvi.tif&colormap_name=rdylgn&rescale=-1,1";
```

---

## Option 3: Client-Side COG Rendering (NO SERVER!) ⭐ Simplest

This uses **GeoTIFF.js** and **Leaflet** to render COGs directly in the browser!

### Install Dependencies

```bash
npm install geotiff georaster georaster-layer-for-leaflet
```

### Component

```jsx
// src/COGLayer.jsx
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import GeoRasterLayer from "georaster-layer-for-leaflet";
import parseGeoraster from "georaster";

const COGLayer = ({ url, colorScale = "ndvi" }) => {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    const loadCOG = async () => {
      try {
        // Remove existing layer
        if (layerRef.current) {
          map.removeLayer(layerRef.current);
        }

        // Parse the GeoTIFF
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const georaster = await parseGeoraster(arrayBuffer);

        // Create color function for NDVI
        const colorFn = (value) => {
          if (value === null || isNaN(value)) return null;

          // NDVI color scale: red (low) → yellow → green (high)
          if (value < -0.2) return "#0000FF"; // Water
          if (value < 0) return "#d73027"; // Bare
          if (value < 0.1) return "#fc8d59"; // Very sparse
          if (value < 0.2) return "#fee08b"; // Sparse
          if (value < 0.4) return "#d9ef8b"; // Light
          if (value < 0.6) return "#91cf60"; // Moderate
          if (value < 0.8) return "#1a9850"; // Dense
          return "#006837"; // Very dense
        };

        // Create the layer
        const layer = new GeoRasterLayer({
          georaster,
          opacity: 0.8,
          pixelValuesToColorFn: (values) => {
            const value = values[0];
            return colorFn(value);
          },
          resolution: 256,
        });

        layer.addTo(map);
        layerRef.current = layer;

        // Fit bounds
        map.fitBounds(layer.getBounds());
      } catch (error) {
        console.error("Error loading COG:", error);
      }
    };

    if (url) {
      loadCOG();
    }

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
      }
    };
  }, [url, map, colorScale]);

  return null;
};

export default COGLayer;
```

### Usage

```jsx
import COGLayer from "./COGLayer";

// In your map component
<MapContainer center={[31.5, 74.3]} zoom={13}>
  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

  {/* Load COG from local file or URL */}
  <COGLayer url="/imagery/farm_ndvi.tif" />
</MapContainer>;
```

### Serve Local Files

For development, serve your GeoTIFFs from the `public` folder:

```
frontends/
├── public/
│   └── imagery/
│       ├── farm1_ndvi.tif
│       ├── farm1_rgb.tif
│       └── ...
```

Then access as: `<COGLayer url="/imagery/farm1_ndvi.tif" />`

---

## Option 4: Pre-Generated Static Tiles (NO SERVER!)

Convert your GeoTIFF to static PNG tiles once, then serve from anywhere.

### Generate Tiles (One-time)

```bash
# Install GDAL (Windows - use OSGeo4W installer)
# Or use Docker:
docker run --rm -v ${PWD}:/data osgeo/gdal:latest \
  gdal2tiles.py -z 10-18 -w none /data/farm_ndvi.tif /data/tiles/ndvi/
```

This creates:

```
tiles/
└── ndvi/
    ├── 10/
    │   └── 512/
    │       └── 384.png
    ├── 11/
    ├── 12/
    ...
```

### Use in Leaflet

```jsx
// Static tiles - no server needed!
<TileLayer
  url="/tiles/ndvi/{z}/{x}/{y}.png"
  opacity={0.8}
  bounds={[
    [lat1, lng1],
    [lat2, lng2],
  ]}
/>
```

### Host for Free

- Put tiles in `public/tiles/` folder
- Or upload to Cloudflare R2 (free 10GB)
- Or GitHub Pages (free)

---

## Recommendation for Testing

### For Quick Testing (TODAY):

Use **Option 3: Client-Side COG**

- No server setup
- Just put GeoTIFF in `public/` folder
- Works immediately

### For Production:

Use **GeoServer Local** now → migrate to cloud VPS later

---

## Converting Images to COG

If your drone provider gives you regular GeoTIFFs, convert to COG for better performance:

```bash
# Using Docker (no install needed)
docker run --rm -v ${PWD}:/data osgeo/gdal:latest \
  gdal_translate /data/input.tif /data/output_cog.tif \
  -of COG \
  -co COMPRESS=LZW \
  -co OVERVIEW_RESAMPLING=AVERAGE
```

---

## Storage Costs

| Storage          | Free Tier | Cost After   |
| ---------------- | --------- | ------------ |
| Local disk       | ∞         | $0           |
| Supabase Storage | 1GB       | $0.02/GB     |
| Cloudflare R2    | 10GB      | $0.015/GB    |
| GitHub LFS       | 1GB       | $5/50GB pack |

For testing: Just use local disk - **completely free!**
