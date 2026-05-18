# Sanayi Field Device — Developer AI Scanner Planı

## 1. Proje Fikri

**Sanayi Field Device**, eski/rootlu bir Android telefonu Sanayi projesine bağlı özel bir geliştirici ve saha tarama cihazına dönüştürme planıdır.

Bu cihaz klasik bir servis terminali değildir. Amaç, geliştiricinin veya saha test yapan kişinin arabanın yanında telefonla gezerek canlı kamera üzerinden olası hasar bölgelerini görebilmesi, analiz sonuçlarını Sanayi backend sistemine gönderebilmesi ve aynı cihaz üzerinden uygulamanın teknik durumunu takip edebilmesidir.

Temel fikir:

```txt
Eski Android telefon
↓
Root + Termux
↓
Local server + kamera arayüzü
↓
Canlı hasar tarama
↓
Sanayi API entegrasyonu
↓
AI analiz + sistem kontrol paneli
```

Bu cihaz, Sanayi uygulamasındaki mevcut AI hasar analizi sisteminin sahada kullanılan özel bir developer prototipi gibi davranır.

---

## 2. Cihazın Temel Amacı

Cihazın iki ana amacı vardır:

### 2.1 Canlı AI Hasar Tarayıcı

Telefon kamerası açılır. Kullanıcı arabanın etrafında gezerken kamera görüntüsü üzerinden olası hasar bölgeleri analiz edilir.

Hedef deneyim:

```txt
Canlı kamera açılır
↓
Araç yüzeyi görüntülenir
↓
Belirli aralıklarla kamera frame'i analiz edilir
↓
Ekranda hasarlı olabilecek bölgeler kutu/renk ile işaretlenir
↓
"Burada hasar olabilir" uyarısı gösterilir
↓
Sonuç istenirse Sanayi backend'e kaydedilir
```

### 2.2 Developer Control Device

Telefon aynı zamanda Sanayi uygulamasını takip eden bir geliştirici kontrol cihazı olur.

Takip edilebilecek şeyler:

```txt
- API çalışıyor mu?
- AI analiz endpoint'i çalışıyor mu?
- Son hasar analizleri neler?
- Kaç servis talebi var?
- Son hatalar neler?
- Backend ortamı local/dev/prod hangisi?
- Cihaz online mı?
- Termux local server çalışıyor mu?
- Hugging Face modeli cevap veriyor mu?
- Vercel Blob upload çalışıyor mu?
```

---

## 3. Genel Mimari

Önerilen mimari:

```txt
[Rootlu Android Telefon]
        ↓
[Termux]
        ↓
[Local Node.js / Python Server]
        ↓
[Mobil Web UI / PWA]
        ↓
[Sanayi Nitro API]
        ↓
[Vercel Blob + Hugging Face AI + Neon PostgreSQL]
```

Telefonun içinde çalışan ana parçalar:

```txt
1. Termux local server
2. Canlı kamera scanner arayüzü
3. Sanayi API bağlantısı
4. AI analiz proxy sistemi
5. Local scan history
6. Device heartbeat worker
7. Developer monitoring ekranı
```

---

## 4. Neden Tam Linux Yerine Rootlu Android + Termux?

Telefon tamamen gözden çıkarılacak olsa bile ilk aşamada tam Linux yerine rootlu Android + Termux daha mantıklıdır.

Çünkü bu projede kamera çok önemlidir.

Tam Linux kurulursa şu sorunlar çıkabilir:

```txt
- Kamera sürücüsü çalışmayabilir
- Dokunmatik sorun çıkarabilir
- Wi-Fi/Bluetooth bozulabilir
- GPU hızlandırma çalışmayabilir
- Batarya yönetimi kötüleşebilir
- Canlı kamera performansı düşebilir
```

Android tarafında ise kamera, ekran, Wi-Fi ve batarya yönetimi zaten çalışır. Termux da Linux benzeri ortam sağlar.

Bu yüzden önerilen temel yapı:

```txt
Rootlu Android
+
Termux
+
Termux:Boot
+
Termux:API
+
Local server
+
Mobil web arayüzü
```

Tam Linux veya custom ROM daha sonra düşünülebilir.

