param(
  [switch]$Apply
)

$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
$parent = Split-Path -Parent $root
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$quarantine = Join-Path $parent "rad-local-artifacts-quarantine-$stamp"

$relativeTargets = New-Object System.Collections.Generic.List[string]

function Get-RepoRelativePath([string]$FullName) {
  $relative = Resolve-Path -LiteralPath $FullName -Relative
  return ($relative -replace '^[.][\\/]', '')
}

function Add-RelativeFileMatches([string]$BasePath, [string[]]$Patterns) {
  if (-not (Test-Path $BasePath)) { return }
  foreach ($pattern in $Patterns) {
    Get-ChildItem -Path $BasePath -File -Filter $pattern -ErrorAction SilentlyContinue | ForEach-Object {
      $relativeTargets.Add((Get-RepoRelativePath $_.FullName))
    }
  }
}

function Add-RelativeDirMatches([string]$BasePath, [string[]]$Patterns) {
  if (-not (Test-Path $BasePath)) { return }
  foreach ($pattern in $Patterns) {
    Get-ChildItem -Path $BasePath -Directory -Filter $pattern -ErrorAction SilentlyContinue | ForEach-Object {
      $relativeTargets.Add((Get-RepoRelativePath $_.FullName))
    }
  }
}

# Root-level handoff archives, backups and generated local artifacts.
# Deliberately does NOT move .env/.env.local: those can exist locally if ignored by Git.
Add-RelativeFileMatches $root @(
  "*.zip", "*.7z", "*.rar", "*.tar", "*.tgz", "*.tar.gz",
  "*.bak", "*.backup", "*.old", "*.orig", "*.tmp", "*.dump",
  "*.db", "*.sqlite", "*.sqlite3", "*.tsbuildinfo", "*.log"
)

# Common generated/local directories.
Add-RelativeDirMatches $root @(
  "tmp", "backups", "dumps", "logs", "_app_root_backup", "rad-audit-packs-*", "rad-full-audit-*"
)

# Prisma local DB backups are operational artifacts, not source code.
if (Test-Path "prisma\backups") {
  $relativeTargets.Add("prisma\backups")
}

# Backup files accidentally left next to source files.
Get-ChildItem -Path $root -Recurse -File -Include *.bak,*.backup,*.old,*.orig,*.tmp,*.dump,*.log,*.tsbuildinfo -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch "\\node_modules\\|\\.git\\|\\.next\\" } |
  ForEach-Object {
    $relativeTargets.Add((Get-RepoRelativePath $_.FullName))
  }

# Raw SQL outside Prisma migrations should be local scratch only.
Get-ChildItem -Path $root -Recurse -File -Filter *.sql -ErrorAction SilentlyContinue |
  Where-Object {
    $_.FullName -notmatch "\\node_modules\\|\\.git\\|\\.next\\" -and
    $_.FullName -notmatch "\\prisma\\migrations\\[^\\]+\\migration\.sql$"
  } |
  ForEach-Object {
    $relativeTargets.Add((Get-RepoRelativePath $_.FullName))
  }

# Known generated JSON audit/cache outputs.
foreach ($generated in @(
  "scripts\day-highlight-cache-export.json",
  "scripts\surprise-audit-*.json",
  "tmp\today-history-pool-backup-*.json"
)) {
  Get-ChildItem -Path $generated -File -ErrorAction SilentlyContinue | ForEach-Object {
    $relativeTargets.Add((Get-RepoRelativePath $_.FullName))
  }
}

$uniqueTargets = $relativeTargets | Sort-Object -Unique

if ($uniqueTargets.Count -eq 0) {
  Write-Host "No local artifacts found. Repo is already clean." -ForegroundColor Green
  exit 0
}

Write-Host "Found $($uniqueTargets.Count) local artifact(s) that should not live in the repo:" -ForegroundColor Yellow
$uniqueTargets | ForEach-Object { Write-Host " - $_" }

if (-not $Apply) {
  Write-Host ""
  Write-Host "Dry run only. To move these files outside the project, run:" -ForegroundColor Cyan
  Write-Host "npm run repo:quarantine -- -Apply"
  exit 0
}

New-Item -ItemType Directory -Path $quarantine -Force | Out-Null

foreach ($relative in $uniqueTargets) {
  $source = Join-Path $root $relative
  if (-not (Test-Path -LiteralPath $source)) { continue }

  $destination = Join-Path $quarantine $relative
  $destinationDir = Split-Path -Parent $destination
  New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
  Move-Item -LiteralPath $source -Destination $destination -Force
}

Write-Host "Moved local artifacts to:" -ForegroundColor Green
Write-Host $quarantine
Write-Host ""
Write-Host "Now run: npm run repo:audit"
