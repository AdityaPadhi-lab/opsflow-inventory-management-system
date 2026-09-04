# OpsFlow deployment

## Local production-style Docker run

Requirements: Docker Desktop.

PowerShell:

```powershell
$env:JWT_SECRET = "replace-with-a-long-random-production-secret"
$env:POSTGRES_PASSWORD = "replace-with-a-strong-db-password"
$env:CLIENT_URL = "http://localhost"
$env:VITE_API_URL = "http://localhost:4000/api"

docker compose -f docker-compose.production.yml up --build -d
docker compose -f docker-compose.production.yml exec api npx prisma migrate deploy
docker compose -f docker-compose.production.yml exec api npx prisma db seed
```

Open `http://localhost`.

## Separate hosting

### Backend
Deploy `backend/Dockerfile` as a Node/Docker web service. Set:
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `PORT=4000`
- `CLIENT_URL=https://YOUR-FRONTEND-DOMAIN`
- `NODE_ENV=production`

Run `npx prisma migrate deploy` during release/startup before serving traffic.

### Frontend
Deploy `frontend/Dockerfile` as a static web service and set the Docker build argument:
- `VITE_API_URL=https://YOUR-API-DOMAIN/api`

Because Vite embeds `VITE_API_URL` at build time, rebuild the frontend after changing it.

## Security
Never upload `.env` files containing real secrets. Use your hosting provider's secret/environment-variable manager. Use HTTPS in production and restrict `CLIENT_URL` to the real frontend origin.