---

## 5. Cihaz Modları

Cihaz 4 ana moda sahip olabilir.

---

### 5.1 Live Damage Scanner

Bu mod arabanın yanında kullanılan canlı kamera tarama ekranıdır.

Özellikler:

```txt
- Canlı kamera görüntüsü
- Belirli aralıklarla frame yakalama
- AI analiz isteği gönderme
- Hasar kutularını ekrana çizme
- Renkli risk göstergesi
- Güven skoru gösterimi
- "Sanayi'ye gönder" butonu
- "Taramayı kaydet" butonu
```

Örnek ekran mantığı:

```txt
┌──────────────────────────────┐
│ Canlı kamera görüntüsü        │
│                              │
│   [Sarı kutu]                 │
│   Burada hasar olabilir       │
│                              │
│        [Turuncu kutu]         │
│        Orta risk              │
│                              │
├──────────────────────────────┤
│ Risk: Orta                   │
│ Güven: %61                   │
│ Bölge: Ön sağ / tampon       │
│ [Kaydet] [Sanayi’ye gönder]  │
└──────────────────────────────┘
```

Renk mantığı:

```txt
Sarı    = düşük ihtimal
Turuncu = orta ihtimal
Kırmızı = yüksek ihtimal
```

---

### 5.2 Sanayi System Monitor

Bu mod uygulamanın teknik durumunu gösterir.

Gösterilecek metrikler:

```txt
- API status
- Database status
- AI endpoint status
- Blob upload status
- Son analizler
- Son servis talepleri
- Son hatalar
- Deployment environment
- Ortalama analiz süresi
- Bugünkü analiz sayısı
```

Örnek ekran:

```txt
Sanayi System Monitor

API: Online
Database: Online
AI Model: Online
Blob Storage: Online

Son analiz: 2 dakika önce
Bugünkü analiz: 14
Son hata: Yok
Environment: dev
```

---

### 5.3 Scan History

Bu mod cihazla yapılan geçmiş taramaları gösterir.

Alanlar:

```txt
- Tarama tarihi
- Orijinal görsel
- Anotasyonlu görsel
- Hasar seviyesi
- Güven skoru
- Backend'e gönderildi/gönderilmedi
- Bağlı servis talebi
- Local kayıt durumu
```

Örnek:

```txt
Scan #124
Tarih: 18.05.2026 15:42
Risk: Orta
Güven: %64
Durum: Backend'e gönderildi
```

---

### 5.4 Developer Tools

Bu mod sadece geliştirici için teknik işlemler sunar.

Özellikler:

```txt
- Restart local server
- Sync now
- Clear local cache
- View local logs
- Ping Sanayi API
- Test AI endpoint
- Test Blob upload
- Switch environment
- Export scan logs
```

Environment seçenekleri:

```txt
local
development
staging
production
```

---

## 6. AI Hasar Tarama Seviyeleri

Bu özellik 3 seviye halinde geliştirilebilir.

---

### Seviye 1 — Fotoğraf Çek, Analiz Et

En basit sürüm.

Akış:

```txt
Kamera açılır
↓
Fotoğraf çekilir
↓
Fotoğraf Sanayi API'ye gönderilir
↓
Backend AI analiz yapar
↓
Sonuç telefonda gösterilir
```

Avantajları:

```txt
- En hızlı MVP
- Mevcut AI endpoint ile uyumlu
- Telefonu yormaz
- Daha az gecikme problemi
```

---

### Seviye 2 — Canlı Kamera + Periyodik Analiz

Asıl hedeflenen seviye budur.

Akış:

```txt
Kamera canlı açık kalır
↓
Her 1-2 saniyede bir frame alınır
↓
Frame sıkıştırılmış JPEG olarak gönderilir
↓
AI analiz sonucu alınır
↓
Ekranda kutu/renk overlay gösterilir
↓
"Burada hasar olabilir" uyarısı çıkar
```

Bu gerçek zamanlı 30 FPS AI değildir. Daha gerçekçi olan:

```txt
1-2 saniyede bir analiz
+
canlı kamera üzerinde sonuç overlay'i
```

Bu hem performans hem maliyet açısından daha mantıklıdır.

