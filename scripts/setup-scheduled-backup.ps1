# Registers a Windows Task Scheduler job to backup the SLW database daily at 11 PM.
# Run ONCE as Administrator: powershell -ExecutionPolicy Bypass -File scripts\setup-scheduled-backup.ps1

$TASK_NAME   = "SLW-Database-Backup"
$SCRIPT_PATH = Resolve-Path (Join-Path $PSScriptRoot "backup-db.ps1")
$HOUR        = 23   # 11 PM — change if needed
$MINUTE      = 0

$action  = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NonInteractive -ExecutionPolicy Bypass -File `"$SCRIPT_PATH`""

$trigger = New-ScheduledTaskTrigger -Daily -At "$($HOUR):$($MINUTE)"

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopOnIdleEnd `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

# Remove existing task if present
Unregister-ScheduledTask -TaskName $TASK_NAME -Confirm:$false -ErrorAction SilentlyContinue

Register-ScheduledTask `
    -TaskName $TASK_NAME `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Daily backup of SLW PostgreSQL database" `
    -RunLevel Highest | Out-Null

Write-Host "Scheduled task '$TASK_NAME' registered." -ForegroundColor Green
Write-Host "Runs daily at $($HOUR):$('{0:D2}' -f $MINUTE) (11 PM)." -ForegroundColor Cyan
Write-Host "Backups saved to: $(Resolve-Path (Join-Path $PSScriptRoot '..\backups'))" -ForegroundColor Cyan
Write-Host ""
Write-Host "To run it now for a test:  Start-ScheduledTask -TaskName '$TASK_NAME'"
Write-Host "To remove it:              Unregister-ScheduledTask -TaskName '$TASK_NAME' -Confirm:`$false"
