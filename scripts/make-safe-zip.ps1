param(
  [string]$OutputPath
)

$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
$projectName = Split-Path -Leaf $root
$parent = Split-Path -Parent $root
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"

if (-not $OutputPath) {
  $OutputPath = Join-Path $parent "$projectName-sin-secretos-$stamp.zip"
}

$temp = Join-Path $env:TEMP "$projectName-clean-$stamp"
if (Test-Path $temp) { Remove-Item $temp -Recurse -Force }
New-Item -ItemType Directory -Path $temp | Out-Null

$excludeDirs = @(
  "node_modules", ".next", ".git", ".vercel", ".turbo", "out", "build", "dist", "coverage", ".cache",
  "tmp", "backups", "dumps", "logs", "_app_root_backup", "rad-audit-packs-*", "rad-full-audit-*",
  "prisma\backups", "src\generated\prisma", "src\generated\prisma-sqlite", "src\generated\prisma-postgres"
)

$excludeFiles = @(
  ".env", ".env.*",
  "*.zip", "*.7z", "*.rar", "*.tar", "*.tar.gz", "*.tgz",
  "*.db", "*.sqlite", "*.sqlite3", "*.dump",
  "*.bak", "*.backup", "*.old", "*.orig", "*.tmp",
  "*.log", "*.pem", "*.key", "*.p12", "*.pfx",
  "*.tsbuildinfo", "day-highlight-cache-export.json", "surprise-audit-*.json", "today-history-pool-backup-*.json"
)

$robocopyArgs = @($root, $temp, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/NP", "/XD") + $excludeDirs + @("/XF") + $excludeFiles
& robocopy @robocopyArgs | Out-Null
$robocopyExit = $LASTEXITCODE
if ($robocopyExit -gt 7) {
  Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
  throw "robocopy failed with exit code $robocopyExit"
}

# Keep Prisma migration SQL, remove raw scratch SQL copied from elsewhere.
Get-ChildItem -Path $temp -Recurse -File -Filter *.sql -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch "\\prisma\\migrations\\[^\\]+\\migration\.sql$" } |
  Remove-Item -Force

# Run the repo hygiene audit against the staged copy before zipping.
$auditor = Join-Path $temp "scripts\audit-repo-cleanliness.mjs"
if (Test-Path $auditor) {
  node $auditor $temp
  if ($LASTEXITCODE -ne 0) {
    Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
    throw "Safe ZIP audit failed. Fix the reported files before sharing."
  }
}

if (Test-Path $OutputPath) { Remove-Item $OutputPath -Force }
Compress-Archive -Path (Join-Path $temp "*") -DestinationPath $OutputPath -Force
Remove-Item $temp -Recurse -Force

Write-Host "Safe ZIP created:" -ForegroundColor Green
Write-Host $OutputPath
