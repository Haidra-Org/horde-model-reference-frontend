# Generate API Client from OpenAPI Schema
# 
# This script is a PowerShell wrapper for generate-api-client.js
# See generate-api-client.js for full documentation

$ErrorActionPreference = "Stop"

# Check if Node.js is installed
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Node.js is not installed" -ForegroundColor Red
    exit 1
}

# Get the script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir

# Change to root directory
Push-Location $rootDir

try {
    # Run the generator
    & node scripts/generate-api-client.js $args
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`nAPI client generation complete!" -ForegroundColor Green
    } else {
        Write-Host "`nAPI client generation failed" -ForegroundColor Red
        exit $LASTEXITCODE
    }
} finally {
    # Return to original directory
    Pop-Location
}
