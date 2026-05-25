# RAD - Checklist de restauración de base de datos

Usar esto si hay un problema grave con la base.

## Reglas de oro

- No correr `prisma migrate dev` contra Railway o producción.
- En producción usar `prisma migrate deploy`.
- Nunca commitear dumps, backups ni `.env`.
- Si se puede, restaurar primero en una base temporal.
- Después de restaurar probar `/api/health`.

## Antes de restaurar

Confirmar qué pasó:

- Datos borrados por error.
- Migración fallida.
- Base caída.
- Datos corruptos.

Identificar backup:

- Archivo del backup.
- Fecha/hora.
- Archivo `.sha256`.
- Entorno de destino.

Verificar hash:

```powershell
Get-FileHash -Algorithm SHA256 "ruta\backup.dump"
Get-Content "ruta\backup.dump.sha256"
```

## Camino más seguro

Restaurar primero en una base temporal.

1. Crear base Postgres temporal.
2. Restaurar backup ahí.
3. Correr migraciones:

```powershell
npx prisma migrate deploy
```

4. Apuntar `.env` local a esa base temporal.
5. Validar:

```powershell
npx prisma validate
npm run check
```

6. Levantar local:

```powershell
npm run dev
```

7. Probar:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

## Restaurar backup custom

Para backups `.dump`:

```powershell
pg_restore --dbname "$env:DATABASE_URL" --clean --if-exists --no-owner --no-acl "ruta\backup.dump"
```

## Restaurar backup SQL plano

```powershell
psql "$env:DATABASE_URL" -f "ruta\backup.sql"
```

## Después de restaurar

```powershell
npx prisma migrate deploy
npm run check
```

Probar:

```powershell
Invoke-RestMethod https://TU_DOMINIO/api/health
```

## Validación manual

- Home carga.
- Login funciona.
- Admin login funciona.
- `/rad-control-room` carga.
- Reportes se pueden resolver.
- Calificar un día funciona.
- Borrar review actualiza ranking.
- `/ranked-days` carga.
- Notificaciones cargan.
- `/api/top` responde.

## Notas del incidente

Completar:

```txt
Fecha/hora:
Quién ejecutó restore:
Motivo:
Backup usado:
SHA256:
DB destino:
Comandos ejecutados:
Resultado:
Tareas pendientes:
```
