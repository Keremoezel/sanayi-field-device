# Sanayi Field Device — Komple Rewrite Planı v2.0

> Mevcut v0.3.0 üzerine kapsamlı yeniden yazım. UI, backend, scanner, log sistemi komple yenileniyor.

---

## 🎯 Hedef

Şu anki durum → hedef:

| Konu | Şu an | Hedef |
|---|---|---|
| UI tasarımı | Temel iOS tarzı | Premium glassmorphism dark UI, animasyonlu |
| Scanner | Placeholder (Faz 2 bekliyor) | Çalışan kamera + fotoğraf analizi |
| Log sistemi | Tek seviyeli local logs | Project-bazlı + tip filtreli + detay modalı |
| Monitor | Basit health ping | Rich health data + trend grafik |
| Vercel | Deployment listesi | Build log + trigger deploy |
| History | Boş liste | Detaylı scan kartları + görsel preview |
| Tools | Ping + restart | Komple developer toolkit |
| Versiyon | `0.3.0` | `1.0.0` |

---

## 📁 Yeni Proje Yapısı

```
sanayi-field-device/
  server/
    index.js                  ← v1.0.0, yeni route'lar
    routes/
      monitor.js              ← mevcut, iyileştirilecek
      vercel.js               ← mevcut, genişletilecek
      events.js               ← mevcut, iyileştirilecek
      history.js              ← mevcut, iyileştirilecek
      health.js               ← versiyon fix + detay
      tools.js                ← ping + env + restart
      scanner.js              ← YENİ: frame proxy + analiz
      projects.js             ← mevcut
    services/
      checker.js              ← mevcut
      logger.js               ← mevcut
      notifier.js             ← mevcut
      scan-store.js           ← YENİ: scan CRUD
    data/
      projects.json           ← mevcut
      scans.json              ← YENİ (oluşturulacak)
      logs.json               ← mevcut
    workers/
      updater.js              ← mevcut
  public/
    index.html                ← KOMPLEt YENİDEN YAZIM
    scanner.html              ← KOMPLE YENİDEN YAZIM (Faz 2)
    style.css                 ← Ayrı CSS dosyası (inline yerine)
    manifest.json             ← mevcut, güncellenecek
    sw.js                     ← YENİ: gelişmiş service worker
    icons/                    ← mevcut
  scripts/
    start.sh
    boot.sh
  .env
  package.json                ← v1.0.0
```

---

## 🎨 BÖLÜM 1 — UI/UX Komple Redesign

### 1.1 Yeni Design System

**Mevcut sorunlar:**
- Tüm CSS inline `<style>` içinde (847 satır HTML)
- Ayrı CSS dosyası yok
- Animasyonlar çok minimal
- Font sistem fontu (özel font yok)
- Glassmorphism yok, düz `#0d0d0d` arka planlar

**Yapılacaklar:**

```css
/* Yeni: public/style.css */

/* Font — Google Fonts yerine CDN-free system stack */
:root {
  --font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --mono: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;

  /* Yeni renk paleti — daha canlı, gradient destekli */
  --c-bg:       #080810;
  --c-surface:  #0e0e1a;
  --c-card:     #13131f;
  --c-border:   rgba(255,255,255,0.06);
  --c-border2:  rgba(255,255,255,0.10);

  /* Metin */
  --c-t1: #f0f0ff;
  --c-t2: #8888aa;
  --c-t3: #44445a;

  /* Aksan renkler - daha vibrant */
  --c-blue:    #4f8ef7;
  --c-green:   #34d988;
  --c-red:     #ff5b5b;
  --c-yellow:  #ffcc00;
  --c-orange:  #ff8c42;
  --c-purple:  #c084fc;
  --c-teal:    #22d3ee;
  --c-pink:    #f472b6;

  /* Glassmorphism */
  --glass-bg:     rgba(14,14,26,0.72);
  --glass-border: rgba(255,255,255,0.08);
  --glass-blur:   saturate(180%) blur(24px);

  /* Gradients */
  --grad-blue:   linear-gradient(135deg, #4f8ef7, #7c3aed);
  --grad-green:  linear-gradient(135deg, #34d988, #0891b2);
  --grad-orange: linear-gradient(135deg, #ff8c42, #ef4444);
}
```

