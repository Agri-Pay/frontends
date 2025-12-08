# Local GeoServer Setup (100% Free)

## Quick Start

### 1. Start GeoServer

```powershell
cd geoserver-local
docker-compose up -d
```

### 2. Access GeoServer

- URL: http://localhost:8080/geoserver
- Username: `admin`
- Password: `geoserver`

### 3. Initial Setup (One-time)

1. **Create Workspace**

   - Go to: Workspaces → Add new workspace
   - Name: `agripay`
   - Namespace URI: `http://agripay.local`
   - Check "Default Workspace"
   - Save

2. **Add NDVI Style**
   - Go to: Styles → Add new style
   - Name: `ndvi_ramp`
   - Workspace: `agripay`
   - Format: `SLD`
   - Paste the content from `ndvi_style.sld` (included below)
   - Validate → Save

### 4. Add Your First Raster

1. Put your GeoTIFF in `./processed-imagery/` folder
2. In GeoServer:
   - Stores → Add new Store → GeoTIFF
   - Workspace: `agripay`
   - Store name: `farm1_ndvi`
   - URL: `file:coverages/your_file.tif`
   - Save → Publish
   - Set SRS to `EPSG:4326`
   - Compute bounding boxes
   - Save

### 5. Test WMS

Open in browser:

```
http://localhost:8080/geoserver/agripay/wms?service=WMS&version=1.1.0&request=GetMap&layers=agripay:your_layer&bbox=MINX,MINY,MAXX,MAXY&width=512&height=512&srs=EPSG:4326&format=image/png
```

### 6. Stop GeoServer

```powershell
docker-compose down
```

## Folder Structure

```
geoserver-local/
├── docker-compose.yml
├── geoserver-data/         # Auto-created, GeoServer config
├── processed-imagery/      # Put your GeoTIFFs here
│   ├── farm1_ndvi.tif
│   ├── farm1_rgb.tif
│   └── ...
└── raw-imagery/            # Original files from provider
```

## Frontend .env

```env
VITE_GEOSERVER_URL=http://localhost:8080/geoserver
```

## CORS Note

GeoServer allows all origins by default in dev. If you have issues, check:
Settings → Global → Enable CORS
