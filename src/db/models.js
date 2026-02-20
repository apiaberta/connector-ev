import mongoose from 'mongoose'

// CEME tariffs (fixed and indexed)
const tariffSchema = new mongoose.Schema({
  ceme:           { type: String, required: true },       // "Via Verde Electric", "LUZiGÁS", etc.
  tariff_type:    { type: String, enum: ['fixed', 'indexed'], required: true },
  period_type:    { type: String, enum: ['simples', 'vazio', 'fora_vazio'] }, // for fixed tariffs
  price_vazio:    Number,   // €/kWh vazio (fixed)
  price_normal:   Number,   // €/kWh fora-vazio (fixed)
  activation_fee: Number,   // €/charge
  notes:          String,
  source_url:     String,
  updated_at:     { type: Date, default: Date.now }
})
tariffSchema.index({ ceme: 1 })

// OMIE spot prices (Portugal)
const omieSchema = new mongoose.Schema({
  date:       { type: String, required: true }, // YYYY-MM-DD
  hour:       { type: Number, required: true, min: 1, max: 24 },
  quarter:    { type: Number, required: true, min: 1, max: 4 }, // Q1-Q4 (15min intervals)
  price_mwh:  { type: Number, required: true }, // €/MWh
  price_kwh:  { type: Number, required: true }, // €/kWh (price_mwh / 1000)
  country:    { type: String, default: 'PT' },
  updated_at: { type: Date, default: Date.now }
})
omieSchema.index({ date: 1, hour: 1, quarter: 1 }, { unique: true })
omieSchema.index({ date: 1 })

export const Tariff = mongoose.model('Tariff', tariffSchema)
export const OMIE = mongoose.model('OMIE', omieSchema)