**Inter font — CDN:**
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

### 1.2 Header Redesign

**Mevcut:** Sade başlık + uptime pill + saat

**Yeni:**
```
┌─────────────────────────────────────────────┐
│ 🔴  Sanayi Field Device    v1.0.0   02:54  │
│     Sanayi: ● Online  Zanzibar: ● Online   │
└─────────────────────────────────────────────┘
```

- Glassmorphism header (blur + border)
- Tüm projelerin mini status ledleri header'da
- Versiyon gösterimi
- Saat animasyonlu (sweep animasyonu)
- Orta kısımda breadcrumb (hangi tab aktif)

### 1.3 Tab Navigation Redesign

**Mevcut:** 5 tab, emoji + küçük yazı

**Yeni:**
- Aktif tab için gradient highlight + glow efekti
- Unread badge (yeni log/event geldiğinde)
- Haptic-friendly boyut (min 44px tap target)
- Smooth slide animasyonu tab geçişlerinde

```
[ 📷 Scanner ]  [ 📊 Monitor ]  [ 🗂 History ]  [ 📋 Logs ]  [ ⚙️ Tools ]
                      ▔▔▔▔▔▔▔▔ (aktif göstergesi - gradient bar)
```

### 1.4 Monitor Tab Redesign

**Mevcut:** 2x2 svc-card + proje listesi + vercel listesi

**Yeni:**

```
SANAYI SERVİSLERİ
┌──────────┬──────────┬──────────┬──────────┐
│  API     │ Database │ AI Model │   Blob   │
│  ● 234ms │  ● 89ms  │  ● 1.2s  │  ● 445ms │
│  Online  │  Online  │  Online  │  Online  │
└──────────┴──────────┴──────────┴──────────┘

ORTAM BİLGİSİ
Environment: production   Version: 1.2.3
Bugünkü Analiz: 14        Ort. Süre: 2.8s

PROJELERİM
┌─────────────────────────────────────────────┐
│ 🔵 Sanayi Uygulaması          ● Online  234ms│
│    vercel.app  [scanner] [monitor]           │
├─────────────────────────────────────────────┤
│ 🟢 Zanzibar Barış Derneği     ● Online  180ms│
│    coolify                                  │
└─────────────────────────────────────────────┘

VERCEL DEPLOYLAR
┌─────────────────────────────────────────────┐
│ sanayi-uygulamasi          ✓ Hazır  2dk önce│
│ "fix: health check endpoint"  main  45s build│
│ Kerem Özel                                  │
├─────────────────────────────────────────────┤
│ zanzibar                   ✓ Hazır  1sa önce│
└─────────────────────────────────────────────┘
```

Ek özellikler:
- Her servis kartına tıklanınca detay modali açılır
- Otomatik 30s yenileme + countdown bar
- "Son kontrol: 14s önce" yerine canlı geri sayım
- Vercel kartında commit hash kopyalama butonu

### 1.5 Logs Tab — Komple Yeniden Yazım

**Mevcut sorunlar:**
- Sadece `/api/field-logs` endpoint'i olan projelerin logu gösteriliyor
- Hiç filtre yok (type, proje, zaman aralığı)
- Log detayı yok (tıklanınca modal yok)
- Local server logları ayrı Tools tab'ında

**Yeni sistem:**

#### İki log kaynağı:

**1. Remote Project Logs** (`/api/events`)
- Her projeden `/api/field-logs` ile çekilen auth/error eventleri

**2. Local Device Logs** (`/api/tools/logs`)
- Field device'ın kendi logları (server start, ping, güncelleme vs.)

#### Yeni Logs Tab UI:

