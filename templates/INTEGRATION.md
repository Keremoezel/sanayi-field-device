# Field Device — Proje Entegrasyon Rehberi

Her projeye 2 endpoint ekleyerek Field Device'dan tam izleme sağlarsın:
- `/api/health` → servis durumu (DB, AI, vs.)
- `/api/field-logs` → kim giriş yaptı, hatalar, olaylar

---

## 1. Hangi template'i kullanacağım?

| Proje tipi | Health | Field Logs |
|---|---|---|
| Nuxt.js | `nuxt-health.ts` | `nuxt-field-log.ts` |
| Next.js (App Router) | `nextjs-health.ts` | `nextjs-field-log.ts` |

---

## 2. Nuxt.js Projesi

### Adım 1 — Dosyaları kopyala

```
templates/nuxt-health.ts    →  projen/server/api/health.ts
templates/nuxt-field-log.ts →  projen/server/api/field-logs.ts
```

### Adım 2 — .env'e anahtar ekle

```env
FIELD_DEVICE_KEY=buraya-guclu-bir-sifre-yaz
```

> Field Device'ın `.env` dosyasında da aynı değer olmalı.

### Adım 3 — DB kontrolünü bağla (health.ts)

`server/api/health.ts` içinde `checkDatabase()` fonksiyonunu kendi DB bağlantına göre düzenle:

```ts
// Prisma örneği:
async function checkDatabase() {
  const start = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    return { status: 'ok', ms: Date.now() - start }
  } catch {
    return { status: 'down', ms: Date.now() - start }
  }
}
```

### Adım 4 — Giriş/çıkış olaylarını kaydet (field-logs.ts)

Auth kodundan `fieldLog` çağır:

```ts
// server/api/auth/login.post.ts (örnek)
import { fieldLog } from '~/server/api/field-logs'

// Başarılı giriş
fieldLog('auth', 'login_success', { userId: user.id, email: user.email, ip })

// Başarısız giriş
fieldLog('auth', 'login_failed', { email, ip })

// Çıkış
fieldLog('auth', 'logout', { userId: session.userId })
```

### Adım 5 — Test et

```bash
curl https://projen.vercel.app/api/health
curl -H "Authorization: Bearer FIELD_DEVICE_KEY_DEGERI" https://projen.vercel.app/api/field-logs
```

---

## 3. Next.js Projesi (App Router)

### Adım 1 — Dosyaları kopyala

```
templates/nextjs-health.ts    →  projen/app/api/health/route.ts
templates/nextjs-field-log.ts →  projen/app/api/field-logs/route.ts
```

### Adım 2 — .env.local'e anahtar ekle

```env
FIELD_DEVICE_KEY=buraya-guclu-bir-sifre-yaz
```

### Adım 3 — DB kontrolünü bağla (route.ts)

```ts
// Drizzle örneği:
async function checkDatabase() {
  const start = Date.now()
  try {
    await db.execute(sql`SELECT 1`)
    return { status: 'ok', ms: Date.now() - start }
  } catch {
    return { status: 'down', ms: Date.now() - start }
  }
}
```

### Adım 4 — Giriş/çıkış olaylarını kaydet

```ts
// app/api/auth/[...nextauth]/route.ts veya server action
import { fieldLog } from '@/app/api/field-logs/route'

// NextAuth callbacks içinde:
async signIn({ user, account }) {
  fieldLog('auth', 'login_success', { userId: user.id, email: user.email ?? null })
  return true
},
```

### Adım 5 — Test et

```bash
curl https://projen.vercel.app/api/health
curl -H "Authorization: Bearer FIELD_DEVICE_KEY_DEGERI" https://projen.vercel.app/api/field-logs
```

---

## 4. Field Device'a projeyi ekle

`server/data/projects.json` dosyasına yeni proje satırı ekle:

```json
{
  "id": "projem",
  "name": "Projem",
  "url": "https://projem.vercel.app",
  "healthPath": "/api/health",
  "host": "vercel",
  "color": "#f59e0b",
  "features": []
}
```

| Alan | Açıklama |
|---|---|
| `id` | Benzersiz kısa isim (küçük harf) |
| `url` | Projenin tam adresi (sondaki `/` olmadan) |
| `healthPath` | Health endpoint yolu (genelde `/api/health`) |
| `host` | `vercel` veya `coolify` |
| `color` | Monitor'da gösterilecek renk (isteğe bağlı) |

---

## 5. Kontrol listesi

- [ ] `server/api/health.ts` veya `app/api/health/route.ts` eklendi
- [ ] `server/api/field-logs.ts` veya `app/api/field-logs/route.ts` eklendi
- [ ] Proje `.env`'e `FIELD_DEVICE_KEY` eklendi
- [ ] Field Device `.env`'de aynı `FIELD_DEVICE_KEY` var
- [ ] `checkDatabase()` gerçek DB bağlantısına bağlandı
- [ ] Auth koduna `fieldLog(...)` çağrıları eklendi
- [ ] `server/data/projects.json`'a proje eklendi
- [ ] `curl /api/health` çalışıyor
- [ ] `curl /api/field-logs` 401 veriyor (key olmadan), 200 veriyor (key ile)
