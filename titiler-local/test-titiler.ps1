# TiTiler Test Script
# This script tests if TiTiler is running correctly and can serve imagery

param(
    [string]$TiTilerUrl = "http://localhost:8000"
)

Write-Host "=== TiTiler Integration Test ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health Check
Write-Host "[Test 1] Checking TiTiler health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$TiTilerUrl/healthz" -Method Get -TimeoutSec 5
    Write-Host "  ✅ TiTiler is online!" -ForegroundColor Green
    Write-Host "  Version: TiTiler $($health.versions.titiler), GDAL $($health.versions.gdal)" -ForegroundColor Gray
} catch {
    Write-Host "  ❌ TiTiler is not responding!" -ForegroundColor Red
    Write-Host "  Make sure Docker is running and execute:" -ForegroundColor Yellow
    Write-Host "    cd titiler-local" -ForegroundColor White
    Write-Host "    docker-compose up -d" -ForegroundColor White
    exit 1
}

Write-Host ""

# Test 2: Check API Endpoints
Write-Host "[Test 2] Checking API endpoints..." -ForegroundColor Yellow
$endpoints = @(
    "/",
    "/docs",
    "/cog/info",
    "/cog/bounds",
    "/cog/statistics"
)

foreach ($endpoint in $endpoints) {
    try {
        $response = Invoke-WebRequest -Uri "$TiTilerUrl$endpoint" -Method Get -TimeoutSec 5 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "  ✅ $endpoint - OK" -ForegroundColor Green
        }
    } catch {
        # For endpoints that require URL param, 422 is expected
        if ($_.Exception.Response.StatusCode -eq 422) {
            Write-Host "  ✅ $endpoint - OK (requires params)" -ForegroundColor Green
        } else {
            Write-Host "  ❌ $endpoint - Failed" -ForegroundColor Red
        }
    }
}

Write-Host ""

# Test 3: Check imagery folder
Write-Host "[Test 3] Checking imagery folder..." -ForegroundColor Yellow
$imageryPath = Join-Path $PSScriptRoot "imagery"

if (Test-Path $imageryPath) {
    $files = Get-ChildItem -Path $imageryPath -Filter "*.tif*" -File
    if ($files.Count -gt 0) {
        Write-Host "  ✅ Found $($files.Count) GeoTIFF file(s):" -ForegroundColor Green
        foreach ($file in $files) {
            Write-Host "    - $($file.Name) ($([math]::Round($file.Length / 1MB, 2)) MB)" -ForegroundColor Gray
        }
    } else {
        Write-Host "  ⚠️ No GeoTIFF files found in imagery folder" -ForegroundColor Yellow
        Write-Host "  Add .tif files with naming: {farmId}_{YYYYMMDD}_{layer}.tif" -ForegroundColor Gray
    }
} else {
    Write-Host "  ⚠️ Imagery folder not found at: $imageryPath" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $imageryPath -Force | Out-Null
    Write-Host "  Created imagery folder" -ForegroundColor Gray
}

Write-Host ""

# Test 4: Test COG endpoint with a sample file (if available)
Write-Host "[Test 4] Testing COG tile serving..." -ForegroundColor Yellow
if ($files -and $files.Count -gt 0) {
    $testFile = $files[0].Name
    $fileUrl = "file:///data/$testFile"
    
    try {
        $encodedUrl = [System.Web.HttpUtility]::UrlEncode($fileUrl)
        $infoUrl = "$TiTilerUrl/cog/info?url=$encodedUrl"
        $info = Invoke-RestMethod -Uri $infoUrl -Method Get -TimeoutSec 10
        
        Write-Host "  ✅ Successfully read GeoTIFF info:" -ForegroundColor Green
        Write-Host "    - Width: $($info.width) px" -ForegroundColor Gray
        Write-Host "    - Height: $($info.height) px" -ForegroundColor Gray
        Write-Host "    - Bands: $($info.count)" -ForegroundColor Gray
        Write-Host "    - CRS: $($info.crs)" -ForegroundColor Gray
        
        # Get bounds
        $boundsUrl = "$TiTilerUrl/cog/bounds?url=$encodedUrl"
        $bounds = Invoke-RestMethod -Uri $boundsUrl -Method Get -TimeoutSec 10
        Write-Host "    - Bounds: [$($bounds.bounds -join ', ')]" -ForegroundColor Gray
        
    } catch {
        Write-Host "  ❌ Failed to read GeoTIFF: $testFile" -ForegroundColor Red
        Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "  ⏭️ Skipped - no GeoTIFF files to test" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Test Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Add GeoTIFF files to: titiler-local/imagery/" -ForegroundColor White
Write-Host "   Naming: {farmId}_{YYYYMMDD}_{layer}.tif" -ForegroundColor Gray
Write-Host "   Example: farm123_20241208_ndvi.tif" -ForegroundColor Gray
Write-Host ""
Write-Host "2. View API docs: $TiTilerUrl/docs" -ForegroundColor White
Write-Host ""
Write-Host "3. Get tile URL for Leaflet:" -ForegroundColor White
Write-Host "   $TiTilerUrl/cog/tiles/{z}/{x}/{y}?url=file:///data/your_file.tif" -ForegroundColor Gray
