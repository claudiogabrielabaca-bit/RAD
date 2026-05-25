# RAD - Runbook de producción

Este documento explica cómo operar RAD en producción sin improvisar.

## Reglas importantes

- No subir `.env`, backups, dumps, bases locales ni ZIPs al repo.
- No correr `npx prisma migrate dev` contra Railway o producción.
- Para producción usar `npx prisma migrate deploy`.
- Antes de pushear cambios importantes correr `npm run check`.
- Después de migraciones probar `/api/health`.

## Verificar estado del proyecto

```powershell
git status
```

Esperado:

```txt
nothing to commit, working tree clean
```

## Verificación completa local

```powershell
npm run check
```

Esto corre:

```txt
lint
prisma validate
tests de contrato
build
```

## Revisar migraciones

```powershell
npx prisma migrate status
```

Si hay migraciones pendientes en producción:

```powershell
npx prisma migrate deploy
```

No usar esto en Railway:

```powershell
npx prisma migrate dev
```

## Verificar salud de RAD

Local:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

Producción:

```powershell
Invoke-RestMethod https://TU_DOMINIO/api/health
```

Respuesta esperada:

```json
{
  "ok": true,
  "service": "rad",
  "database": "ok",
  "timestamp": "..."
}
```

## Hacer backup de la base

```powershell
.\scripts\db-backup.ps1
```

Por defecto guarda backups afuera del repo:

```txt
../rad-db-backups
```

Backup en carpeta específica:

```powershell
.\scripts\db-backup.ps1 -OutputDir "D:\RAD-BACKUPS"
```

Backup SQL plano, solo si lo necesitás:

```powershell
.\scripts\db-backup.ps1 -PlainSql
```

## Qué archivos nunca se suben a Git

- `.env`
- `.env.local`
- `*.dump`
- `*.sql` fuera de `prisma/migrations`
- `*.db`
- `*.sqlite`
- `*.zip`
- carpetas de backup
- claves privadas
- logs con datos sensibles

Verificar limpieza:

```powershell
npm run repo:audit
```

## Checklist antes de deploy

```powershell
git pull
npm run check
npx prisma migrate status
```

Si hay migraciones pendientes:

```powershell
npx prisma migrate deploy
```

Después:

```powershell
git push
```

Verificar producción:

```powershell
Invoke-RestMethod https://TU_DOMINIO/api/health
```

## Chequeos manuales después de deploy

- La home carga.
- Login funciona.
- Se puede calificar un día.
- `/ranked-days` carga.
- Admin login funciona.
- `/rad-control-room` carga.
- Se puede resolver un reporte.
- El audit log admin guarda acciones.
- `/api/health` devuelve `ok: true`.

## Si producción se rompe

1. No seguir tocando cosas al azar.
2. Revisar `/api/health`.
3. Revisar logs de Railway.
4. Revisar migraciones.
5. Revisar último commit.
6. Si es problema de datos, seguir `docs/db-restore-checklist.md`.
7. Documentar qué pasó.