---

### Seviye 3 — On-device AI

İleri seviye.

Model telefonun içinde çalışır.

Olası teknolojiler:

```txt
- TensorFlow Lite
- ONNX Runtime Mobile
- ncnn
- MediaPipe benzeri pipeline
```

Avantajları:

```txt
- İnternet gerekmez
- Daha hızlı tepki verir
- Gerçek cihaz hissi artar
```

Dezavantajları:

```txt
- Model dönüştürme gerekir
- Eski telefon yavaş kalabilir
- Uyumluluk sorunları çıkabilir
- Geliştirme süresi uzar
```

Bu yüzden ilk hedef Seviye 2 olmalıdır.

---

## 7. AI Analiz Nerede Çalışmalı?

İlk aşamada AI telefonda çalışmamalıdır.

Önerilen MVP:

```txt
Telefon = kamera + UI + local server
AI = Sanayi backend / Hugging Face
```

Akış:

```txt
Telefon frame yakalar
↓
Termux local server frame'i alır
↓
Sanayi backend'e gönderir
↓
Backend Vercel Blob'a yükler
↓
Hugging Face modeli analiz eder
↓
Sonuç telefona döner
↓
Telefon overlay çizer
```

Bu yaklaşım, Sanayi projesindeki mevcut AI hasar analizi mimarisiyle uyumludur.

---

## 8. Termux Local Server

Telefonda çalışan local server cihazın beyni olacaktır.

Önerilen adres:

```txt
http://localhost:8787
```

Local server görevleri:

```txt
- Mobil web arayüzünü sunmak
- Kamera scanner sayfasını çalıştırmak
- Sanayi API tokenlarını yönetmek
- Frame analiz isteklerini yönlendirmek
- Local log tutmak
- Scan history saklamak
- Offline queue yönetmek
- Sanayi backend'e heartbeat göndermek
- API health check yapmak
```

Örnek local route yapısı:

```txt
GET  /                 → Device dashboard
GET  /scanner          → Live damage scanner
GET  /monitor          → Sanayi system monitor
GET  /history          → Scan history
GET  /tools            → Developer tools
GET  /logs             → Local logs
GET  /health           → Local server health

POST /scan-frame       → Kameradan gelen frame'i analiz et
POST /sync             → Local veriyi Sanayi backend'e gönder
POST /heartbeat        → Cihaz durumunu güncelle
POST /restart-worker   → Worker'ı yeniden başlat
```

---

## 9. Sanayi Backend Entegrasyonu

Ana uygulamada cihazlar için özel endpoint'ler eklenmelidir.

---

### 9.1 Device Register

```txt
POST /api/devices/register
```

Cihazı Sanayi sistemine kaydeder.

Payload örneği:

```json
{
  "deviceName": "Sanayi Field Phone 01",
  "deviceType": "developer_field_device",
  "environment": "development"
}
```

---

### 9.2 Device Heartbeat

```txt
POST /api/devices/heartbeat
```

Cihazın online olduğunu bildirir.

Payload örneği:

```json
{
  "deviceId": "device_123",
  "mode": "developer",
  "battery": 87,
  "charging": true,
  "localServer": "online",
  "scanner": "ready",
  "appVersion": "0.1.0",
  "lastScanAt": "2026-05-18T12:40:00Z"
}
```

---

### 9.3 Damage Scan

```txt
POST /api/devices/damage-scans
```

Telefondan gelen fotoğraf/frame analiz edilir.

Payload:

```txt
multipart/form-data

file: image/jpeg
deviceId: string
mode: photo | live-frame
environment: local | dev | prod
```

Response örneği:

```json
{
  "scanId": "scan_123",
  "status": "completed",
  "summary": "Ön sağ bölgede orta seviyede hasar ihtimali var.",
  "severity": "medium",
  "maxConfidence": 0.64,
  "detections": [
    {
      "positionLabel": "front-right",
      "confidence": 0.64,
      "areaPercentage": 12.4,
      "severity": "medium",
      "box": {
        "x": 120,
        "y": 180,
        "width": 240,
        "height": 130
      }
    }
  ],
  "imageUrl": "https://...",
  "annotatedImageUrl": "https://..."
}
```

