# SLW Database Backup Script
# Usage: powershell -ExecutionPolicy Bypass -File scripts\backup-db.ps1

$CONTAINER   = "slw-postgres"
$DB_NAME     = "slw_local"
$DB_USER     = "slw_admin"
$BACKUP_DIR  = Join-Path $PSScriptRoot "..\backups"
$KEEP_DAYS   = 7

# Ensure backups folder exists
if (-not (Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR | Out-Null
}

# Check Docker is running
$dockerRunning = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker is not running. Start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Check container is running
$containerStatus = docker inspect -f "{{.State.Running}}" $CONTAINER 2>&1
if ($containerStatus -ne "true") {
    Write-Host "ERROR: Container '$CONTAINER' is not running. Run: npm run db:up" -ForegroundColor Red
    exit 1
}

# Create backup
$timestamp  = Get-Date -Format "yyyyMMdd_HHmm"
$backupFile = Join-Path $BACKUP_DIR "slw_$timestamp.sql"

Write-Host "Creating backup: slw_$timestamp.sql ..." -ForegroundColor Cyan
docker exec $CONTAINER pg_dump -U $DB_USER $DB_NAME | Out-File -FilePath $backupFile -Encoding utf8

if ($LASTEXITCODE -ne 0 -or (Get-Item $backupFile).Length -lt 100) {
    Write-Host "ERROR: Backup failed or file is empty." -ForegroundColor Red
    Remove-Item $backupFile -ErrorAction SilentlyContinue
    exit 1
}

$sizeMB = [math]::Round((Get-Item $backupFile).Length / 1MB, 2)
Write-Host "Backup saved: $backupFile ($sizeMB MB)" -ForegroundColor Green

# Delete backups older than KEEP_DAYS
$cutoff = (Get-Date).AddDays(-$KEEP_DAYS)
$old = Get-ChildItem $BACKUP_DIR -Filter "slw_*.sql" | Where-Object { $_.LastWriteTime -lt $cutoff }
if ($old) {
    $old | Remove-Item
    Write-Host "Cleaned up $($old.Count) old backup(s) (older than $KEEP_DAYS days)." -ForegroundColor Yellow
}

Write-Host "Done." -ForegroundColor Green
