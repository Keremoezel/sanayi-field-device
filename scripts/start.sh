#!/data/data/com.termux/files/usr/bin/bash
# Ana başlatma scripti — crash veya update sonrası otomatik yeniden başlatır

FIELD_DIR="$HOME/field-device"
LOG="$FIELD_DIR/server/data/process.log"

cd "$FIELD_DIR" || exit 1

echo "[$(date '+%H:%M:%S')] Field Device başlatılıyor..." | tee -a "$LOG"

while true; do
  node server/index.js >> "$LOG" 2>&1
  EXIT_CODE=$?
  echo "[$(date '+%H:%M:%S')] Server durdu (exit: $EXIT_CODE). 3s sonra yeniden başlıyor..." | tee -a "$LOG"
  sleep 3
done