---

### 9.4 System Status

```txt
GET /api/devices/system-status
```

Cihazın monitor ekranı için sistem durumu döner.

Response örneği:

```json
{
  "api": "online",
  "database": "online",
  "aiModel": "online",
  "blobStorage": "online",
  "lastError": null,
  "todayScans": 14,
  "averageAnalysisMs": 2800
}
```

---

## 10. Veritabanı Tabloları

Bu cihaz entegrasyonu için Sanayi veritabanına yeni tablolar eklenebilir.

---

### 10.1 `developer_devices`

Cihazları tutar.

```txt
id
name
device_type
device_token_hash
environment
status
last_seen_at
battery_level
is_charging
local_server_status
scanner_status
app_version
created_at
updated_at
```

Örnek kayıt:

```txt
name: Sanayi Field Phone 01
device_type: developer_field_device
environment: development
status: online
battery_level: 87
is_charging: true
scanner_status: ready
```

---

### 10.2 `damage_scans`

Cihazdan yapılan AI taramalarını tutar.

```txt
id
device_id
service_request_id
vehicle_id
mode
image_url
annotated_image_url
status
summary
severity
max_confidence
raw_response
created_at
```

Alan açıklamaları:

```txt
mode:
- photo
- live-frame
- manual-upload

status:
- pending
- processing
- completed
- failed

severity:
- low
- medium
- high
```

---

### 10.3 `damage_scan_detections`

Her hasar bölgesini ayrı tutar.

```txt
id
scan_id
position_label
confidence
area_percentage
severity
x
y
width
height
created_at
```

---

### 10.4 `device_events`

Cihaz olaylarını loglar.

```txt
id
device_id
event_type
payload
created_at
```

Event örnekleri:

```txt
device_online
device_offline
local_server_started
scanner_started
scan_started
scan_completed
scan_failed
api_ping_failed
sync_completed
sync_failed
```

---

## 11. Telefon Üzerindeki Yazılım Yapısı

Önerilen klasör yapısı:

```txt
sanayi-field-device/
  server/
    index.js
    routes/
      scanner.js
      monitor.js
      sync.js
      health.js
    services/
      sanayi-api.js
      scan-store.js
      heartbeat.js
      logger.js
    data/
      scans.json
      logs.json
  public/
    index.html
    scanner.html
    monitor.html
    history.html
    tools.html
  scripts/
    start.sh
    heartbeat.sh
    boot.sh
  .env
  package.json
```

---

## 12. Telefon Kurulum Planı

### 12.1 Temel Kurulum

```txt
1. Telefonu sıfırla
2. Bootloader unlock yapılabiliyorsa aç
3. Root için Magisk kurulumu değerlendir
4. Termux kur
5. Termux:API kur
6. Termux:Boot kur
7. Node.js veya Python kur
8. Local server dosyalarını yükle
9. Sanayi API token/env ayarlarını gir
```

---

### 12.2 Termux Paketleri

Örnek paketler:

```bash
pkg update && pkg upgrade
pkg install nodejs git curl jq termux-api
```

Opsiyonel:

```bash
pkg install python ffmpeg imagemagick
```

---

### 12.3 Local Server Başlatma

Örnek:

```bash
cd ~/sanayi-field-device
npm install
npm run start
```

Local server:

```txt
http://localhost:8787
```

adresinden çalışır.

---

### 12.4 Boot Sonrası Otomatik Başlatma

Termux:Boot ile telefon açılınca local server otomatik başlatılır.

Örnek script:

```bash
#!/data/data/com.termux/files/usr/bin/bash

cd ~/sanayi-field-device
npm run start
```

Bu script şu klasöre konabilir:

```txt
~/.termux/boot/start-sanayi-device.sh
```

---

## 13. Canlı Kamera Teknik Yaklaşımı

Mobil web arayüzü tarayıcı üzerinden kameraya erişebilir.

Kullanılacak API:

```txt
navigator.mediaDevices.getUserMedia()
```

Akış:

