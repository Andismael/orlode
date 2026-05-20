# =============================================================================
# Kora — Cloud Scheduler setup (PowerShell)
# =============================================================================
# Creates the 2 proactive jobs (check-in + reminders) in PAUSED state so you
# can verify everything before opening the firehose. Run after Cloud Run is
# already deployed with the /api/kora/cron/* endpoints.
#
# Prereqs:
#   - gcloud authenticated with project access (`gcloud auth login`)
#   - Project set to mon-assistant-86bbd (`gcloud config set project mon-assistant-86bbd`)
#   - You know your CRON_SECRET (the value already set on Cloud Run env)
#
# Usage:
#   .\setup-cloud-scheduler.ps1 -CronSecret "your-secret-value"
#
# To activate later:
#   gcloud scheduler jobs resume kora-checkin-hourly --location=europe-west1
#   gcloud scheduler jobs resume kora-reminders-min  --location=europe-west1
# =============================================================================

param(
  [Parameter(Mandatory=$true)]
  [string]$CronSecret,

  [string]$BaseUrl = "https://orlode.com/api/kora",
  [string]$Region = "europe-west1"
)

Write-Host "=== Kora Cloud Scheduler setup ===" -ForegroundColor Cyan
Write-Host "Region: $Region"
Write-Host "Base URL: $BaseUrl"
Write-Host ""

# ── 1. Check-in horaire (filtre par checkInHour côté serveur) ───────────────
Write-Host "[1/2] Creating kora-checkin-hourly (paused)..." -ForegroundColor Yellow
gcloud scheduler jobs create http kora-checkin-hourly `
  --schedule="0 * * * *" `
  --time-zone="UTC" `
  --location=$Region `
  --uri="$BaseUrl/cron/checkin" `
  --http-method=POST `
  --headers="x-cron-secret=$CronSecret,Content-Type=application/json" `
  --message-body='{}' `
  --description="Kora morning check-in dispatcher (timezone-aware, filters silently when no reason)" `
  --quiet

if ($LASTEXITCODE -eq 0) {
  gcloud scheduler jobs pause kora-checkin-hourly --location=$Region --quiet
  Write-Host "  ✓ Created and paused." -ForegroundColor Green
} else {
  Write-Host "  ! Already exists or failed — check 'gcloud scheduler jobs list --location=$Region'" -ForegroundColor Red
}

# ── 2. Reminders (every minute) ──────────────────────────────────────────────
Write-Host "[2/2] Creating kora-reminders-min (paused)..." -ForegroundColor Yellow
gcloud scheduler jobs create http kora-reminders-min `
  --schedule="* * * * *" `
  --time-zone="UTC" `
  --location=$Region `
  --uri="$BaseUrl/cron/reminders" `
  --http-method=POST `
  --headers="x-cron-secret=$CronSecret,Content-Type=application/json" `
  --message-body='{}' `
  --description="Kora reminders dispatcher — fires due reminders with contextSnippet" `
  --quiet

if ($LASTEXITCODE -eq 0) {
  gcloud scheduler jobs pause kora-reminders-min --location=$Region --quiet
  Write-Host "  ✓ Created and paused." -ForegroundColor Green
} else {
  Write-Host "  ! Already exists or failed." -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Done. Both jobs are PAUSED. ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "To activate manually after testing:" -ForegroundColor Yellow
Write-Host "  gcloud scheduler jobs resume kora-checkin-hourly --location=$Region"
Write-Host "  gcloud scheduler jobs resume kora-reminders-min  --location=$Region"
Write-Host ""
Write-Host "To trigger one manually (e.g. test the check-in NOW):" -ForegroundColor Yellow
Write-Host "  gcloud scheduler jobs run kora-checkin-hourly --location=$Region"
Write-Host ""
Write-Host "To delete both:" -ForegroundColor Yellow
Write-Host "  gcloud scheduler jobs delete kora-checkin-hourly --location=$Region --quiet"
Write-Host "  gcloud scheduler jobs delete kora-reminders-min  --location=$Region --quiet"
