#!/data/data/com.termux/files/usr/bin/bash
# Bu dosyayı şuraya koy: ~/.termux/boot/field-device.sh
# Termux:Boot uygulaması telefon açılınca bunu çalıştırır

sleep 8  # Ağ bağlantısının kurulması için bekle

cd "$HOME/field-device" || exit 1

# Güncelleme dene
git pull origin master --quiet >> "$HOME/field-device/server/data/process.log" 2>&1
npm install --production --silent >> "$HOME/field-device/server/data/process.log" 2>&1

# Sunucuyu başlat
bash "$HOME/field-device/scripts/start.sh"
