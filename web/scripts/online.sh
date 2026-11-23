#!/bin/sh
# Play over the internet: run the game server behind a free Cloudflare "quick tunnel" so a friend anywhere can
# open the link the lobby shows. Needs the cloudflared program once:  brew install cloudflared
# Nothing is installed or downloaded by this script.
cd "$(dirname "$0")/.." || exit 1
PORT_LOCAL="${LOCAL_PORT:-8080}"
if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared is not installed."
  echo "  Install it once with:  brew install cloudflared"
  echo "  (or use any other tunnel, e.g. ngrok, and start the server with PUBLIC_URL=https://your-tunnel-address make -C web play)"
  exit 1
fi
test -f certs/key.pem || sh scripts/make-cert.sh
LOG="$(mktemp)"
cloudflared tunnel --no-autoupdate --url "http://localhost:$PORT_LOCAL" >"$LOG" 2>&1 &
TUNNEL=$!
trap 'kill $TUNNEL 2>/dev/null; rm -f "$LOG"' EXIT INT TERM
URL=""
i=0
while [ $i -lt 60 ] && [ -z "$URL" ]; do
  URL="$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG" | head -1)"
  [ -z "$URL" ] && sleep 0.5
  i=$((i + 1))
done
if [ -z "$URL" ]; then echo "The tunnel did not start:"; cat "$LOG"; exit 1; fi
echo ""
echo "Tunnel up: $URL"
echo "Open  http://localhost:$PORT_LOCAL/  here, choose Online > Host a game, and send your friend the link it shows."
echo ""
PUBLIC_URL="$URL" LOCAL_PORT="$PORT_LOCAL" node server/index.js
