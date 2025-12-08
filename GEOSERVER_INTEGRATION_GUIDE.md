# Complete GeoServer Integration Guide for AgriPay

## 📋 Overview

This guide covers the **end-to-end workflow** for:

1. Pulling drone imagery from Google Drive/OneDrive
2. Processing images (ortho-mosaic, NDVI calculation, COG conversion)
3. Publishing to GeoServer
4. Displaying in your React/Leaflet frontend

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           COMPLETE ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌─────────────────────────────┐  │
│  │Google Drive  │     │  OneDrive    │     │   Drone Provider Portal    │  │
│  │   Folder     │     │   Folder     │     │   (Alternative)            │  │
│  └──────┬───────┘     └──────┬───────┘     └─────────────┬───────────────┘  │
│         │                    │                           │                   │
│         └────────────────────┼───────────────────────────┘                   │
│                              ▼                                               │
│                    ┌─────────────────┐                                       │
│                    │  Pull Service   │  (Node.js/Python)                     │
│                    │  (Scheduled)    │                                       │
│                    └────────┬────────┘                                       │
│                             │                                                │
│                             ▼                                                │
│                    ┌─────────────────┐                                       │
│                    │  Raw Storage    │  (Local disk / S3 / Supabase)         │
│                    │  /raw-imagery/  │                                       │
│                    └────────┬────────┘                                       │
│                             │                                                │
│                             ▼                                                │
│                    ┌─────────────────┐                                       │
│                    │  Processing     │  (GDAL / Rasterio / ODM)              │
│                    │  Pipeline       │                                       │
│                    │  - Ortho-mosaic │                                       │
│                    │  - NDVI calc    │                                       │
│                    │  - COG convert  │                                       │
│                    └────────┬────────┘                                       │
│                             │                                                │
│                             ▼                                                │
│                    ┌─────────────────┐                                       │
│                    │  GeoServer      │                                       │
│                    │  Data Directory │                                       │
│                    │  /geoserver/    │                                       │
│                    └────────┬────────┘                                       │
│                             │                                                │
│                             ▼                                                │
│                    ┌─────────────────┐                                       │
│                    │   GeoServer     │  (WMS/WMTS/WCS)                       │
│                    │   :8080         │                                       │
│                    └────────┬────────┘                                       │
│                             │                                                │
│                             ▼                                                │
│                    ┌─────────────────┐                                       │
│                    │  React Frontend │  (Leaflet WMS Layer)                  │
│                    │  AgriPay        │                                       │
│                    └─────────────────┘                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Part 1: Server Setup

### 1.1 Prerequisites

You'll need a server (VPS/VM) with:

- **OS**: Ubuntu 22.04 LTS (recommended)
- **RAM**: Minimum 4GB, recommended 8GB+
- **Storage**: 100GB+ SSD
- **Ports**: 8080 (GeoServer), 80/443 (Nginx)

**Recommended VPS Providers:**
| Provider | Specs | Cost/month |
|----------|-------|------------|
| DigitalOcean | 4GB RAM, 80GB SSD | $24 |
| Hetzner | 8GB RAM, 160GB SSD | €15 (~$16) |
| Vultr | 4GB RAM, 80GB SSD | $24 |
| AWS Lightsail | 4GB RAM, 80GB SSD | $20 |

### 1.2 Install Docker & Docker Compose

```bash
# SSH into your server
ssh root@your-server-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Verify installation
docker --version
docker compose version
```

### 1.3 Create Project Directory Structure

```bash
# Create directory structure
mkdir -p /opt/agripay-gis/{geoserver-data,raw-imagery,processed,scripts,logs}
cd /opt/agripay-gis

# Set permissions
chmod -R 755 /opt/agripay-gis
```

### 1.4 Docker Compose for GeoServer

Create `/opt/agripay-gis/docker-compose.yml`:

```yaml
version: "3.8"

services:
  geoserver:
    image: kartoza/geoserver:2.24.0
    container_name: agripay-geoserver
    restart: always
    ports:
      - "8080:8080"
    environment:
      - GEOSERVER_ADMIN_USER=admin
      - GEOSERVER_ADMIN_PASSWORD=your_secure_password_here
      - INITIAL_MEMORY=2G
      - MAXIMUM_MEMORY=4G
      - STABLE_EXTENSIONS=wps,csw
      - COMMUNITY_EXTENSIONS=cog
      - GEOSERVER_DATA_DIR=/opt/geoserver/data_dir
    volumes:
      - ./geoserver-data:/opt/geoserver/data_dir
      - ./processed:/opt/geoserver/data_dir/coverages
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/geoserver/web/"]
      interval: 30s
      timeout: 10s
      retries: 5

  # Optional: Nginx reverse proxy with SSL
  nginx:
    image: nginx:alpine
    container_name: agripay-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - geoserver

volumes:
  geoserver-data:
```

### 1.5 Nginx Configuration (Optional but Recommended)

Create `/opt/agripay-gis/nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream geoserver {
        server geoserver:8080;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=geoserver_limit:10m rate=30r/s;

    server {
        listen 80;
        server_name gis.yourdomain.com;

        # CORS headers for your frontend
        add_header 'Access-Control-Allow-Origin' 'https://your-agripay-domain.com' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type' always;

        location / {
            limit_req zone=geoserver_limit burst=50 nodelay;

            proxy_pass http://geoserver;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # Caching for tile requests
            proxy_cache_valid 200 1h;
        }
    }
}
```

