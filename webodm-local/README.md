# WebODM Local Setup - Drone Image Processing

This folder contains a Docker-based WebODM setup for processing raw drone images into orthomosaics and vegetation indices (NDVI, etc.).

## What is WebODM?

WebODM is a free, open-source web interface for OpenDroneMap. It processes raw drone photos into:

- **Orthomosaics** - Stitched, georeferenced aerial maps
- **NDVI/NDRE** - Vegetation index maps (from multispectral cameras)
- **DSM/DTM** - Digital surface/terrain models
- **3D Models** - Point clouds and textured meshes

## Quick Start

### 1. Start WebODM

```powershell
cd frontends/webodm-local
docker-compose up -d
```

⚠️ **First run will take 10-15 minutes** to download ~8GB of images.

### 2. Access WebODM

Open: http://localhost:8080

Default credentials:

- Username: `admin`
- Password: `admin`

### 3. Create a Processing Task

1. Click **"Add Project"**
2. Click **"Select Images and GCP"**
3. Upload your raw drone images (JPG/TIFF)
4. Click **"Review"** → **"Start Processing"**

### 4. Download Results

After processing completes:

1. Click on the task
2. Download **Orthophoto** (GeoTIFF)
3. If multispectral, download **Plant Health** outputs

## System Requirements

| Resource | Minimum      | Recommended       |
| -------- | ------------ | ----------------- |
| RAM      | 8 GB         | 16+ GB            |
| CPU      | 4 cores      | 8+ cores          |
| Storage  | 50 GB free   | 100+ GB SSD       |
| GPU      | Not required | NVIDIA (optional) |

## Processing Times

| Images  | Typical Time |
| ------- | ------------ |
| 50-100  | 15-30 min    |
| 100-200 | 30-60 min    |
| 200-500 | 1-3 hours    |
| 500+    | 3+ hours     |

## API Integration

WebODM exposes a REST API for automation:

```javascript
// Create a task
POST http://localhost:8080/api/projects/{id}/tasks/

// Check task status
GET http://localhost:8080/api/projects/{id}/tasks/{taskId}/

// Download orthophoto
GET http://localhost:8080/api/projects/{id}/tasks/{taskId}/download/orthophoto.tif
```

See `src/webodmService.js` for the full API wrapper.

## Processing Options

For vegetation analysis, use these recommended settings:

| Option                    | Value  | Purpose                |
| ------------------------- | ------ | ---------------------- |
| `dsm`                     | true   | Generate surface model |
| `orthophoto-resolution`   | 2      | 2cm/pixel resolution   |
| `auto-boundary`           | true   | Auto-detect boundary   |
| `radiometric-calibration` | camera | For multispectral      |

## Multispectral Processing

If your drone has a multispectral camera (e.g., DJI Mavic 3M, MicaSense):

1. Upload all band images together
2. Enable **"Radiometric Calibration"**
3. WebODM will automatically generate:
   - NDVI (Normalized Difference Vegetation Index)
   - NDRE (Red-Edge index)
   - Plant health maps

## Troubleshooting

### Out of Memory

```yaml
# In docker-compose.yml, increase memory:
services:
  node-odm:
    deploy:
      resources:
        limits:
          memory: 16G
```

### Slow Processing

- Use an SSD for the data volume
- Reduce `orthophoto-resolution` (e.g., 5 instead of 2)
- Process fewer images per task

### WebODM Not Starting

```powershell
# Check container status
docker-compose ps

# View logs
docker-compose logs -f

# Restart
docker-compose restart
```

## File Structure

```
webodm-local/
├── docker-compose.yml    # Docker configuration
├── README.md             # This file
├── data/                 # Persistent data (auto-created)
│   ├── media/           # Uploaded images
│   └── processing/      # Temporary processing files
└── output/              # Processed outputs (GeoTIFFs)
```
