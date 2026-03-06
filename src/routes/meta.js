import { Tariff, OMIE } from '../db/models.js'

export async function metaRoutes(app) {
  app.get('/ev/meta', {
    schema: {
      description: 'Metadata and stats for the EV connector',
      tags: ['EV']
    }
  }, async () => {
    const [tariffCount, omieCount, lastOmie] = await Promise.all([
      Tariff.countDocuments(),
      OMIE.countDocuments(),
      OMIE.findOne().sort({ updated_at: -1 }).select('updated_at date').lean()
    ])
    return {
      connector:   'connector-ev',
      version:     '1.0.0',
      description: 'EV charging tariffs (CEME) and OMIE electricity spot prices for Portugal',
      sources: [
        'https://www.erse.pt (CEME tariffs)',
        'https://www.omie.es (spot prices)'
      ],
      update_freq: 'Spot prices: every 4 hours; Tariffs: periodic',
      endpoints: [
        { path: '/v1/ev/tariffs', description: 'CEME charging tariffs' },
        { path: '/v1/ev/spot',    description: 'OMIE electricity spot prices (hourly/quarter)' }
      ],
      stats: {
        tariffs:        tariffCount,
        spot_records:   omieCount,
        last_spot_sync: lastOmie?.updated_at ?? null,
        last_spot_date: lastOmie?.date ?? null
      }
    }
  })
}
