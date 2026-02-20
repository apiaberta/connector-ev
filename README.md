# @apiaberta/connector-ev

Electric vehicle charging prices connector for API Aberta.

## Data Sources

### OMIE (Iberian spot market)
- **URL pattern:** `https://www.omie.es/sites/default/files/dados/AGNO_{YYYY}/MES_{MM}/TXT/INT_PBC_EV_H_1_{DD}_{MM}_{YYYY}_{DD}_{MM}_{YYYY}.TXT`
- **Format:** TXT (CSV with `;` separator, Latin-1 encoding)
- **Update frequency:** Daily at ~13:00 PT (day-ahead prices for next day)
- **Data:** 96 price points per day (15-minute intervals: H1Q1...H24Q4)
- **License:** Public domain

### CEME Tariffs
- **Source:** Manual entry from CEME websites (Via Verde, EDP, Galp, EVIO, Goldenergy, LUZiGÁS)
- **Update frequency:** Manual/monthly (no public APIs available)
- **License:** Factual data compilation

## API Endpoints

```
GET /health              → Service health check
GET /meta                → Metadata about data sources
GET /ev/tariffs          → List CEME tariffs with current prices
GET /ev/tariffs/cheapest → Rank cheapest tariffs for given kWh
GET /ev/omie/current     → Current OMIE spot price (Portugal)
GET /ev/omie/today       → All OMIE prices for today (96 intervals)
```

## Environment Variables

```bash
PORT=3004                                           # Service port
MONGO_URI=mongodb://localhost:27017/apiaberta-ev   # MongoDB connection
NODE_ENV=production                                # Environment
```

## Development

```bash
npm install
npm run dev     # Watch mode with auto-reload
npm start       # Production mode
```

## Production Deployment

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

## OMIE Price Structure

OMIE publishes day-ahead prices in 15-minute intervals:
- **96 intervals per day:** H1Q1, H1Q2, H1Q3, H1Q4, ..., H24Q4
- **Portugal line:** "Precio marginal en el sistema portugués"
- **Unit:** €/MWh (divided by 1000 for €/kWh)

## CEME Tariff Types

### Fixed Tariffs
- **Simples:** Single price all day (e.g., Via Verde 0.148 €/kWh)
- **Bi-horária:** Vazio (off-peak) + Fora-vazio (peak) (e.g., EDP Charge)

### Indexed Tariffs
- **LUZiGÁS:** Price varies hourly based on OMIE + margins + grid costs

## Cost Components

Total EV charging cost = CEME energy price + OPC tariff + TAR (grid access) + EGME (MOBI.E fee) + IEC (tax) + IVA (23%)

This connector provides only the **CEME energy component** and **OMIE spot prices**.

## License

MIT
