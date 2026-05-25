param(
  [string]$OutputDir = "",
  [string]$DatabaseUrl = "",
  [switch]$PlainSql
)

$ErrorActionPreference = "Stop"

$repoRoot = (Get-Location).Path
$parent = Split-Path -Parent $repoRoot

if ([string]::IsNullOrWhiteSpace($OutputDir)) {
  $OutputDir = Join-Path $parent "rad-db-backups"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

function Read-DatabaseUrlFromEnvFile {
  $envPath = Join-Path (Get-Location) ".env"

  if (-not (Test-Path $envPath)) {
    return ""
  }

  $line = Get-Content $envPath |
    Where-Object { $_ -match "^\s*DATABASE_URL\s*=" } |
    Select-Object -First 1

  if (-not $line) {
    return ""
  }

  $value = $line -replace "^\s*DATABASE_URL\s*=\s*", ""
  $value = $value.Trim()

  if (
    ($value.StartsWith('"') -and $value.EndsWith('"')) -or
    ($value.StartsWith("'") -and $value.EndsWith("'"))
  ) {
    $value = $value.Substring(1, $value.Length - 2)
  }

  return $value
}

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  if ($env:DATABASE_URL) {
    $DatabaseUrl = $env:DATABASE_URL
  } else {
    $DatabaseUrl = Read-DatabaseUrlFromEnvFile
  }
}

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  throw "No se encontró DATABASE_URL. Pasá -DatabaseUrl o definila en .env."
}

$pgDump = Get-Command "pg_dump" -ErrorAction SilentlyContinue

if (-not $pgDump) {
  throw "No se encontró pg_dump en PATH. Instalá PostgreSQL client tools para hacer backups."
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$extension = if ($PlainSql) { "sql" } else { "dump" }
$outputFile = Join-Path $OutputDir "rad-$stamp.$extension"

Write-Host "Creando backup de la base de datos de RAD..." -ForegroundColor Cyan
Write-Host "Salida: $outputFile"

if ($PlainSql) {
  & pg_dump `
    --dbname "$DatabaseUrl" `
    --format plain `
    --no-owner `
    --no-acl `
    --file "$outputFile"
} else {
  & pg_dump `
    --dbname "$DatabaseUrl" `
    --format custom `
    --no-owner `
    --no-acl `
    --file "$outputFile"
}

if ($LASTEXITCODE -ne 0) {
  throw "pg_dump falló con código $LASTEXITCODE"
}

$hash = Get-FileHash -Algorithm SHA256 -Path $outputFile
$hashFile = "$outputFile.sha256"

"$($hash.Hash)  $(Split-Path -Leaf $outputFile)" | Set-Content -Path $hashFile -Encoding UTF8

Write-Host ""
Write-Host "Backup creado correctamente." -ForegroundColor Green
Write-Host "Backup: $outputFile"
Write-Host "SHA256: $hashFile"
Write-Host ""
Write-Host "NO subas este backup a Git. Guardalo fuera del repo."