```txt
1. Kamera stream'i açılır
2. Video elementi içinde görüntü gösterilir
3. Belirli aralıklarla canvas'a frame alınır
4. Canvas JPEG blob'a çevrilir
5. Blob local server'a gönderilir
6. Local server Sanayi API'ye yollar
7. Analiz sonucu geri gelir
8. Canvas overlay ile kutular çizilir
```

Önerilen analiz sıklığı:

```txt
MVP: Manuel butonla analiz
Seviye 2: 2 saniyede 1 frame
İleri seviye: 1 saniyede 1 frame
```

30 FPS gerçek zamanlı analiz hedeflenmemelidir.

---

## 14. Performans ve Maliyet Kontrolü

Canlı analiz maliyetli olabilir. Bu yüzden sınırlamalar gerekir.

Öneriler:

```txt
- Frame çözünürlüğünü düşür: örn. 640x480
- JPEG kalite oranı: 0.6 - 0.75
- Her frame'i gönderme
- Minimum 1-2 saniye aralık kullan
- Aynı görüntü çok değişmediyse tekrar analiz etme
- AI endpoint için rate limit koy
- Cihaz başına günlük analiz limiti koy
- Başarısız analizleri otomatik sonsuz döngüye sokma
```

---

## 15. Güvenlik

Cihaz developer amaçlı olsa bile güvenlik önemlidir.

Gerekli önlemler:

```txt
- Device token kullanılmalı
- Token hash olarak DB'de saklanmalı
- Public AI endpoint sınırsız kullanılmamalı
- Cihaz sadece izin verilen environment'a bağlanmalı
- Local server dış ağa açık olmamalı
- Mümkünse sadece localhost'ta çalışmalı
- Upload boyutu sınırlandırılmalı
- Görsel format kontrol edilmeli
- Rate limit uygulanmalı
- Device revoke özelliği olmalı
```

Önerilen local server ayarı:

```txt
Host: 127.0.0.1
Port: 8787
```

Bu sayede aynı Wi-Fi ağındaki başka cihazlar local server'a erişemez.

---

## 16. Admin Panelde Yeni Bölüm

Sanayi admin paneline şu bölüm eklenebilir:

```txt
Admin → Developer Devices
```

Bu ekranda:

```txt
- Cihaz adı
- Online/offline durumu
- Son bağlantı zamanı
- Batarya seviyesi
- Scanner durumu
- Local server durumu
- Son tarama
- Bugünkü analiz sayısı
- Son hata
- Environment
```

Örnek tablo:

```txt
Device                 Status   Battery   Last Seen     Env
Sanayi Field Phone 01  Online   87%       12 sec ago    dev
```

---

## 17. Cihaz Ekranı Ana Menü

Telefon açıldığında gösterilecek ana menü:

```txt
Sanayi Field Device

[ Live Damage Scanner ]
[ System Monitor       ]
[ Scan History         ]
[ Developer Tools      ]
```

---

## 18. Firmware / Custom Device Hissi

İlk aşamada gerçek firmware yazmak gerekmez.

Ama cihaz özel bir ürün gibi hissettirilebilir.

Yapılabilecekler:

```txt
- Sanayi boot animation
- Sanayi wallpaper
- Ana ekranda tek uygulama/PWA
- Otomatik Termux server başlatma
- Otomatik scanner ekranı açma
- Kiosk mode
- Gereksiz Android uygulamalarını kaldırma
- Cihaz adını Sanayi Field Device yapmak
```

İleri aşama:

```txt
- LineageOS tabanlı temiz Android
- Magisk root
- Özel launcher
- Sanayi uygulamasını launcher yapmak
- Açılışta otomatik local server + scanner
```

Gerçek custom firmware/ROM sonraki fazdır.

---

## 19. MVP Geliştirme Planı

### Faz 0 — Hazırlık

```txt
- Telefonu sıfırla
- Termux kur
- Node.js kur
- Sanayi API bağlantısını test et
- Local server hello world çalıştır
```

Çıktı:

```txt
Telefonda http://localhost:8787 çalışıyor.
```

---

### Faz 1 — Local Dashboard

```txt
- Local dashboard ekranı
- API ping
- AI endpoint ping
- Local log ekranı
- Environment seçimi
```

Çıktı:

