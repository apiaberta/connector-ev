import { Tariff, OMIE } from '../db/models.js'

export async function dataRoutes(app) {

  // GET /ev/tariffs — list all CEME tariffs with current price
  app.get('/ev/tariffs', {
    schema: {
      description: 'List CEME tariffs with current prices',
      tags: ['EV'],
      querystring: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['fixed', 'indexed'], description: 'Filter by tariff type' }
        }
      }
    }
  }, async (req) => {
    const query = {}
    if (req.query.type) query.tariff_type = req.query.type

    const tariffs = await Tariff.find(query).sort({ ceme: 1 })

    // Get current hour for OMIE-based calculation
    const now = new Date()
    const currentHour = now.getHours() + 1 // OMIE hours are 1-24
    const currentQuarter = Math.floor(now.getMinutes() / 15) + 1

    const dateStr = now.toISOString().split('T')[0]
    const currentOMIE = await OMIE.findOne({ 
      date: dateStr, 
      hour: currentHour,
      quarter: currentQuarter
    })

    return {
      data: tariffs.map(t => {
        const base = {
          ceme: t.ceme,
          tariff_type: t.tariff_type,
          period_type: t.period_type,
          activation_fee_eur: t.activation_fee,
          notes: t.notes,
          source_url: t.source_url,
          updated_at: t.updated_at
        }

        if (t.tariff_type === 'fixed') {
          return {
            ...base,
            price_vazio_eur_kwh: t.price_vazio,
            price_normal_eur_kwh: t.price_normal,
            current_price_eur_kwh: isVazioHour(now) ? t.price_vazio : t.price_normal
          }
        } else {
          // Indexed tariff (LUZiGÁS) - show OMIE price if available
          return {
            ...base,
            current_omie_eur_kwh: currentOMIE?.price_kwh || null,
            note: 'Price varies hourly based on OMIE spot market'
          }
        }
      }),
      meta: {
        current_time: now.toISOString(),
        current_hour: currentHour,
        current_quarter: currentQuarter,
        current_omie_price_kwh: currentOMIE?.price_kwh || null
      }
    }
  })

  // GET /ev/tariffs/cheapest — ranking of cheapest tariffs for given kWh
  app.get('/ev/tariffs/cheapest', {
    schema: {
      description: 'Rank cheapest CEME tariffs for a given charge amount',
      tags: ['EV'],
      querystring: {
        type: 'object',
        properties: {
          kwh: { type: 'number', default: 40, description: 'kWh to charge' }
        },
        required: ['kwh']
      }
    }
  }, async (req) => {
    const kwh = parseFloat(req.query.kwh) || 40
    const now = new Date()
    const isVazio = isVazioHour(now)

    const tariffs = await Tariff.find({ tariff_type: 'fixed' })

    const ranked = tariffs.map(t => {
      const pricePerKwh = isVazio ? t.price_vazio : t.price_normal
      const energyCost = pricePerKwh * kwh
      const totalCost = energyCost + (t.activation_fee || 0)

      return {
        ceme: t.ceme,
        price_per_kwh_eur: pricePerKwh,
        energy_cost_eur: Math.round(energyCost * 100) / 100,
        activation_fee_eur: t.activation_fee || 0,
        total_cost_eur: Math.round(totalCost * 100) / 100,
        period: isVazio ? 'vazio' : 'fora_vazio'
      }
    }).sort((a, b) => a.total_cost_eur - b.total_cost_eur)

    return {
      data: ranked,
      meta: {
        kwh_requested: kwh,
        current_time: now.toISOString(),
        current_period: isVazio ? 'vazio' : 'fora_vazio',
        note: 'Prices include activation fees where applicable. OMIE-indexed tariffs excluded.'
      }
    }
  })

  // GET /ev/omie/current — current OMIE spot price for Portugal
  app.get('/ev/omie/current', {
    schema: {
      description: 'Current OMIE spot price in Portugal',
      tags: ['EV']
    }
  }, async () => {
    const now = new Date()
    const hour = now.getHours() + 1
    const quarter = Math.floor(now.getMinutes() / 15) + 1
    const dateStr = now.toISOString().split('T')[0]

    const current = await OMIE.findOne({ date: dateStr, hour, quarter })

    if (!current) {
      return {
        error: 'No OMIE data available for current time',
        requested_time: now.toISOString(),
        requested_hour: hour,
        requested_quarter: quarter
      }
    }

    return {
      data: {
        date: current.date,
        hour: current.hour,
        quarter: current.quarter,
        price_eur_mwh: current.price_mwh,
        price_eur_kwh: current.price_kwh,
        timestamp: now.toISOString()
      }
    }
  })

  // GET /ev/omie/today — all OMIE prices for today (96 intervals)
  app.get('/ev/omie/today', {
    schema: {
      description: 'All OMIE spot prices for today (96 x 15min intervals)',
      tags: ['EV']
    }
  }, async () => {
    const dateStr = new Date().toISOString().split('T')[0]
    const prices = await OMIE.find({ date: dateStr }).sort({ hour: 1, quarter: 1 })

    return {
      data: prices.map(p => ({
        hour: p.hour,
        quarter: p.quarter,
        time_label: `H${p.hour}Q${p.quarter}`,
        price_eur_mwh: p.price_mwh,
        price_eur_kwh: p.price_kwh
      })),
      meta: {
        date: dateStr,
        count: prices.length,
        expected: 96
      }
    }
  })
}

/**
 * Check if current time is "vazio" period
 * Simplified logic: vazio = 22:00-08:00 + weekends
 */
function isVazioHour(date) {
  const hour = date.getHours()
  const day = date.getDay()
  
  // Weekend = vazio
  if (day === 0 || day === 6) return true
  
  // Weekday: 22:00-08:00 = vazio
  return hour >= 22 || hour < 8
}
