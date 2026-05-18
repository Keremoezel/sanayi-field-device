// Konum: server/api/field-logs.ts
// Kopyala → projen/server/api/field-logs.ts
//
// Field Device bu endpoint'i çekerek:
//   - Son uygulama olaylarını görür
//   - Kim giriş yaptı / başarısız girişler
//   - Hata logları
//
// Güvenlik: FIELD_DEVICE_KEY env değişkeniyle korunur
// Projen .env → FIELD_DEVICE_KEY=buraya-anahtar-yaz
// Field Device .env → FIELD_DEVICE_KEY=aynı-anahtar

import { defineEventHandler, getHeader, createError } from 'h3'

// Bellekte tutulan event listesi (uygulama restart'ta sıfırlanır)
// İstersen DB'ye de yazabilirsin
const events: FieldEvent[] = []
const MAX_EVENTS = 200

interface FieldEvent {
  type:    'auth' | 'error' | 'info' | 'warn'
  action:  string
  userId?: string | null
  email?:  string | null
  ip?:     string | null
  meta?:   Record<string, unknown>
  ts:      number
}

// ─── Bu fonksiyonu projenin herhangi bir yerinden çağır ───────────────────────
export function fieldLog(
  type: FieldEvent['type'],
  action: string,
  data?: Omit<FieldEvent, 'type' | 'action' | 'ts'>
) {
  events.unshift({ type, action, ts: Date.now(), ...data })
  if (events.length > MAX_EVENTS) events.length = MAX_EVENTS
}

// Örnek kullanımlar (projenin auth koduna ekle):
//
//   import { fieldLog } from '~/server/api/field-logs'
//
//   fieldLog('auth', 'login_success',  { userId: user.id, email: user.email, ip })
//   fieldLog('auth', 'login_failed',   { email, ip })
//   fieldLog('auth', 'logout',         { userId: user.id })
//   fieldLog('auth', 'register',       { userId: user.id, email })
//   fieldLog('error', 'db_error',      { meta: { message: err.message } })
//   fieldLog('info',  'api_request',   { meta: { path: '/api/scan' } })
// ─────────────────────────────────────────────────────────────────────────────

export default defineEventHandler((event) => {
  const key = process.env.FIELD_DEVICE_KEY
  if (key) {
    const auth = getHeader(event, 'authorization')
    if (auth !== `Bearer ${key}`) {
      throw createError({ statusCode: 401, message: 'Unauthorized' })
    }
  }

  const limit = 50
  return {
    project:     process.env.npm_package_name ?? 'unknown',
    environment: process.env.NODE_ENV ?? 'unknown',
    events:      events.slice(0, limit),
    total:       events.length,
    ts:          new Date().toISOString(),
  }
})
