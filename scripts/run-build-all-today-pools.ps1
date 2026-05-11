param(
  [int]$DelaySeconds = 8,
  [string]$StartAt = "",
  [string]$EndAt = "",
  [switch]$Confirmed,
  [switch]$AllowProduction
)

$ErrorActionPreference = "Continue"

function Test-ProductionLikeDatabase {
  $databaseUrl = "$env:DATABASE_URL".ToLowerInvariant()

  if ("$env:NODE_ENV" -eq "production") {
    return $true
  }

  if ($env:RAILWAY_ENVIRONMENT -or $env:RAILWAY_PROJECT_ID -or $env:RAILWAY_SERVICE_ID) {
    return $true
  }

  if ($databaseUrl.Contains("railway") -or $databaseUrl.Contains("rlwy") -or $databaseUrl.Contains("proxy.rlwy.net")) {
    return $true
  }

  return $false
}

function Stop-WithSafetyMessage {
  param(
    [string]$Message
  )

  Write-Host ""
  Write-Host $Message -ForegroundColor Red
  Write-Host ""
  Write-Host "Usage:" -ForegroundColor Yellow
  Write-Host "  .\scripts\run-build-all-today-pools.ps1 -Confirmed"
  Write-Host "  .\scripts\run-build-all-today-pools.ps1 -Confirmed -AllowProduction"
  Write-Host "  .\scripts\run-build-all-today-pools.ps1 -StartAt 05-01 -EndAt 05-31 -Confirmed"
  Write-Host ""
  exit 1
}

if (-not $Confirmed) {
  Stop-WithSafetyMessage "Refusing to run without -Confirmed. This script rebuilds TodayHistoryPool rows."
}

$looksProductionLike = Test-ProductionLikeDatabase

if ($looksProductionLike -and -not $AllowProduction) {
  Stop-WithSafetyMessage "Refusing to run against a production-like database without -AllowProduction."
}

$monthDays = @()

for ($m = 1; $m -le 12; $m++) {
  $daysInMonth = switch ($m) {
    2 { 29 }
    4 { 30 }
    6 { 30 }
    9 { 30 }
    11 { 30 }
    default { 31 }
  }

  for ($d = 1; $d -le $daysInMonth; $d++) {
    $monthDays += ("{0:D2}-{1:D2}" -f $m, $d)
  }
}

if ($StartAt -ne "") {
  if ($StartAt -notmatch "^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$") {
    throw "Invalid -StartAt value. Use MM-DD, for example 04-10."
  }

  $monthDays = $monthDays | Where-Object { $_ -ge $StartAt }
}

if ($EndAt -ne "") {
  if ($EndAt -notmatch "^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$") {
    throw "Invalid -EndAt value. Use MM-DD, for example 04-30."
  }

  $monthDays = $monthDays | Where-Object { $_ -le $EndAt }
}

New-Item -ItemType Directory -Force .\logs | Out-Null

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logPath = ".\logs\today-pool-rebuild-$stamp.log"

"=== TODAY POOL FULL REBUILD ===" | Tee-Object -FilePath $logPath
"Start: $(Get-Date)" | Tee-Object -FilePath $logPath -Append
"DelaySeconds: $DelaySeconds" | Tee-Object -FilePath $logPath -Append
"StartAt: $StartAt" | Tee-Object -FilePath $logPath -Append
"EndAt: $EndAt" | Tee-Object -FilePath $logPath -Append
"Confirmed: $Confirmed" | Tee-Object -FilePath $logPath -Append
"AllowProduction: $AllowProduction" | Tee-Object -FilePath $logPath -Append
"ProductionLikeDatabase: $looksProductionLike" | Tee-Object -FilePath $logPath -Append
"Total month-days: $($monthDays.Count)" | Tee-Object -FilePath $logPath -Append
"" | Tee-Object -FilePath $logPath -Append

$i = 0

foreach ($md in $monthDays) {
  $i++

  "[$i/$($monthDays.Count)] rebuilding $md..." | Tee-Object -FilePath $logPath -Append

  try {
    $scriptArgs = @(
      "tsx",
      ".\scripts\build-today-history-pools.ts",
      $md,
      "--confirm"
    )

    if ($AllowProduction) {
      $scriptArgs += "--allowProduction"
    }

    $output = & npx @scriptArgs 2>&1
    $exitCode = $LASTEXITCODE

    $output | Tee-Object -FilePath $logPath -Append

    if ($exitCode -ne 0) {
      "ERROR on $md : child script exited with code $exitCode" | Tee-Object -FilePath $logPath -Append
    }
  } catch {
    "ERROR on $md : $_" | Tee-Object -FilePath $logPath -Append
  }

  "" | Tee-Object -FilePath $logPath -Append

  if ($i -lt $monthDays.Count) {
    "waiting $DelaySeconds seconds..." | Tee-Object -FilePath $logPath -Append
    Start-Sleep -Seconds $DelaySeconds
  }
}

"" | Tee-Object -FilePath $logPath -Append
"Done: $(Get-Date)" | Tee-Object -FilePath $logPath -Append
"Log: $logPath" | Tee-Object -FilePath $logPath -Append