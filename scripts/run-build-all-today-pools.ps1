param(
  [int]$DelaySeconds = 8,
  [string]$StartAt = "",
  [string]$EndAt = ""
)

$ErrorActionPreference = "Continue"

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
  $monthDays = $monthDays | Where-Object { $_ -ge $StartAt }
}

if ($EndAt -ne "") {
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
"Total month-days: $($monthDays.Count)" | Tee-Object -FilePath $logPath -Append
"" | Tee-Object -FilePath $logPath -Append

$i = 0

foreach ($md in $monthDays) {
  $i++

  "[$i/$($monthDays.Count)] rebuilding $md..." | Tee-Object -FilePath $logPath -Append

  try {
    npx tsx .\scripts\build-today-history-pools.ts $md 2>&1 | Tee-Object -FilePath $logPath -Append
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
"Log: $logPath"
