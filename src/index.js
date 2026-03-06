import Fastify from 'fastify'
import mongoose from 'mongoose'
import cron from 'node-cron'
import { dataRoutes } from './routes/data.js'
import { metaRoutes } from './routes/meta.js'
import { fetchAndStore, initializeTariffs } from './connector.js'
import { OMIE, Tariff } from './db/models.js'

const app = Fastify({
  logger: {
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty' }
      : undefined
  }
})

const SERVICE_NAME = 'connector-ev'
const PORT      = parseInt(process.env.PORT || '3004')
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/apiaberta-ev'

// ─── Required endpoints ──────────────────────────────────────────────────────

app.get('/health', async () => ({
  status: 'ok',
  service: SERVICE_NAME,
  version: '1.0.0',
  timestamp: new Date().toISOString()
}))

app.get('/meta', async () => {
  const lastOMIE = await OMIE.findOne().sort({ updated_at: -1 })
  const tariffCount = await Tariff.countDocuments()
  const omieRecords = await OMIE.countDocuments()

  return {
    service:          SERVICE_NAME,
    sources: {
      omie:   'https://www.omie.es (OMIE Iberian spot market)',
      cemes:  'Manual entry from CEME websites and reports'
    },
    description:      'EV charging prices in Portugal: CEME tariffs + OMIE spot prices',
    last_updated:     lastOMIE?.updated_at || null,
    record_count: {
      tariffs: tariffCount,
      omie_prices: omieRecords
    },
    update_frequency: 'OMIE: daily at 13:30 PT (day-ahead prices)'
  }
})

// ─── Data routes ─────────────────────────────────────────────────────────────

await app.register(dataRoutes)
await app.register(metaRoutes)

// ─── Cron: fetch OMIE daily at 13:30 Lisbon time ────────────────────────────

cron.schedule('30 13 * * *', async () => {
  app.log.info('Starting OMIE data fetch (day-ahead prices)...')
  try {
    const result = await fetchAndStore()
    app.log.info({ result }, 'OMIE data fetch complete')
  } catch (err) {
    app.log.error({ err }, 'OMIE data fetch failed')
  }
}, { timezone: 'Europe/Lisbon' })

// ─── Startup ─────────────────────────────────────────────────────────────────

await mongoose.connect(MONGO_URI)
app.log.info('Connected to MongoDB')

// Initialize CEME tariffs if none exist
const tariffCount = await Tariff.countDocuments()
if (tariffCount === 0) {
  app.log.info('No tariffs found — initializing CEME tariff database...')
  const result = await initializeTariffs()
  app.log.info({ result }, 'CEME tariffs initialized')
}

// Fetch today's OMIE data if missing
const today = new Date().toISOString().split('T')[0]
const hasOMIE = await OMIE.findOne({ date: today })
if (!hasOMIE) {
  app.log.info('No OMIE data for today — running initial fetch...')
  fetchAndStore()
    .then(r => app.log.info({ result: r }, 'Initial OMIE fetch complete'))
    .catch(err => app.log.error({ err }, 'Initial OMIE fetch failed'))
}

await app.listen({ port: PORT, host: '0.0.0.0' })
