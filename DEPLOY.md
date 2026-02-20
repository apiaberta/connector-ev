# Deployment Instructions

## VPS Deployment (167.99.216.205)

### Prerequisites
- MongoDB running on VPS
- PM2 installed globally
- Gateway already configured and running

### Deploy Steps

```bash
# SSH into VPS
ssh root@167.99.216.205

# Navigate to workspace
cd /root/.openclaw/workspace

# Clone the repository
git clone https://github.com/apiaberta/connector-ev.git
cd connector-ev

# Install dependencies
npm install

# Start with PM2
pm2 start ecosystem.config.cjs

# Save PM2 process list
pm2 save

# Check status
pm2 status
pm2 logs apiaberta-ev --lines 50

# IMPORTANT: Clean up node_modules to save disk space
cd /root/.openclaw/workspace/connector-ev
rm -rf node_modules
```

### Update Gateway

```bash
# Pull latest gateway config
cd /root/.openclaw/workspace/gateway
git pull

# Restart gateway to pick up new /ev route
pm2 restart apiaberta-gateway

# Verify
curl http://localhost:3004/health
curl http://localhost:4000/v1/ev/tariffs
```

### Verify Endpoints

```bash
# Local connector health
curl http://localhost:3004/health

# Via gateway (public)
curl http://localhost:4000/v1/ev/tariffs
curl http://localhost:4000/v1/ev/tariffs/cheapest?kwh=40
curl http://localhost:4000/v1/ev/omie/current
curl http://localhost:4000/v1/ev/omie/today
```

### MongoDB

Database: `apiaberta-ev`
Collections:
- `tariffs` - CEME tariff data (initialized on first run)
- `omies` - OMIE spot prices (fetched daily at 13:30)

### Cron Schedule

- **OMIE fetch:** Daily at 13:30 PT (day-ahead prices published by OMIE)

### Logs

```bash
pm2 logs apiaberta-ev
pm2 logs apiaberta-ev --err  # errors only
```

### Troubleshooting

**No OMIE data available:**
- Check if today's file exists on OMIE servers (published ~13:00-13:30 daily)
- Manually trigger: `curl http://localhost:3004/meta` (will auto-fetch if missing)

**Tariffs not showing:**
- Check MongoDB: `mongosh apiaberta-ev --eval "db.tariffs.find()"`
- Reinitialize: delete all tariffs and restart service

**Gateway not routing /v1/ev:**
- Verify gateway config includes EV service (port 3004)
- Verify `/v1/ev` is in PUBLIC_ROUTES
- Restart gateway: `pm2 restart apiaberta-gateway`
