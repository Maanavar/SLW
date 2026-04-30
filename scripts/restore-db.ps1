# SLW Database Restore Script
# Usage: powershell -ExecutionPolicy Bypass -File scripts\restore-db.ps1

$CONTAINER  = "slw-postgres"
$DB_NAME    = "slw_local"
$DB_USER    = "slw_admin"
$BACKUP_DIR = Join-Path $PSScriptRoot "..\backups"

# Check Docker
$dockerRunning = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker is not running. Start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Check container
$containerStatus = docker inspect -f "{{.State.Running}}" $CONTAINER 2>&1
if ($containerStatus -ne "true") {
    Write-Host "ERROR: Container '$CONTAINER' is not running. Run: npm run db:up" -ForegroundColor Red
    exit 1
}

# List available backups
$backups = Get-ChildItem $BACKUP_DIR -Filter "slw_*.sql" | Sort-Object LastWriteTime -Descending
if (-not $backups) {
    Write-Host "No backups found in: $BACKUP_DIR" -ForegroundColor Red
    exit 1
}

Write-Host "`nAvailable backups:" -ForegroundColor Cyan
for ($i = 0; $i -lt $backups.Count; $i++) {
    $sizeMB = [math]::Round($backups[$i].Length / 1MB, 2)
    Write-Host "  [$($i+1)] $($backups[$i].Name)  ($sizeMB MB)  $($backups[$i].LastWriteTime)"
}

Write-Host ""
$choice = Read-Host "Enter number to restore (or Q to quit)"
if ($choice -eq "Q" -or $choice -eq "q") { exit 0 }

$idx = [int]$choice - 1
if ($idx -lt 0 -or $idx -ge $backups.Count) {
    Write-Host "Invalid choice." -ForegroundColor Red
    exit 1
}

$selectedFile = $backups[$idx].FullName
Write-Host "`nWARNING: This will OVERWRITE all current data in '$DB_NAME'." -ForegroundColor Red
$confirm = Read-Host "Type YES to confirm"
if ($confirm -ne "YES") {
    Write-Host "Aborted." -ForegroundColor Yellow
    exit 0
}

Write-Host "Restoring from: $($backups[$idx].Name) ..." -ForegroundColor Cyan

# Drop and recreate database, then restore
docker exec $CONTAINER psql -U $DB_USER -c "DROP DATABASE IF EXISTS ${DB_NAME}_old;" postgres 2>&1 | Out-Null
docker exec $CONTAINER psql -U $DB_USER -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB_NAME';" postgres | Out-Null
docker exec $CONTAINER psql -U $DB_USER -c "DROP DATABASE IF EXISTS $DB_NAME;" postgres | Out-Null
docker exec $CONTAINER psql -U $DB_USER -c "CREATE DATABASE $DB_NAME;" postgres | Out-Null

Get-Content $selectedFile | docker exec -i $CONTAINER psql -U $DB_USER $DB_NAME

if ($LASTEXITCODE -eq 0) {
    Write-Host "Restore complete." -ForegroundColor Green
} else {
    Write-Host "Restore may have had errors. Check above output." -ForegroundColor Yellow
}