```txt
Telefon Sanayi sisteminin durumunu gösterebiliyor.
```

---

### Faz 2 — Fotoğraf Bazlı AI Scan

```txt
- Kamera açma
- Fotoğraf çekme
- Fotoğrafı Sanayi API'ye gönderme
- AI sonucunu gösterme
- Sonucu local history'ye kaydetme
```

Çıktı:

```txt
Telefon fotoğraf çekip AI hasar analizi yapabiliyor.
```

---

### Faz 3 — Canlı Kamera + Periyodik Analiz

```txt
- Kamera sürekli açık
- Her 1-2 saniyede frame yakalama
- AI analiz isteği gönderme
- Sonucu canlı görüntünün üzerine çizme
- "Burada hasar olabilir" uyarısı gösterme
```

Çıktı:

```txt
Arabanın yanında gezerken telefon olası hasar bölgelerini gösterebiliyor.
```

---

### Faz 4 — Sanayi Backend Sync

```txt
- Scan sonuçlarını backend'e kaydetme
- Device heartbeat
- Admin panelde cihaz görüntüleme
- Scan history'yi Sanayi DB ile senkronize etme
```

Çıktı:

```txt
Telefon Sanayi backend'e bağlı developer cihazı gibi çalışıyor.
```

---

### Faz 5 — Root / Boot Automation

```txt
- Termux:Boot ile otomatik başlatma
- Ekranı açık tutma
- Kiosk/dev launcher ayarı
- Cihaz açılınca Sanayi UI gösterme
```

Çıktı:

```txt
Telefon açılınca otomatik olarak Sanayi Field Device moduna geçiyor.
```

---

### Faz 6 — On-device AI Denemesi

```txt
- Modelin TFLite/ONNX uyumluluğunu araştırma
- Küçük modelle lokal inference denemesi
- Offline scan modu
- Backend'e sadece sonuç gönderme
```

Çıktı:

```txt
Telefon internet olmadan temel hasar tespiti yapmayı deneyebilir.
```

---

## 20. Nihai Hedef

Nihai ürün deneyimi:

```txt
Telefon açılır
↓
Sanayi Field Device ekranı gelir
↓
Live Damage Scanner açılır
↓
Kullanıcı arabanın etrafında gezer
↓
Telefon canlı kamera üstünde hasar şüphesi olan yerleri işaretler
↓
"Burada hasar olabilir" uyarısı verir
↓
Kullanıcı taramayı kaydeder
↓
Sonuç Sanayi backend'e gönderilir
↓
Admin/developer panelde cihaz, tarama ve analiz geçmişi görünür
```

---

## 21. Kısa Özet

Bu planın özü:

```txt
Telefon production server olmayacak.
Telefon developer field device olacak.
Termux cihazın local beyni olacak.
Kamera tarama arayüzü telefonda çalışacak.
AI ilk aşamada backend'de çalışacak.
Canlı kamera Seviye 2 olarak 1-2 saniyede bir analiz yapacak.
Root/Linux cihazı otomatik, kontrollü ve özel cihaz gibi yapacak.
Tam custom firmware sonraki aşama olacak.
```

En mantıklı ilk prototip:

```txt
Rootlu Android
+
Termux local server
+
Canlı kamera web arayüzü
+
Sanayi API'ye frame gönderme
+
AI sonucunu overlay olarak gösterme
+
Developer monitor dashboard
```

---

## 22. Önerilen Özellik İsmi

Bu entegrasyon için kullanılabilecek isimler:

```txt
Sanayi Field Device
Sanayi AI Field Scanner
Sanayi Developer Device
Sanayi Damage Scanner Phone
```

En temiz isim:

```txt
Sanayi Field Device
```

Kısa açıklama:

> Sanayi Field Device, rootlu Android telefon üzerinde çalışan Termux tabanlı bir geliştirici saha cihazıdır. Cihaz, canlı kamera görüntüsü üzerinden araç üzerindeki olası hasar bölgelerini AI ile işaretler, sonuçları Sanayi backend'e gönderir ve geliştiriciye sistem durumu, API sağlığı ve analiz geçmişi için taşınabilir bir kontrol paneli sağlar.