### 1.6 Start GeoServer

```bash
cd /opt/agripay-gis
docker compose up -d

# Check logs
docker compose logs -f geoserver

# Verify GeoServer is running
curl http://localhost:8080/geoserver/web/
```

**Access GeoServer UI**: `http://your-server-ip:8080/geoserver`

- Username: `admin`
- Password: (the one you set in docker-compose.yml)

---

## 📥 Part 2: Pulling Imagery from Google Drive / OneDrive

### 2.1 Google Drive Setup

#### Step 1: Create Google Cloud Project & Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project: "AgriPay-GIS"
3. Enable the **Google Drive API**:
   - APIs & Services → Enable APIs → Search "Google Drive API" → Enable
4. Create Service Account:
   - APIs & Services → Credentials → Create Credentials → Service Account
   - Name: "agripay-drive-sync"
   - Download the JSON key file

#### Step 2: Share Drive Folder with Service Account

1. Get the service account email (looks like: `agripay-drive-sync@project.iam.gserviceaccount.com`)
2. In Google Drive, share the drone imagery folder with this email (Viewer access)

#### Step 3: Install rclone (Recommended Tool)

```bash
# Install rclone
curl https://rclone.org/install.sh | sudo bash

# Configure rclone for Google Drive
rclone config

# Follow prompts:
# n) New remote
# name> gdrive
# Storage> drive
# client_id> (leave blank or use your own)
# client_secret> (leave blank)
# scope> 1 (full access)
# service_account_file> /path/to/service-account-key.json
# root_folder_id> (folder ID from Drive URL)
```

### 2.2 OneDrive Setup

#### Step 1: Register Azure AD Application

