// Konum: app/api/field-logs/route.ts
// Kopyala → projen/app/api/field-logs/route.ts

import { NextRequest, NextResponse } from 'next/server'

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

export function fieldLog(
  type: FieldEvent['type'],
  action: string,
  data?: Omit<FieldEvent, 'type' | 'action' | 'ts'>
) {
  events.unshift({ type, action, ts: Date.now(), ...data })
  if (events.length > MAX_EVENTS) events.length = MAX_EVENTS
}

// Örnek kullanımlar:
//   import { fieldLog } from '@/app/api/field-logs/route'
//   fieldLog('auth', 'login_success', { userId: user.id, email: user.email, ip })
//   fieldLog('auth', 'login_failed',  { email, ip })
//   fieldLog('error', 'api_error',    { meta: { message: err.message } })

export async function GET(req: NextRequest) {
  const key = process.env.FIELD_DEVICE_KEY
  if (key) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${key}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  return NextResponse.json({
    project:     process.env.npm_package_name ?? 'unknown',
    environment: process.env.NODE_ENV ?? 'unknown',
    events:      events.slice(0, 50),
    total:       events.length,
    ts:          new Date().toISOString(),
  })
}
