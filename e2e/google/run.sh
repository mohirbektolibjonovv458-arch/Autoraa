#!/usr/bin/env bash
# «Google bilan kirish» brauzer sinovi. Talab: playwright, Chromium (CHROMIUM_PATH), frontend build qilingan.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
W="${WORK_DIR:-/tmp/avtora-google-test}"; P="${PYTHON:-python}"
rm -rf "$W" && mkdir -p "$W" && cp -r "$HERE/../../backend" "$W/backend" && cd "$W/backend" && rm -f db.sqlite3 .env
$P -c "
from cryptography.hazmat.primitives.asymmetric import rsa; from cryptography.hazmat.primitives import serialization as s
k=rsa.generate_private_key(public_exponent=65537,key_size=2048)
open('$W/priv.pem','wb').write(k.private_bytes(s.Encoding.PEM,s.PrivateFormat.PKCS8,s.NoEncryption()))
open('$W/pub.pem','wb').write(k.public_key().public_bytes(s.Encoding.PEM,s.PublicFormat.SubjectPublicKeyInfo))"
export GOOGLE_CLIENT_ID=test-123.apps.googleusercontent.com GOOGLE_TEST_PUBKEY="$W/pub.pem" GOOGLE_TEST_PRIVKEY="$W/priv.pem" OUT_DIR="$W"
export TELEGRAM_API_BASE=http://127.0.0.1:9900 AUTH_BOT_TOKEN=111111:AAAAauth PREMIUM_BOT_TOKEN=222222:BBBBprem ADMIN_PHONE=+998900000000 ADMIN_PASSWORD=secret12345 PORT=8500
$P "$HERE/../fake_telegram.py" > "$W/tg.log" 2>&1 & TGP=$!
$P "$HERE/serve.py" > "$W/server.log" 2>&1 & SRV=$!
trap 'kill $SRV $TGP 2>/dev/null' EXIT
for i in $(seq 1 60); do curl -s http://localhost:8500/api/health/ | grep -q '"auth": "ok"' && break; sleep 2; done
$P -u "$HERE/google_test.py"