```
LOGS
[ Tümü ]  [ Sanayi ]  [ Zanzibar ]  [ Device ]
[ auth ] [ error ] [ warn ] [ info ]

─────────────────────────────────────────────
02:41  ✓ Giriş yapıldı                  [auth]
       kerem@example.com  192.168.1.1
       [Sanayi]   <tıkla detay için>
─────────────────────────────────────────────
02:39  ✗ Giriş başarısız               [error]
       unknown@test.com
       [Sanayi]
─────────────────────────────────────────────
02:35  Field Device güncellendi         [info]
       Commit: abc1234  [Device]
─────────────────────────────────────────────
```

#### Log Detay Modali:

Bir log satırına tıklanınca:

```
┌─────────────────────────────────┐
│  ✓ Giriş yapıldı                │
│                                 │
│  Zaman:    02:41:33             │
│  Proje:    Sanayi Uygulaması    │
│  Tip:      auth                 │
│  Action:   login_success        │
│  Email:    kerem@example.com    │
│  IP:       192.168.1.1          │
│  User-Agent: ...                │
│                                 │
│  Raw payload:                   │
│  { "userId": 5, ... }           │
│                           [✕]  │
└─────────────────────────────────┘
```

### 1.6 History Tab Redesign

**Mevcut:** Basit liste (şu an boş, scanner yok)

**Yeni (Scanner Faz 2 sonrası dolacak):**

```
TARAMA GEÇMİŞİ  (14 tarama)

[Fotoğraf] [Canlı Frame]  filtreler ▼

┌─────────────────────────────────┐
│ [görsel thumbnail]              │
│ Scan #14   Orta Risk  %64 güven │
│ 18.05.2026 15:42                │
│ Ön sağ bölge · tampon           │
│ [● Backend'e gönderildi]        │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ [görsel thumbnail]              │
│ Scan #13   Düşük Risk  %31 güven│
│ 18.05.2026 14:10                │
│ [○ Local — gönderilmedi]        │
└─────────────────────────────────┘
```

Tıklayınca detay:
- Orijinal + annotated görsel yan yana
- Tüm detection box bilgileri
- "Sanayi'ye gönder" butonu (göndermemiş olanlar için)
- Sil butonu

### 1.7 Scanner Tab — Faz 2 Implementasyonu

**Mevcut:** Sadece placeholder + roadmap

**Yeni (çalışan Faz 2):**

```
LIVE DAMAGE SCANNER

┌─────────────────────────────────┐
│                                 │
│   [Kamera görüntüsü / video]    │
│                                 │
│   [Sarı kutu overlay]           │
│   Hasar ihtimali                │
│                                 │
└─────────────────────────────────┘

[ 📷 Fotoğraf Çek ]  [ ⟳ Canlı Mod ]

Son analiz: 2s önce  Risk: Orta  %64

[ 💾 Kaydet ]  [ 📤 Sanayi'ye Gönder ]
```

**Faz 2 — Fotoğraf Modu:**
1. `getUserMedia()` ile kamera aç
2. `<video>` elementinde göster
3. Butona basınca `<canvas>`'a yakala
4. JPEG blob → `/api/scanner/analyze` 
5. Server → Sanayi AI endpoint'i
6. Response → canvas'a kutu çiz
7. Kaydet / Gönder seçenekleri

### 1.8 Tools Tab Redesign

**Mevcut:** Ping butonları + restart + local logs

**Yeni:**

```
HIZLI KONTROL
[ Sanayi API ]  [ Zanzibar ]  [ Local ]  [ Tümünü Ping ]

SONUÇ:
✓ Sanayi Uygulaması
  HTTP 200  234ms  vercel.app

SERVER BİLGİSİ
Versiyon:    v1.0.0
Node.js:     v20.11.0
Uptime:      2s 4dk
Adres:       localhost:8787
GitHub:      Keremoezel/sanayi-field-device
             main @ abc1234  (güncel)

ENVIRONMENT
[ local ] [ dev ] [ staging ] [ prod ]
  Şu an: production

YÖNETİM
[ 🗑 Logları Temizle ]  [ 🔄 Sunucuyu Yeniden Başlat ]
[ 📤 Logları Dışa Aktar ]  [ 🔃 Update Kontrolü ]
[ 🔑 Device Key Görüntüle ]
```

---