1. Go to [Azure Portal](https://portal.azure.com/) → Azure Active Directory
2. App registrations → New registration
   - Name: "AgriPay-OneDrive-Sync"
   - Redirect URI: `http://localhost:53682/`
3. Note the **Application (client) ID**
4. Certificates & secrets → New client secret → Copy the value
5. API permissions → Add → Microsoft Graph → `Files.Read.All`

#### Step 2: Configure rclone for OneDrive

```bash
rclone config

# Follow prompts:
# n) New remote
# name> onedrive
# Storage> onedrive
# client_id> (your Azure app client ID)
# client_secret> (your Azure app secret)
# region> global
# Edit advanced config> n
# Use auto config> y (opens browser for auth)
```

### 2.3 Automated Sync Script

Create `/opt/agripay-gis/scripts/sync_imagery.sh`:

```bash
#!/bin/bash

# Configuration
LOG_FILE="/opt/agripay-gis/logs/sync_$(date +%Y%m%d).log"
RAW_DIR="/opt/agripay-gis/raw-imagery"
PROCESSED_DIR="/opt/agripay-gis/processed"

# Farm mappings (folder name → farm_id)
declare -A FARM_MAPPINGS=(
    ["Farm_GreenValley"]="farm_uuid_1"
    ["Farm_Sunrise"]="farm_uuid_2"
    # Add more mappings as needed
)

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Sync from Google Drive
sync_gdrive() {
    log "Starting Google Drive sync..."

    rclone sync gdrive:/DroneImagery "$RAW_DIR/gdrive" \
        --include "*.tif" \
        --include "*.tiff" \
        --include "*.TIF" \
        --include "*.TIFF" \
        --progress \
        --log-file="$LOG_FILE" \
        --log-level INFO

    log "Google Drive sync complete"
}

# Sync from OneDrive
sync_onedrive() {
    log "Starting OneDrive sync..."

    rclone sync onedrive:/DroneImagery "$RAW_DIR/onedrive" \
        --include "*.tif" \
        --include "*.tiff" \
        --include "*.TIF" \
        --include "*.TIFF" \
        --progress \
        --log-file="$LOG_FILE" \
        --log-level INFO

    log "OneDrive sync complete"
}

# Find new files that haven't been processed
find_new_files() {
    log "Scanning for new imagery files..."

    find "$RAW_DIR" -type f \( -name "*.tif" -o -name "*.tiff" -o -name "*.TIF" \) \
        -newer "$PROCESSED_DIR/.last_processed" 2>/dev/null || \
    find "$RAW_DIR" -type f \( -name "*.tif" -o -name "*.tiff" -o -name "*.TIF" \)
}

# Main execution
main() {
    log "=== Starting imagery sync ==="

    # Sync from both sources
    sync_gdrive
    sync_onedrive

    # List new files for processing
    NEW_FILES=$(find_new_files)

    if [ -n "$NEW_FILES" ]; then
        log "New files found:"
        echo "$NEW_FILES" | tee -a "$LOG_FILE"

        # Trigger processing
        python3 /opt/agripay-gis/scripts/process_imagery.py
    else
        log "No new files to process"
    fi

    log "=== Sync complete ==="
}

main "$@"
```

Make it executable:

```bash
chmod +x /opt/agripay-gis/scripts/sync_imagery.sh
```

### 2.4 Schedule Automatic Sync (Cron)

```bash
# Edit crontab
crontab -e

# Add these lines:
# Sync every 6 hours
0 */6 * * * /opt/agripay-gis/scripts/sync_imagery.sh >> /opt/agripay-gis/logs/cron.log 2>&1

# Or sync daily at 2 AM
0 2 * * * /opt/agripay-gis/scripts/sync_imagery.sh >> /opt/agripay-gis/logs/cron.log 2>&1
```

---

## 🔄 Part 3: Processing Pipeline

### 3.1 Install Processing Dependencies

```bash
# On the server
sudo apt install -y python3-pip python3-venv gdal-bin libgdal-dev

# Create virtual environment
cd /opt/agripay-gis
python3 -m venv venv
source venv/bin/activate

# Install Python packages
pip install rasterio rio-cogeo numpy requests python-dotenv psycopg2-binary
```

### 3.2 Processing Script

Create `/opt/agripay-gis/scripts/process_imagery.py`:

```python
#!/usr/bin/env python3
"""
Drone Imagery Processing Pipeline for AgriPay
Processes raw drone imagery → NDVI/indices → COG → GeoServer
"""

import os
import json
import logging
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, List
import requests
import numpy as np
import rasterio
from rasterio.enums import Resampling
from rio_cogeo.cogeo import cog_translate
from rio_cogeo.profiles import cog_profiles

# Configuration
CONFIG = {
    "raw_dir": "/opt/agripay-gis/raw-imagery",
    "processed_dir": "/opt/agripay-gis/processed",
    "geoserver_url": "http://localhost:8080/geoserver",
    "geoserver_user": "admin",
    "geoserver_password": os.getenv("GEOSERVER_PASSWORD", "your_password"),
    "workspace": "agripay",
    "supabase_url": os.getenv("SUPABASE_URL"),
    "supabase_key": os.getenv("SUPABASE_SERVICE_KEY"),
}

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/opt/agripay-gis/logs/processing.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class GeoServerManager:
    """Manage GeoServer REST API operations"""

    def __init__(self, url: str, user: str, password: str):
        self.url = url.rstrip('/')
        self.auth = (user, password)
        self.rest_url = f"{self.url}/rest"

    def create_workspace(self, name: str) -> bool:
        """Create a workspace if it doesn't exist"""
        url = f"{self.rest_url}/workspaces"

        # Check if exists
        r = requests.get(f"{url}/{name}", auth=self.auth)
        if r.status_code == 200:
            logger.info(f"Workspace '{name}' already exists")
            return True

        # Create workspace
        r = requests.post(
            url,
            json={"workspace": {"name": name}},
            auth=self.auth,
            headers={"Content-Type": "application/json"}
        )

        if r.status_code == 201:
            logger.info(f"Created workspace '{name}'")
            return True
        else:
            logger.error(f"Failed to create workspace: {r.text}")
            return False

    def create_coveragestore(self, workspace: str, store_name: str,
                             file_path: str) -> bool:
        """Create a coverage store from a GeoTIFF file"""
        url = f"{self.rest_url}/workspaces/{workspace}/coveragestores"

        # Check if exists
        r = requests.get(f"{url}/{store_name}", auth=self.auth)
        if r.status_code == 200:
            logger.info(f"Coverage store '{store_name}' already exists, updating...")
            # Delete and recreate
            requests.delete(
                f"{url}/{store_name}?recurse=true",
                auth=self.auth
            )

        # Create coverage store
        store_data = {
            "coverageStore": {
                "name": store_name,
                "workspace": workspace,
                "type": "GeoTIFF",
                "enabled": True,
                "url": f"file:{file_path}"
            }
        }

        r = requests.post(
            url,
            json=store_data,
            auth=self.auth,
            headers={"Content-Type": "application/json"}
        )

        if r.status_code == 201:
            logger.info(f"Created coverage store '{store_name}'")
            return True
        else:
            logger.error(f"Failed to create coverage store: {r.text}")
            return False

    def publish_coverage(self, workspace: str, store_name: str,
                         coverage_name: str, title: str,
                         srs: str = "EPSG:4326") -> bool:
        """Publish a coverage (layer) from a coverage store"""
        url = f"{self.rest_url}/workspaces/{workspace}/coveragestores/{store_name}/coverages"

        coverage_data = {
            "coverage": {
                "name": coverage_name,
                "title": title,
                "nativeCRS": srs,
                "srs": srs,
                "enabled": True,
                "projectionPolicy": "REPROJECT_TO_DECLARED"
            }
        }

        r = requests.post(
            url,
            json=coverage_data,
            auth=self.auth,
            headers={"Content-Type": "application/json"}
        )

        if r.status_code == 201:
            logger.info(f"Published coverage '{coverage_name}'")
            return True
        else:
            logger.error(f"Failed to publish coverage: {r.text}")
            return False

    def apply_style(self, workspace: str, layer_name: str,
                    style_name: str) -> bool:
        """Apply a style to a layer"""
        url = f"{self.rest_url}/layers/{workspace}:{layer_name}"

        layer_data = {
            "layer": {
                "defaultStyle": {
                    "name": style_name
                }
            }
        }

        r = requests.put(
            url,
            json=layer_data,
            auth=self.auth,
            headers={"Content-Type": "application/json"}
        )

        return r.status_code == 200


class ImageProcessor:
    """Process drone imagery: calculate indices, convert to COG"""

    def __init__(self, output_dir: str):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def detect_bands(self, src) -> Dict[str, int]:
        """Detect band configuration from raster metadata"""
        band_count = src.count

        # Common band configurations
        if band_count == 4:
            # Assume RGBNIR (common for agriculture drones)
            return {"red": 1, "green": 2, "blue": 3, "nir": 4}
        elif band_count == 5:
            # Blue, Green, Red, RedEdge, NIR (MicaSense etc.)
            return {"blue": 1, "green": 2, "red": 3, "rededge": 4, "nir": 5}
        elif band_count == 3:
            # RGB only
            return {"red": 1, "green": 2, "blue": 3}
        elif band_count == 1:
            # Already processed single band
            return {"single": 1}
        else:
            logger.warning(f"Unknown band count: {band_count}")
            return {}

    def calculate_ndvi(self, nir: np.ndarray, red: np.ndarray) -> np.ndarray:
        """Calculate NDVI: (NIR - Red) / (NIR + Red)"""
        np.seterr(divide='ignore', invalid='ignore')
        ndvi = (nir.astype(float) - red.astype(float)) / \
               (nir.astype(float) + red.astype(float) + 1e-10)
        ndvi = np.clip(ndvi, -1, 1)
        return ndvi.astype(np.float32)

    def calculate_ndre(self, nir: np.ndarray, rededge: np.ndarray) -> np.ndarray:
        """Calculate NDRE: (NIR - RedEdge) / (NIR + RedEdge)"""
        np.seterr(divide='ignore', invalid='ignore')
        ndre = (nir.astype(float) - rededge.astype(float)) / \
               (nir.astype(float) + rededge.astype(float) + 1e-10)
        ndre = np.clip(ndre, -1, 1)
        return ndre.astype(np.float32)

    def calculate_gndvi(self, nir: np.ndarray, green: np.ndarray) -> np.ndarray:
        """Calculate GNDVI: (NIR - Green) / (NIR + Green)"""
        np.seterr(divide='ignore', invalid='ignore')
        gndvi = (nir.astype(float) - green.astype(float)) / \
                (nir.astype(float) + green.astype(float) + 1e-10)
        gndvi = np.clip(gndvi, -1, 1)
        return gndvi.astype(np.float32)

    def convert_to_cog(self, input_path: str, output_path: str) -> bool:
        """Convert a GeoTIFF to Cloud-Optimized GeoTIFF"""
        try:
            output_profile = cog_profiles.get("deflate")
            cog_translate(
                input_path,
                output_path,
                output_profile,
                overview_level=6,
                overview_resampling="average"
            )
            logger.info(f"Created COG: {output_path}")
            return True
        except Exception as e:
            logger.error(f"COG conversion failed: {e}")
            return False

    def process_multispectral(self, input_path: str, farm_id: str,
                               flight_date: str) -> Dict[str, str]:
        """Process multispectral drone image and generate indices"""
        outputs = {}
        base_name = f"{farm_id}_{flight_date}"

        with rasterio.open(input_path) as src:
            bands = self.detect_bands(src)
            profile = src.profile.copy()
            profile.update(count=1, dtype='float32', compress='deflate')

            # Get bounds for metadata
            bounds = list(src.bounds)

            if 'nir' not in bands:
                logger.warning(f"No NIR band detected in {input_path}, skipping index calculation")
                # Just copy as RGB COG
                rgb_output = str(self.output_dir / f"{base_name}_rgb.tif")
                self.convert_to_cog(input_path, rgb_output)
                outputs['rgb'] = rgb_output
                return outputs

            # Read required bands
            nir = src.read(bands['nir'])
            red = src.read(bands['red'])
            green = src.read(bands['green'])

            # Calculate and save NDVI
            ndvi = self.calculate_ndvi(nir, red)
            ndvi_temp = str(self.output_dir / f"{base_name}_ndvi_temp.tif")
            ndvi_output = str(self.output_dir / f"{base_name}_ndvi.tif")

            with rasterio.open(ndvi_temp, 'w', **profile) as dst:
                dst.write(ndvi, 1)

            self.convert_to_cog(ndvi_temp, ndvi_output)
            os.remove(ndvi_temp)
            outputs['ndvi'] = ndvi_output

            # Calculate and save GNDVI
            gndvi = self.calculate_gndvi(nir, green)
            gndvi_temp = str(self.output_dir / f"{base_name}_gndvi_temp.tif")
            gndvi_output = str(self.output_dir / f"{base_name}_gndvi.tif")

            with rasterio.open(gndvi_temp, 'w', **profile) as dst:
                dst.write(gndvi, 1)

            self.convert_to_cog(gndvi_temp, gndvi_output)
            os.remove(gndvi_temp)
            outputs['gndvi'] = gndvi_output

            # Calculate NDRE if RedEdge band available
            if 'rededge' in bands:
                rededge = src.read(bands['rededge'])
                ndre = self.calculate_ndre(nir, rededge)
                ndre_temp = str(self.output_dir / f"{base_name}_ndre_temp.tif")
                ndre_output = str(self.output_dir / f"{base_name}_ndre.tif")

                with rasterio.open(ndre_temp, 'w', **profile) as dst:
                    dst.write(ndre, 1)

                self.convert_to_cog(ndre_temp, ndre_output)
                os.remove(ndre_temp)
                outputs['ndre'] = ndre_output

            # Create RGB COG
            rgb_output = str(self.output_dir / f"{base_name}_rgb.tif")
            self.convert_to_cog(input_path, rgb_output)
            outputs['rgb'] = rgb_output

        return outputs

    def get_raster_stats(self, file_path: str) -> Dict:
        """Get statistics from a raster file"""
        with rasterio.open(file_path) as src:
            data = src.read(1, masked=True)
            bounds = list(src.bounds)

            return {
                "min": float(np.nanmin(data)),
                "max": float(np.nanmax(data)),
                "mean": float(np.nanmean(data)),
                "std": float(np.nanstd(data)),
                "bounds": bounds,
                "crs": str(src.crs),
                "width": src.width,
                "height": src.height
            }


def process_new_imagery():
    """Main processing function"""
    raw_dir = Path(CONFIG['raw_dir'])
    processed_dir = Path(CONFIG['processed_dir'])
    marker_file = processed_dir / ".last_processed"

    # Initialize components
    processor = ImageProcessor(str(processed_dir))
    geoserver = GeoServerManager(
        CONFIG['geoserver_url'],
        CONFIG['geoserver_user'],
        CONFIG['geoserver_password']
    )

    # Ensure workspace exists
    geoserver.create_workspace(CONFIG['workspace'])

    # Find files to process
    last_processed = None
    if marker_file.exists():
        last_processed = marker_file.stat().st_mtime

    tif_files = list(raw_dir.rglob("*.tif")) + list(raw_dir.rglob("*.tiff"))

    for tif_path in tif_files:
        if last_processed and tif_path.stat().st_mtime <= last_processed:
            continue

        logger.info(f"Processing: {tif_path}")

        # Extract farm_id from folder structure
        # Expected: /raw-imagery/gdrive/FarmName/date/file.tif
        parts = tif_path.parts
        try:
            farm_name = parts[-3] if len(parts) >= 3 else "unknown"
            flight_date = parts[-2] if len(parts) >= 2 else datetime.now().strftime("%Y%m%d")
        except:
            farm_name = "unknown"
            flight_date = datetime.now().strftime("%Y%m%d")

        # Clean names for GeoServer
        farm_id = farm_name.replace(" ", "_").replace("-", "_").lower()

        try:
            # Process imagery
            outputs = processor.process_multispectral(
                str(tif_path),
                farm_id,
                flight_date
            )

            # Publish to GeoServer
            for layer_type, output_path in outputs.items():
                store_name = f"{farm_id}_{flight_date}_{layer_type}"
                coverage_name = store_name
                title = f"{farm_name} - {layer_type.upper()} - {flight_date}"

                # Create coverage store
                geoserver.create_coveragestore(
                    CONFIG['workspace'],
                    store_name,
                    output_path
                )

                # Publish the coverage
                geoserver.publish_coverage(
                    CONFIG['workspace'],
                    store_name,
                    coverage_name,
                    title
                )

                # Apply style based on layer type
                if layer_type in ['ndvi', 'ndre', 'gndvi']:
                    geoserver.apply_style(
                        CONFIG['workspace'],
                        coverage_name,
                        f"{layer_type}_ramp"  # Requires pre-created styles
                    )

                logger.info(f"Published layer: {CONFIG['workspace']}:{coverage_name}")

            # Update database (optional)
            # update_database(farm_id, flight_date, outputs)

        except Exception as e:
            logger.error(f"Failed to process {tif_path}: {e}")
            continue

    # Update marker file
    marker_file.touch()
    logger.info("Processing complete")


if __name__ == "__main__":
    process_new_imagery()
```

Make it executable:

```bash
chmod +x /opt/agripay-gis/scripts/process_imagery.py
```

### 3.3 GeoServer Styles for NDVI Color Ramps

Create NDVI style in GeoServer:

1. Go to GeoServer UI → Styles → Add new style
2. Name: `ndvi_ramp`
3. Workspace: `agripay`
4. Format: `SLD`
5. Paste this SLD:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
  xmlns="http://www.opengis.net/sld"
  xmlns:ogc="http://www.opengis.net/ogc"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <NamedLayer>
    <Name>NDVI Color Ramp</Name>
    <UserStyle>
      <Title>NDVI Visualization</Title>
      <FeatureTypeStyle>
        <Rule>
          <RasterSymbolizer>
            <ColorMap type="ramp">
              <ColorMapEntry color="#d73027" quantity="-1" label="Water/Bare"/>
              <ColorMapEntry color="#fc8d59" quantity="-0.2" label="Bare Soil"/>
              <ColorMapEntry color="#fee08b" quantity="0" label="Sparse"/>
              <ColorMapEntry color="#d9ef8b" quantity="0.2" label="Light Veg"/>
              <ColorMapEntry color="#91cf60" quantity="0.4" label="Moderate"/>
              <ColorMapEntry color="#1a9850" quantity="0.6" label="Dense"/>
              <ColorMapEntry color="#006837" quantity="1" label="Very Dense"/>
            </ColorMap>
          </RasterSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
```

---

## 🖥️ Part 4: Frontend Integration

### 4.1 Create GeoServer Service

Create `/src/geoserver.js` in your React project:

```javascript
// src/geoserver.js
/**
 * GeoServer integration for drone imagery layers
 */

const GEOSERVER_URL =
  import.meta.env.VITE_GEOSERVER_URL || "http://localhost:8080/geoserver";
const WORKSPACE = "agripay";

/**
 * Get WMS tile layer URL for Leaflet
 */
export const getWMSLayerUrl = () => {
  return `${GEOSERVER_URL}/wms`;
};

/**
 * Fetch available drone imagery layers for a farm
 */
export const getDroneLayersForFarm = async (farmId) => {
  try {
    const response = await fetch(
      `${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/coverages.json`,
      {
        headers: {
          Authorization: "Basic " + btoa("public:public"), // Or use your auth
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch layers");
    }

    const data = await response.json();
    const layers = data.coverages?.coverage || [];

    // Filter layers for this farm
    const farmLayers = layers.filter((layer) =>
      layer.name.toLowerCase().includes(farmId.toLowerCase())
    );

    return farmLayers.map((layer) => ({
      name: layer.name,
      href: layer.href,
      wmsLayer: `${WORKSPACE}:${layer.name}`,
    }));
  } catch (error) {
    console.error("Error fetching drone layers:", error);
    return [];
  }
};

/**
 * Get layer capabilities/metadata
 */
export const getLayerInfo = async (layerName) => {
  try {
    const response = await fetch(
      `${GEOSERVER_URL}/rest/workspaces/${WORKSPACE}/coverages/${layerName}.json`,
      {
        headers: {
          Authorization: "Basic " + btoa("public:public"),
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return {
      name: data.coverage.name,
      title: data.coverage.title,
      bounds: data.coverage.latLonBoundingBox,
      nativeCRS: data.coverage.nativeCRS,
    };
  } catch (error) {
    console.error("Error fetching layer info:", error);
    return null;
  }
};

/**
 * Build WMS parameters for Leaflet
 */
export const buildWMSParams = (layerName, options = {}) => {
  return {
    layers: `${WORKSPACE}:${layerName}`,
    format: "image/png",
    transparent: true,
    version: "1.1.1",
    styles: options.style || "",
    ...options,
  };
};

/**
 * Get legend graphic URL
 */
export const getLegendUrl = (layerName, style = "") => {
  const params = new URLSearchParams({
    REQUEST: "GetLegendGraphic",
    VERSION: "1.0.0",
    FORMAT: "image/png",
    LAYER: `${WORKSPACE}:${layerName}`,
    STYLE: style,
    WIDTH: "20",
    HEIGHT: "20",
  });

  return `${GEOSERVER_URL}/wms?${params.toString()}`;
};
```

### 4.2 Drone Imagery Layer Component

Create `/src/DroneImageryLayer.jsx`:

```jsx
// src/DroneImageryLayer.jsx
import React, { useState, useEffect } from "react";
import { WMSTileLayer, useMap } from "react-leaflet";
import { getDroneLayersForFarm, getLayerInfo, getLegendUrl } from "./geoserver";
import "./droneimagery.css";

const LAYER_TYPES = [
  { id: "rgb", name: "True Color", style: "" },
  { id: "ndvi", name: "NDVI", style: "ndvi_ramp" },
  { id: "ndre", name: "NDRE", style: "ndvi_ramp" },
  { id: "gndvi", name: "GNDVI", style: "ndvi_ramp" },
];

const GEOSERVER_WMS_URL = import.meta.env.VITE_GEOSERVER_URL
  ? `${import.meta.env.VITE_GEOSERVER_URL}/wms`
  : "http://localhost:8080/geoserver/wms";

const DroneImageryLayer = ({ farmId, farmName }) => {
  const map = useMap();
  const [availableLayers, setAvailableLayers] = useState([]);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [activeLayerType, setActiveLayerType] = useState("rgb");
  const [opacity, setOpacity] = useState(0.8);
  const [loading, setLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(true);

  // Fetch available layers for this farm
  useEffect(() => {
    const fetchLayers = async () => {
      setLoading(true);
      try {
        const layers = await getDroneLayersForFarm(farmId);

        // Group by flight date
        const flights = {};
        layers.forEach((layer) => {
          // Parse layer name: farmid_date_type
          const parts = layer.name.split("_");
          const date = parts[parts.length - 2];
          const type = parts[parts.length - 1];

          if (!flights[date]) {
            flights[date] = { date, layers: {} };
          }
          flights[date].layers[type] = layer;
        });

        const flightList = Object.values(flights).sort((a, b) =>
          b.date.localeCompare(a.date)
        );

        setAvailableLayers(flightList);

        if (flightList.length > 0) {
          setSelectedFlight(flightList[0]);
        }
      } catch (error) {
        console.error("Error loading drone layers:", error);
      } finally {
        setLoading(false);
      }
    };

    if (farmId) {
      fetchLayers();
    }
  }, [farmId]);

  // Zoom to layer bounds when selected
  useEffect(() => {
    const zoomToLayer = async () => {
      if (!selectedFlight || !selectedFlight.layers[activeLayerType]) return;

      const layerName = selectedFlight.layers[activeLayerType].name;
      const info = await getLayerInfo(layerName);

      if (info?.bounds) {
        const { minx, miny, maxx, maxy } = info.bounds;
        map.fitBounds(
          [
            [miny, minx],
            [maxy, maxx],
          ],
          { padding: [20, 20] }
        );
      }
    };

    zoomToLayer();
  }, [selectedFlight, activeLayerType, map]);

  const getActiveLayerName = () => {
    if (!selectedFlight || !selectedFlight.layers[activeLayerType]) {
      return null;
    }
    return selectedFlight.layers[activeLayerType].name;
  };

  const getActiveStyle = () => {
    const layerConfig = LAYER_TYPES.find((l) => l.id === activeLayerType);
    return layerConfig?.style || "";
  };

  const formatDate = (dateStr) => {
    // Convert YYYYMMDD to readable format
    if (dateStr.length === 8) {
      const year = dateStr.slice(0, 4);
      const month = dateStr.slice(4, 6);
      const day = dateStr.slice(6, 8);
      return new Date(`${year}-${month}-${day}`).toLocaleDateString();
    }
    return dateStr;
  };

  const activeLayerName = getActiveLayerName();

  return (
    <>
      {/* WMS Layer */}
      {activeLayerName && (
        <WMSTileLayer
          url={GEOSERVER_WMS_URL}
          layers={`agripay:${activeLayerName}`}
          format="image/png"
          transparent={true}
          opacity={opacity}
          styles={getActiveStyle()}
          version="1.1.1"
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
        </div>

        {showPanel && (
          <div className="panel-content">
            {loading ? (
              <div className="loading">Loading drone imagery...</div>
            ) : availableLayers.length === 0 ? (
              <div className="no-data">
                No drone imagery available for this farm
              </div>
            ) : (
              <>
                {/* Flight Selector */}
                <div className="control-group">
                  <label>Flight Date</label>
                  <select
                    value={selectedFlight?.date || ""}
                    onChange={(e) => {
                      const flight = availableLayers.find(
                        (f) => f.date === e.target.value
                      );
                      setSelectedFlight(flight);
                    }}
                  >
                    {availableLayers.map((flight) => (
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
                    {LAYER_TYPES.map((layer) => {
                      const isAvailable = selectedFlight?.layers[layer.id];
                      return (
                        <button
                          key={layer.id}
                          className={`layer-btn ${
                            activeLayerType === layer.id ? "active" : ""
                          } ${!isAvailable ? "disabled" : ""}`}
                          onClick={() =>
                            isAvailable && setActiveLayerType(layer.id)
                          }
                          disabled={!isAvailable}
                          title={
                            isAvailable
                              ? layer.name
                              : "Not available for this flight"
                          }
                        >
                          {layer.name}
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

                {/* Legend */}
                {activeLayerName && getActiveStyle() && (
                  <div className="control-group legend">
                    <label>Legend</label>
                    <img
                      src={getLegendUrl(activeLayerName, getActiveStyle())}
                      alt="Layer legend"
                      onError={(e) => (e.target.style.display = "none")}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default DroneImageryLayer;
```

### 4.3 Drone Imagery CSS

Create `/src/droneimagery.css`:

```css
/* Drone Imagery Control Panel */
.drone-imagery-panel {
  position: absolute;
  top: 80px;
  right: 10px;
  z-index: 1000;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
  min-width: 250px;
  max-width: 300px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.drone-imagery-panel.collapsed {
  min-width: auto;
  width: 48px;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #4cdf20 0%, #38a815 100%);
  color: white;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
}

.panel-header:hover {
  background: linear-gradient(135deg, #5aef30 0%, #42c018 100%);
}

.drone-imagery-panel.collapsed .panel-header span:last-child {
  display: none;
}

.panel-content {
  padding: 16px;
}

.control-group {
  margin-bottom: 16px;
}

.control-group:last-child {
  margin-bottom: 0;
}

.control-group label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.control-group select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  cursor: pointer;
}

.control-group select:focus {
  outline: none;
  border-color: #4cdf20;
  box-shadow: 0 0 0 3px rgba(76, 223, 32, 0.2);
}

/* Layer Type Buttons */
.layer-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.layer-btn {
  flex: 1 1 calc(50% - 3px);
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.layer-btn:hover:not(.disabled) {
  border-color: #4cdf20;
  background: #f0fdf4;
}

.layer-btn.active {
  background: #4cdf20;
  border-color: #4cdf20;
  color: white;
}

.layer-btn.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Opacity Slider */
.control-group input[type="range"] {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #e5e7eb;
  outline: none;
  -webkit-appearance: none;
}

.control-group input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #4cdf20;
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

/* Legend */
.legend img {
  max-width: 100%;
  border-radius: 4px;
}

/* Loading / No Data */
.loading,
.no-data {
  text-align: center;
  color: #6b7280;
  font-size: 14px;
  padding: 20px 0;
}

.loading::before {
  content: "";
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid #e5e7eb;
  border-top-color: #4cdf20;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 8px;
  vertical-align: middle;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

### 4.4 Integrate into Farm Details Page

Update your `farmdetails.jsx` to include the drone imagery component:

```jsx
// In your imports
import DroneImageryLayer from "./DroneImageryLayer";
import "./droneimagery.css";

// Inside your MapContainer component
<MapContainer
  ref={mapRef}
  center={mapCenter}
  zoom={15}
  style={{ height: "100%", width: "100%" }}
>
  <TileLayer
    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    attribution="&copy; OpenStreetMap"
  />

  {/* Your existing polygon layer */}
  {polygonCoords && <Polygon positions={polygonCoords} />}

  {/* Drone Imagery Layer */}
  <DroneImageryLayer farmId={farm.id} farmName={farm.name} />
</MapContainer>;
```

### 4.5 Environment Variables

Add to your `.env`:

```env
# GeoServer
VITE_GEOSERVER_URL=https://gis.yourdomain.com/geoserver
```

---

## 📊 Part 5: Database Schema Updates

Add these tables to your Supabase database:

```sql
-- Drone flights/missions
CREATE TABLE drone_flights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID REFERENCES farms(id) ON DELETE CASCADE,
  captured_at TIMESTAMP WITH TIME ZONE NOT NULL,
  provider VARCHAR(100), -- 'Provider Name'
  source_type VARCHAR(50), -- 'gdrive', 'onedrive', 'direct'
  source_path TEXT, -- Original path in Drive/OneDrive
  drone_model VARCHAR(100),
  altitude_m DECIMAL(6,2),
  gsd_cm DECIMAL(5,2), -- Ground Sample Distance
  coverage_area_ha DECIMAL(10,2),
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'ready', 'failed'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Individual imagery layers for each flight
CREATE TABLE drone_imagery_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id UUID REFERENCES drone_flights(id) ON DELETE CASCADE,
  layer_type VARCHAR(50) NOT NULL, -- 'rgb', 'ndvi', 'ndre', 'gndvi'
  geoserver_layer VARCHAR(255) NOT NULL, -- 'agripay:farmid_date_ndvi'
  geoserver_style VARCHAR(100),
  bounds JSONB, -- {minx, miny, maxx, maxy}
  statistics JSONB, -- {min, max, mean, std}
  file_size_mb DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_drone_flights_farm ON drone_flights(farm_id);
CREATE INDEX idx_drone_flights_status ON drone_flights(status);
CREATE INDEX idx_drone_imagery_flight ON drone_imagery_layers(flight_id);
CREATE INDEX idx_drone_imagery_type ON drone_imagery_layers(layer_type);

-- RLS Policies
ALTER TABLE drone_flights ENABLE ROW LEVEL SECURITY;
ALTER TABLE drone_imagery_layers ENABLE ROW LEVEL SECURITY;

-- Users can see flights for their farms
CREATE POLICY "Users can view their farm flights"
  ON drone_flights FOR SELECT
  USING (
    farm_id IN (
      SELECT id FROM farms WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their farm imagery layers"
  ON drone_imagery_layers FOR SELECT
  USING (
    flight_id IN (
      SELECT df.id FROM drone_flights df
      JOIN farms f ON df.farm_id = f.id
      WHERE f.user_id = auth.uid()
    )
  );
```

---

## 🔒 Part 6: Security Configuration

### 6.1 GeoServer Security

1. **Create a public role** for anonymous access to published layers:

   - GeoServer UI → Security → Users, Groups, Roles → Roles → Add new role
   - Name: `ROLE_ANONYMOUS`

2. **Set layer access rules**:

   - Security → Data → Add new rule
   - Workspace: `agripay`
   - Layer: `*`
   - Access mode: `Read`
   - Roles: `ROLE_ANONYMOUS`

3. **Restrict admin access**:
   - Change default admin password!
   - Consider IP whitelisting for admin endpoints

### 6.2 Nginx Security Headers

Update `nginx.conf`:

```nginx
# Security headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;

# Only allow your domains
add_header 'Access-Control-Allow-Origin' 'https://agripay.yourdomain.com' always;
```

---

## 📋 Part 7: Monitoring & Maintenance

### 7.1 Health Check Script

Create `/opt/agripay-gis/scripts/health_check.sh`:

```bash
#!/bin/bash

WEBHOOK_URL="your-slack-or-discord-webhook"

check_geoserver() {
    response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/geoserver/web/)
    if [ "$response" != "200" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data '{"text":"⚠️ GeoServer is DOWN! Status: '"$response"'"}' \
            "$WEBHOOK_URL"

        # Attempt restart
        docker compose -f /opt/agripay-gis/docker-compose.yml restart geoserver
    fi
}

check_disk_space() {
    usage=$(df -h /opt/agripay-gis | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$usage" -gt 85 ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data '{"text":"⚠️ Disk usage at '"$usage"'%! Consider cleanup."}' \
            "$WEBHOOK_URL"
    fi
}

check_geoserver
check_disk_space
```

Add to cron (every 5 minutes):

```bash
*/5 * * * * /opt/agripay-gis/scripts/health_check.sh
```

### 7.2 Log Rotation

Create `/etc/logrotate.d/agripay-gis`:

```
/opt/agripay-gis/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root root
}
```

---

## 🚀 Quick Start Checklist

```
□ 1. Provision VPS (Ubuntu 22.04, 4GB+ RAM)
□ 2. Install Docker & Docker Compose
□ 3. Create directory structure
□ 4. Configure docker-compose.yml
□ 5. Start GeoServer (docker compose up -d)
□ 6. Access GeoServer UI, change password
□ 7. Create 'agripay' workspace
□ 8. Upload NDVI style (SLD)
□ 9. Configure rclone for GDrive/OneDrive
□ 10. Set up sync script + cron job
□ 11. Install Python processing dependencies
□ 12. Configure processing script
□ 13. Add VITE_GEOSERVER_URL to frontend .env
□ 14. Add DroneImageryLayer component
□ 15. Test end-to-end with sample imagery
□ 16. Configure SSL (Let's Encrypt)
□ 17. Set up monitoring & alerts
```

---

## 💰 Cost Estimate

| Component                 | Monthly Cost   |
| ------------------------- | -------------- |
| VPS (Hetzner CPX21)       | ~$16           |
| Domain + SSL              | ~$1            |
| Backup storage (optional) | ~$5            |
| **Total**                 | **~$22/month** |

---

## ❓ FAQ

**Q: How long does processing take?**
A: For a typical 1GB multispectral image:

- NDVI/indices calculation: 2-5 minutes
- COG conversion: 1-2 minutes per layer
- GeoServer publishing: <30 seconds

**Q: Can multiple farms share one GeoServer?**
A: Yes! Use the workspace/layer naming convention (`farmid_date_type`) to organize layers. One GeoServer can handle hundreds of farms.

**Q: What if the provider sends already-processed NDVI images?**
A: Skip the processing step. Just convert to COG and publish directly.

**Q: How to handle very large files (10GB+)?**
A:

1. Increase VPS RAM to 16GB
2. Use chunked uploads for Drive sync
3. Process in tiles if needed
4. Consider cloud functions for processing (AWS Lambda, Cloud Run)
