// Konum: app/api/health/route.ts
// Kopyala → projen/app/api/health/route.ts

import { NextResponse } from 'next/server'

async function checkDatabase(): Promise<{ status: string; ms: number | null }> {
  const start = Date.now()
  try {
    // Örnek: await db.execute(sql`SELECT 1`)
    return { status: 'ok', ms: Date.now() - start }
  } catch {
    return { status: 'down', ms: Date.now() - start }
  }
}

async function checkExternalService(url: string): Promise<{ status: string; ms: number | null }> {
  const start = Date.now()
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(4000) })
    return { status: res.ok ? 'ok' : 'degraded', ms: Date.now() - start }
  } catch {
    return { status: 'down', ms: Date.now() - start }
  }
}

export async function GET() {
  const [database] = await Promise.all([
    checkDatabase(),
    // checkExternalService('https://...'),
  ])

  const services = { database }

  const allOk         = Object.values(services).every(s => s.status === 'ok')
  const anyDown       = Object.values(services).some(s => s.status === 'down')
  const overallStatus = anyDown ? 'down' : allOk ? 'ok' : 'degraded'

  return NextResponse.json({
    status:      overallStatus,
    version:     process.env.npm_package_version ?? '—',
    environment: process.env.NODE_ENV ?? 'unknown',
    timestamp:   new Date().toISOString(),
    services,
  })
}
