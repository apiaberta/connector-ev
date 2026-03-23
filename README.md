# API Aberta — EV Charging Prices Connector

Microservice for electric vehicle charging network prices and locations.

## Features

- Charging station locations
- Price comparison by network
- Station availability
- Connector types

## Endpoints

- `GET /health` — Service health check
- `GET /meta` — Service metadata
- `GET /stations` — Charging stations
- `GET /prices` — Current pricing by network

## Setup

```bash
npm install
cp .env.example .env
npm start
```

## License

MIT