## 🔧 BÖLÜM 2 — Backend Geliştirmeleri

### 2.1 `health.js` — Versiyon Fix

```js
// Versiyon package.json'dan okunacak
const pkg = require('../../package.json');

router.get('/', (req, res) => {
  res.json({
    status:  'online',
    uptime:  Math.floor(process.uptime()),
    version: pkg.version,   // hardcode değil
    node:    process.version,
    ts:      new Date().toISOString(),
    memory:  process.memoryUsage().rss,
  });
});
```

### 2.2 `scanner.js` — YENİ Route

```js
// POST /api/scanner/analyze
// multipart/form-data: file (image/jpeg)
// → Sanayi AI endpoint'e ilet → sonucu döndür
// → Local store'a kaydet (opsiyonel)

router.post('/analyze', upload.single('image'), async (req, res) => {
  // 1. Rate limit kontrolü
  // 2. Dosya validasyonu (jpeg, max 2MB)
  // 3. FormData olarak Sanayi API'ye ilet
  // 4. Sonucu döndür
  // 5. Local store'a kaydet
});
```

Bağımlılıklar:
- `multer` (file upload middleware)

### 2.3 `scan-store.js` — YENİ Service

CRUD operasyonları:
- `save(scan)` → `data/scans.json`'a yaz
- `list()` → tüm taramaları döndür
- `get(id)` → tek taramayı döndür
- `delete(id)` → sil
- `markSynced(id)` → synced: true işaretle

### 2.4 `tools.js` — Genişletme

Yeni endpoint'ler:

```js
// GET  /api/tools/status     → server version, uptime, memory, github info
// GET  /api/tools/env        → mevcut environment
// POST /api/tools/env        → environment değiştir (restart gerektirir)
// POST /api/tools/update     → manuel update tetikle
// GET  /api/tools/logs       → mevcut
// DELETE /api/tools/logs     → mevcut
// POST /api/tools/restart    → mevcut
// GET  /api/tools/logs/export → JSON download
```

### 2.5 `projects.json` — Scanner Endpoint Ekleme

```json
[
  {
    "id": "sanayi",
    "name": "Sanayi Uygulaması",
    "url": "https://sanayi-uygulamasi.vercel.app",
    "healthPath": "/api/health",
    "scannerPath": "/api/damage-analyses",
    "host": "vercel",
    "color": "#4f8ef7",
    "features": ["scanner", "monitor", "events"]
  }
]
```

### 2.6 `package.json` — v1.0.0 + multer

```json
{
  "name": "sanayi-field-device",
  "version": "1.0.0",
  "dependencies": {
    "dotenv": "^17.4.2",
    "express": "^4.18.2",
    "multer": "^1.4.5-lts.1"
  }
}
```

### 2.7 `data/scans.json` — Başlangıç Dosyası

```json
[]
```

---

## 📋 BÖLÜM 3 — Görev Listesi (Uygulama Sırası)

### Adım 1 — Temel Fixler (Hemen)

