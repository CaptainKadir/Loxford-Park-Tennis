#!/bin/sh
# Make a local HTTPS certificate valid for this Mac's LAN IP and localhost.
# Prefers mkcert (one-time `mkcert -install`, then install its rootCA.pem on the
# iPhone and enable full trust); falls back to a self-signed openssl cert.
set -e
cd "$(dirname "$0")/.."
mkdir -p certs
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo 127.0.0.1)
if command -v mkcert >/dev/null 2>&1; then
  mkcert -cert-file certs/cert.pem -key-file certs/key.pem localhost 127.0.0.1 "$IP"
else
  openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
    -keyout certs/key.pem -out certs/cert.pem -subj "/CN=loxford-park-tennis" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:$IP"
fi
echo "certificate for $IP written to web/certs/"
