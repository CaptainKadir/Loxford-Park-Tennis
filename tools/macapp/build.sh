#!/bin/sh
# Build "Loxford Park Tennis.app" and a zip of it: a native Mac window around the web game, with Node bundled.
# Needs: Xcode command line tools (swiftc), node (its binary is copied in), emcc only if web/build is stale.
# Output: dist/mac/Loxford Park Tennis.app and dist/mac/LoxfordParkTennis-mac-arm64.zip (Apple silicon).
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
OUT="$ROOT/dist/mac"
APP="$OUT/Loxford Park Tennis.app"
NODE=${NODE_BIN:-$(readlink -f "$(command -v node)")}
rm -rf "$APP" "$OUT"/*.zip
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/web"

echo "== compile launcher"
swiftc -O -target arm64-apple-macos12 "$HERE/main.swift" -o "$APP/Contents/MacOS/LoxfordParkTennis"
cp "$HERE/Info.plist" "$APP/Contents/Info.plist"

echo "== icon"
TMP=$(mktemp -d)
swift "$HERE/icon.swift" "$TMP/icon.png"
mkdir "$TMP/AppIcon.iconset"
for s in 16 32 128 256 512; do
  sips -z $s $s "$TMP/icon.png" --out "$TMP/AppIcon.iconset/icon_${s}x${s}.png" >/dev/null
  sips -z $((s*2)) $((s*2)) "$TMP/icon.png" --out "$TMP/AppIcon.iconset/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$TMP/AppIcon.iconset" -o "$APP/Contents/Resources/AppIcon.icns"
rm -rf "$TMP"

echo "== game files"
cp "$NODE" "$APP/Contents/Resources/node"
W="$APP/Contents/Resources/web"
for d in server game controller shared build assets sword; do cp -R "$ROOT/web/$d" "$W/$d"; done
cp "$ROOT/web/package.json" "$W/"
mkdir -p "$W/node_modules/three/examples"
cp -R "$ROOT/web/node_modules/ws" "$ROOT/web/node_modules/qrcode-terminal" "$W/node_modules/"
cp -R "$ROOT/web/node_modules/three/build" "$ROOT/web/node_modules/three/package.json" "$ROOT/web/node_modules/three/LICENSE" "$W/node_modules/three/"
cp -R "$ROOT/web/node_modules/three/examples/jsm" "$W/node_modules/three/examples/jsm"
cp "$ROOT/LICENSE" "$APP/Contents/Resources/LICENSE" 2>/dev/null || true
cp "$ROOT/docs/CREDITS.md" "$APP/Contents/Resources/CREDITS.md" 2>/dev/null || true
find "$APP" -name .DS_Store -delete

echo "== sign (ad hoc) and zip"
codesign --force --deep -s - "$APP"
(cd "$OUT" && ditto -c -k --keepParent "Loxford Park Tennis.app" LoxfordParkTennis-mac-arm64.zip)
du -sh "$APP" "$OUT"/*.zip
