# TiTiler Local Setup - Free Drone Imagery Server

## What is TiTiler?

TiTiler is a lightweight, modern tile server that serves Cloud-Optimized GeoTIFFs (COGs) dynamically. It's simpler than GeoServer and perfect for drone imagery.

## Quick Start

### 1. Start TiTiler

```powershell
cd frontends/titiler-local
docker-compose up -d
```

### 2. Verify it's Running

Open: http://localhost:8000/docs

You'll see the Swagger API documentation.

### 3. Add Your Imagery

Put your GeoTIFF files in the `./imagery` folder:

```
titiler-local/
└── imagery/
    ├── farm1_ndvi.tif
    ├── farm1_rgb.tif
    ├── farm1_moisture.tif
    └── ...
```

### 4. Test the API

**Get file info:**

```
http://localhost:8000/cog/info?url=file:///data/farm1_ndvi.tif
```

**Get bounds:**

```
http://localhost:8000/cog/bounds?url=file:///data/farm1_ndvi.tif
```

**Get a tile (z/x/y):**

```
http://localhost:8000/cog/tiles/15/16383/12287?url=file:///data/farm1_ndvi.tif
```

**Get tile with NDVI colormap:**

```
http://localhost:8000/cog/tiles/15/16383/12287?url=file:///data/farm1_ndvi.tif&colormap_name=rdylgn&rescale=-1,1
```

### 5. Stop TiTiler

```powershell
docker-compose down
```

---

## Available Colormaps

TiTiler has built-in colormaps perfect for vegetation indices:

| Colormap   | Best For                |
| ---------- | ----------------------- |
| `rdylgn`   | NDVI (red-yellow-green) |
| `rdylgn_r` | NDVI reversed           |
| `viridis`  | General purpose         |
| `plasma`   | Thermal                 |
| `blues`    | Moisture                |
| `greens`   | Vegetation density      |
| `inferno`  | Temperature             |

Usage: `&colormap_name=rdylgn&rescale=-1,1`

---

## Frontend Integration

Add to your `.env`:

```env
VITE_TITILER_URL=http://localhost:8000
```

---

## API Endpoints Reference

| Endpoint                 | Description           |
| ------------------------ | --------------------- |
| `/cog/info`              | Get raster metadata   |
| `/cog/bounds`            | Get geographic bounds |
| `/cog/statistics`        | Get band statistics   |
| `/cog/tiles/{z}/{x}/{y}` | Get XYZ tiles         |
| `/cog/preview`           | Get preview image     |
| `/cog/point/{lon}/{lat}` | Get value at point    |

Full docs: http://localhost:8000/docs

---

## Converting to COG (Optional but Recommended)

If your files aren't already COGs, convert them for better performance:

```powershell
# Using Docker (no install needed)
docker run --rm -v ${PWD}/imagery:/data osgeo/gdal:latest gdal_translate /data/input.tif /data/output_cog.tif -of COG -co COMPRESS=LZW
```

---

## Troubleshooting

**"File not found" error:**

- Make sure file is in `./imagery` folder
- URL must use `file:///data/filename.tif` (note triple slash)

**CORS errors:**

- Already configured in docker-compose
- If issues persist, check browser console

**Slow tiles:**

- Convert to COG format (see above)
- Reduce file size by compressing

---

## Database Integration

Run the Supabase migration to create drone imagery tables:

```sql
-- See: supabase/migrations/20241208_drone_imagery.sql
```

Tables:

- `drone_flights` - Flight metadata (date, pilot, drone model, altitude)
- `drone_imagery_layers` - Layer info per flight (filename, statistics, bounds)

### File Naming Convention

```
{farmId}_{YYYYMMDD}_{layer}.tif
```

Examples:

- `farm123_20241208_rgb.tif` - True color
- `farm123_20241208_ndvi.tif` - Vegetation index
- `farm123_20241208_moisture.tif` - Water stress

---

## Testing

Run the PowerShell test script:

```powershell
.\test-titiler.ps1
```

This will verify:

1. TiTiler server health
2. API endpoints
3. GeoTIFF files in imagery folder
4. COG tile serving
