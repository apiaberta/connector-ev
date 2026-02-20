/**
 * connector.js — EV charging prices
 * Sources:
 *   - OMIE spot prices (Portugal): https://www.omie.es
 *   - CEME tariffs: manual entry (no public APIs available)
 */

import { OMIE, Tariff } from './db/models.js'

const OMIE_BASE_URL = 'https://www.omie.es/sites/default/files/dados'

/**
 * Fetch OMIE prices for a specific date
 * URL pattern: AGNO_{YYYY}/MES_{MM}/TXT/INT_PBC_EV_H_1_{DD}_{MM}_{YYYY}_{DD}_{MM}_{YYYY}.TXT
 */
export async function fetchOMIE(date = new Date()) {
  const d = typeof date === 'string' ? new Date(date) : date
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')

  const url = `${OMIE_BASE_URL}/AGNO_${yyyy}/MES_${mm}/TXT/INT_PBC_EV_H_1_${dd}_${mm}_${yyyy}_${dd}_${mm}_${yyyy}.TXT`
  
  try {
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`OMIE fetch failed: ${res.status} ${res.statusText}`)
    }

    // Read as Latin-1 (ISO-8859-1) encoding
    const buffer = await res.arrayBuffer()
    const decoder = new TextDecoder('iso-8859-1')
    const text = decoder.decode(buffer)

    return parseOMIETXT(text, `${yyyy}-${mm}-${dd}`)
  } catch (err) {
    throw new Error(`Failed to fetch OMIE data for ${yyyy}-${mm}-${dd}: ${err.message}`)
  }
}

/**
 * Parse OMIE TXT file (CSV with ; separator, Latin-1 encoding)
 * Extract "Precio marginal en el sistema portugués" line → 96 values (H1Q1...H24Q4)
 */
function parseOMIETXT(text, dateStr) {
  const lines = text.split('\n')
  
  // Find the line with Portugal prices
  const ptLine = lines.find(l => l.includes('Precio marginal en el sistema portugués'))
  if (!ptLine) {
    throw new Error('Portugal price line not found in OMIE file')
  }

  // Split by semicolon, skip first column (label)
  const values = ptLine.split(';').slice(1).map(v => v.trim().replace(',', '.'))
  
  // Should have 96 values (24 hours × 4 quarters)
  if (values.length < 96) {
    throw new Error(`Expected 96 price values, got ${values.length}`)
  }

  const prices = []
  for (let hour = 1; hour <= 24; hour++) {
    for (let quarter = 1; quarter <= 4; quarter++) {
      const idx = (hour - 1) * 4 + (quarter - 1)
      const priceMWh = parseFloat(values[idx])
      
      if (!isNaN(priceMWh)) {
        prices.push({
          date: dateStr,
          hour,
          quarter,
          price_mwh: priceMWh,
          price_kwh: Math.round(priceMWh / 10) / 100, // Convert to €/kWh with 2 decimals
          country: 'PT',
          updated_at: new Date()
        })
      }
    }
  }

  return prices
}

/**
 * Store OMIE prices in MongoDB
 */
export async function storeOMIE(prices) {
  let stored = 0
  
  for (const price of prices) {
    await OMIE.findOneAndUpdate(
      { date: price.date, hour: price.hour, quarter: price.quarter },
      price,
      { upsert: true, new: true }
    )
    stored++
  }

  return { stored, date: prices[0]?.date }
}

/**
 * Initialize CEME tariffs (manual data entry)
 * Source: ev-research-report.md + manual updates
 */
export async function initializeTariffs() {
  const tariffs = [
    {
      ceme: 'Via Verde Electric',
      tariff_type: 'fixed',
      period_type: 'simples',
      price_vazio: 0.148,
      price_normal: 0.148,
      activation_fee: 0,
      notes: 'Via app VV; CEME é Ecochoice',
      source_url: 'https://www.viaverde.pt/via-verde/servicos/via-verde-electric'
    },
    {
      ceme: 'EVIO',
      tariff_type: 'fixed',
      period_type: 'simples',
      price_vazio: 0.149,
      price_normal: 0.149,
      activation_fee: 0.15,
      notes: 'App + cartão, taxa de ativação por carga',
      source_url: 'https://evio.pt/'
    },
    {
      ceme: 'EDP Charge',
      tariff_type: 'fixed',
      period_type: 'vazio',
      price_vazio: 0.1781,
      price_normal: 0.2546,
      activation_fee: 0,
      notes: 'Bi-horária, 20% desc. para clientes EDP',
      source_url: 'https://www.edp.pt/particulares/servicos/mobilidade-eletrica/'
    },
    {
      ceme: 'EDP Charge (clientes EDP)',
      tariff_type: 'fixed',
      period_type: 'vazio',
      price_vazio: 0.1009,
      price_normal: 0.2157,
      activation_fee: 0,
      notes: 'Clientes EDP Comercial',
      source_url: 'https://www.edp.pt/particulares/servicos/mobilidade-eletrica/'
    },
    {
      ceme: 'Galp Electric',
      tariff_type: 'fixed',
      period_type: 'vazio',
      price_vazio: 0.1954,
      price_normal: 0.2632,
      activation_fee: 0.1572,
      notes: 'Bi-horária, descontos plano Galp (8-18%)',
      source_url: 'https://www.galp.com/pt/pt/particulares/estrada/galp-electric'
    },
    {
      ceme: 'Goldenergy',
      tariff_type: 'fixed',
      period_type: 'simples',
      price_vazio: 0.2222,
      price_normal: 0.2222,
      activation_fee: 0,
      notes: 'Clientes Goldenergy',
      source_url: 'https://www.goldenergy.pt/'
    },
    {
      ceme: 'Goldenergy (não-cliente)',
      tariff_type: 'fixed',
      period_type: 'simples',
      price_vazio: 0.2778,
      price_normal: 0.2778,
      activation_fee: 0,
      notes: 'Não-clientes',
      source_url: 'https://www.goldenergy.pt/'
    },
    {
      ceme: 'LUZiGÁS',
      tariff_type: 'indexed',
      period_type: null,
      price_vazio: null,
      price_normal: null,
      activation_fee: 0,
      notes: 'Indexada ao OMIE: PE(h) = EC × (P_OMIE(h) + K + CGS(h)) × (1 + PERDAS(h))',
      source_url: 'https://www.luzigas.pt/en/eletrical-mobility-plan/'
    }
  ]

  let upserted = 0
  for (const t of tariffs) {
    await Tariff.findOneAndUpdate(
      { ceme: t.ceme },
      { ...t, updated_at: new Date() },
      { upsert: true, new: true }
    )
    upserted++
  }

  return { upserted }
}

/**
 * Main fetch and store routine
 */
export async function fetchAndStore() {
  // Fetch today's OMIE prices
  const today = new Date()
  const prices = await fetchOMIE(today)
  const result = await storeOMIE(prices)
  
  return {
    omie: result,
    timestamp: new Date().toISOString()
  }
}
