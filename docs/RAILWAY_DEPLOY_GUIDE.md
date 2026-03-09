# Guía de Deploy en Railway - Scout Backend

Esta guía te llevará paso a paso para deployar el backend de Scout en Railway.

## Requisitos Previos

- Cuenta en [Railway](https://railway.app)
- Repositorio en GitHub con el backend (`MartinOfi/scout-back`)
- El `package.json` debe estar en el **root** del repositorio

## Arquitectura del Deploy

```
┌─────────────────────────────────────────────────────────┐
│                      Railway                            │
│  ┌──────────────┐    ┌──────────────────────────────┐  │
│  │   Backend    │───▶│  PostgreSQL (Neon externo)   │  │
│  │   NestJS     │    │  o Railway Postgres          │  │
│  └──────────────┘    └──────────────────────────────┘  │
│         │                                               │
│         ▼                                               │
│  https://tu-app.railway.app                            │
└─────────────────────────────────────────────────────────┘
```

---

## Paso 1: Crear Proyecto en Railway

1. Ve a [railway.app](https://railway.app) y logueate
2. Click en **"New Project"**
3. Selecciona **"Deploy from GitHub repo"**
4. Autoriza Railway para acceder a tu cuenta de GitHub
5. Selecciona el repositorio `scout-back`

---

## Paso 2: Configurar el Servicio

Railway detectará automáticamente que es un proyecto Node.js por el `package.json`.

### Build & Start Commands

Railway usará automáticamente:
- **Build Command:** `npm run build`
- **Start Command:** `npm run start:prod`

Si necesitas configurarlos manualmente:
1. Ve a tu servicio → **Settings** → **Build**
2. Configura:
   ```
   Build Command: npm install && npm run build
   Start Command: npm run start:prod
   ```

---

## Paso 3: Configurar Variables de Entorno

Ve a tu servicio → **Variables** y agrega las siguientes:

### Variables Requeridas

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Ambiente de producción |
| `DATABASE_URL` | `postgresql://...` | URL de conexión a PostgreSQL |
| `JWT_SECRET` | `tu-secret-seguro` | Clave secreta para JWT (genera una segura) |
| `JWT_EXPIRATION` | `24h` | Tiempo de expiración del token |
| `FRONTEND_URL` | `https://tu-frontend.com` | URL del frontend para CORS |

### Opción A: Usar tu base de datos Neon existente

Si ya tienes Neon configurado, simplemente agrega tu `DATABASE_URL`:
```
DATABASE_URL=postgresql://neondb_owner:TU_PASSWORD@ep-purple-queen-acx9o7yg-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require
```

### Opción B: Crear PostgreSQL en Railway

1. En tu proyecto, click **"New"** → **"Database"** → **"PostgreSQL"**
2. Railway creará la variable `DATABASE_URL` automáticamente
3. Ve al servicio backend → **Variables**
4. Click **"Add Reference"** y selecciona `DATABASE_URL` del servicio PostgreSQL

---

## Paso 4: Generar Dominio Público

1. Ve a tu servicio → **Settings** → **Networking**
2. Click en **"Generate Domain"**
3. Railway te dará una URL como: `scout-back-production.up.railway.app`

También puedes configurar un dominio personalizado si lo tienes.

---

## Paso 5: Verificar el Deploy

Una vez que el deploy termine:

1. **Health Check:** Visita `https://tu-app.railway.app/api/v1`
2. **Swagger Docs:** Visita `https://tu-app.railway.app/api/docs`

---

## Configuración Adicional

### Variables de Railway Automáticas

Railway provee automáticamente:
- `PORT` - Puerto asignado (tu app ya lo usa correctamente)
- `RAILWAY_ENVIRONMENT` - Nombre del ambiente
- `RAILWAY_SERVICE_NAME` - Nombre del servicio

### Archivos de Configuración (Ya incluidos)

Tu proyecto ya tiene los archivos de configuración necesarios:

**railway.json:**
```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "RAILPACK"
  },
  "deploy": {
    "runtime": "V2",
    "numReplicas": 1,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**railpack.json:**
```json
{
  "$schema": "https://schema.railpack.com",
  "deploy": {
    "startCommand": "npm run start:prod"
  }
}
```

---

## Troubleshooting

### Error: "No start command found"

Asegúrate de que `package.json` tenga el script `start:prod`:
```json
{
  "scripts": {
    "start:prod": "node dist/main"
  }
}
```

### Error: "Cannot connect to database"

1. Verifica que `DATABASE_URL` esté correctamente configurada
2. Asegúrate de que SSL esté habilitado (tu código ya lo tiene)
3. Verifica que la IP de Railway esté permitida en tu base de datos

### Error: "Port already in use"

Tu código usa `process.env.PORT` correctamente. Railway asigna el puerto automáticamente.

### Ver Logs

1. Ve a tu servicio → **Deployments**
2. Click en el deployment activo
3. Ve los logs en tiempo real

---

## Comandos Railway CLI (Opcional)

Si instalas Railway CLI localmente:

```bash
# Instalar CLI
npm install -g @railway/cli

# Login
railway login

# Conectar al proyecto
railway link

# Ver logs
railway logs

# Deploy manual
railway up

# Variables
railway variables
```

---

## Checklist Final

- [ ] Repositorio conectado a Railway
- [ ] Variables de entorno configuradas
- [ ] Dominio generado
- [ ] Build exitoso (ver logs)
- [ ] API respondiendo en `/api/v1`
- [ ] Swagger accesible en `/api/docs`
- [ ] Base de datos conectada

---

## URLs de Referencia

- **Railway Dashboard:** https://railway.app/dashboard
- **Railway Docs:** https://docs.railway.com
- **Tu Swagger:** `https://tu-app.railway.app/api/docs`