- [ ] `health.js` → versiyon hardcode fix (package.json'dan oku)
- [ ] `data/scans.json` → oluştur (history POST hatasını önler)
- [ ] `package.json` → version `1.0.0`, multer ekle
- [ ] `server/index.js` → v1.0.0 log mesajı

### Adım 2 — CSS Ayrıştırma

- [ ] `public/style.css` oluştur
- [ ] `index.html` inline CSS'i style.css'e taşı
- [ ] Yeni design token'larını uygula (renk, font, spacing)
- [ ] Inter + JetBrains Mono font ekle

### Adım 3 — Header + Nav Redesign

- [ ] Glassmorphism header
- [ ] Proje mini-status ledleri header'da
- [ ] Aktif tab için gradient highlight
- [ ] Tab geçiş animasyonu (slide)

### Adım 4 — Monitor Tab Redesign

- [ ] Servis kartları yeniden tasarım (gradient border-left → gradient card)
- [ ] Otomatik yenileme + countdown bar
- [ ] Proje kartı tıklama → detay modal
- [ ] Vercel kart commit hash kopyalama

### Adım 5 — Logs Tab Komple Yeniden Yazım

- [ ] İki kaynak: remote events + local device logs
- [ ] Kaynak filtresi (tabs: Tümü / proje / Device)
- [ ] Tip filtresi (auth / error / warn / info)
- [ ] Log satırı tıklama → detay modal
- [ ] Raw payload görüntüleme
- [ ] Zaman filtresi (son 1sa / 6sa / 24sa / tümü)

### Adım 6 — History Tab Redesign

- [ ] Scan kartı thumbnail (resim varsa göster)
- [ ] Risk seviyesi renk kodlaması
- [ ] Tıklama → detay modal (orijinal + annotated görsel)
- [ ] "Sanayi'ye gönder" butonu
- [ ] Filtre (photo / live-frame)

### Adım 7 — Tools Tab Redesign

- [ ] Ping sonucu daha güzel format
- [ ] Server bilgisi kartı (GitHub commit dahil)
- [ ] Environment seçici
- [ ] Update tetikleme butonu
- [ ] Log dışa aktarma

### Adım 8 — Scanner Faz 2

- [ ] `server/routes/scanner.js` oluştur
- [ ] `server/services/scan-store.js` oluştur
- [ ] `public/index.html` Scanner tab'ı → gerçek kamera UI
- [ ] Kamera izin akışı
- [ ] Fotoğraf çekme + canvas overlay
- [ ] Sanayi API entegrasyonu
- [ ] Analiz sonucu gösterimi
- [ ] Local history kayıt

### Adım 9 — PWA İyileştirme

- [ ] `sw.js` → cache stratejisi geliştir
- [ ] Offline mod (local server çevrimdışıysa mesaj göster)
- [ ] Install banner iyileştirme

### Adım 10 — Test & Polish

- [ ] Tüm route'lar test
- [ ] Mobile viewport kontrolü
- [ ] Versiyon tutarlılık kontrolü
- [ ] `.env.example` güncelle (VERCEL_TOKEN, SANAYI_API_URL ekle)

---

## ⚙️ BÖLÜM 4 — .env Yeni Değişkenler

```env
PORT=8787
HOST=127.0.0.1
GITHUB_REPO=Keremoezel/sanayi-field-device
GITHUB_BRANCH=master
FIELD_DEVICE_KEY=buraya-guclu-sifre-yaz

# YENİ
SANAYI_API_URL=https://sanayi-uygulamasi.vercel.app
SANAYI_API_KEY=sanayi-api-secret-key
VERCEL_TOKEN=vercel-token-buraya
MAX_UPLOAD_SIZE_MB=2
SCAN_RATE_LIMIT_PER_MIN=10
NODE_ENV=production
```

---

## 🧩 BÖLÜM 5 — Bağımlılıklar

| Paket | Neden | Durum |
|---|---|---|
| `express` | Core server | Mevcut |
| `dotenv` | Env vars | Mevcut |
| `nodemon` | Dev | Mevcut |
| `multer` | File upload (scanner) | **Eklenecek** |

**Ek CDN (HTML'de):**
- Google Fonts (Inter + JetBrains Mono)

---

## 🚀 BÖLÜM 6 — Uygulama Öncelik Sırası

1. **Kritik fixler** (scans.json, health versiyon) → hemen
2. **CSS ayrıştırma** → temiz code base
3. **Monitor tab** → en çok kullanılan tab
4. **Logs tab** → en çok talep edilen geliştirme
5. **Header + Nav** → görsel etki büyük
6. **Tools tab** → developer utility
7. **History tab** → scanner olmadan boş
8. **Scanner Faz 2** → en büyük feature
9. **PWA** → son polish

---

## 📝 Notlar

- Mevcut `monitor.js`, `checker.js`, `notifier.js`, `updater.js` → büyük ölçüde korunacak
- `index.html` → sıfırdan yeniden yazım (847 satır → ayrı CSS + temiz HTML)
- Tüm modal'lar vanilla JS ile (framework yok)
- Mobile-first, touch-friendly (min 44px tap targets)
- Türkçe UI korunacak

