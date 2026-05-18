#!/data/data/com.termux/files/usr/bin/bash
# Tek seferlik kurulum scripti
# Termux'ta çalıştır: bash install.sh

set -e

echo "==> Paketler kuruluyor..."
pkg update -y && pkg install -y nodejs git

echo "==> Repo klonlanıyor..."
git clone https://github.com/Keremoezel/sanayi-field-device.git ~/field-device
cd ~/field-device

echo "==> Bağımlılıklar kuruluyor..."
npm install --production

echo "==> Boot scripti ayarlanıyor..."
mkdir -p ~/.termux/boot
cp scripts/boot.sh ~/.termux/boot/field-device.sh
chmod +x ~/.termux/boot/field-device.sh

echo "==> .env oluşturuluyor..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "  !! .env dosyasını düzenle: nano ~/field-device/.env"
fi

echo ""
echo "==> Kurulum tamamlandı."
echo "    Başlatmak için: bash ~/field-device/scripts/start.sh"
echo "    Telefon açılınca otomatik başlayacak (Termux:Boot gerekli)."
