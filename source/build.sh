#!/usr/bin/env bash
# Builds the BF Model desktop downloads from source/ on Linux (or macOS) with no npm:
#   downloads/BF_Model-<ver>-Windows-Setup.exe   NSIS installer that updates an earlier BF Model in place
#   downloads/BF_Model-<ver>-Mac-AppleSilicon.zip / -Mac-Intel.zip   ad-hoc signed BF Model.app
# Needs: bash, curl, unzip, zip, python3 with Pillow. Fetches from GitHub releases into ./.cache:
#   Electron (same 33.4 line as 2.x), 7-Zip, NSIS (electron-builder-binaries), rcodesign (Mac signing on Linux).
# App identity is kept from 2.x so saved inputs and the login carry over:
#   name "BF Model", appId com.bfburdenmodel.desktop, pages served from app://bf/.
# Code signing with a real certificate: replace the rcodesign ad-hoc step with
#   rcodesign sign --p12-file DeveloperID.p12 --code-signature-flags runtime ... (then notarize), and sign the
#   Windows exe and Setup with signtool / osslsigncode before upload.
set -euo pipefail
cd "$(dirname "$0")"
SRC=$PWD; ROOT=$(cd .. && pwd)
VER=$(python3 -c "import json;print(json.load(open('package.json'))['version'])")
EV=33.4.11
C=$SRC/.cache; B=$SRC/.build; OUT=$ROOT/downloads
mkdir -p "$C" "$OUT"; rm -rf "$B"; mkdir -p "$B"

get() { [ -s "$C/$2" ] || curl -fsSL -o "$C/$2" "$1"; }
for p in win32-x64 darwin-x64 darwin-arm64; do get "https://github.com/electron/electron/releases/download/v$EV/electron-v$EV-$p.zip" "electron-v$EV-$p.zip"; done
get "https://github.com/electron/electron/releases/download/v$EV/SHASUMS256.txt" "SHASUMS-$EV.txt"
(cd "$C" && grep -E "electron-v$EV-(win32-x64|darwin-x64|darwin-arm64)\.zip" "SHASUMS-$EV.txt" | sed 's/ \*/  /' | sha256sum -c -)
get https://github.com/ip7z/7zip/releases/download/24.08/7z2408-linux-x64.tar.xz 7z.tar.xz
[ -x "$C/7zz" ] || tar -xf "$C/7z.tar.xz" -C "$C" 7zz
get https://github.com/electron-userland/electron-builder-binaries/releases/download/nsis-3.0.4.1/nsis-3.0.4.1.7z nsis.7z
[ -d "$C/nsis" ] || "$C/7zz" x -y -o"$C/nsis" "$C/nsis.7z" >/dev/null
get https://github.com/indygreg/apple-platform-rs/releases/download/apple-codesign%2F0.29.0/apple-codesign-0.29.0-x86_64-unknown-linux-musl.tar.gz rcs.tgz
[ -x "$C/rcodesign" ] || { tar -xzf "$C/rcs.tgz" -C "$C"; cp "$C"/apple-codesign-*/rcodesign "$C/rcodesign"; }

# app.asar: package.json + app/ (main.js, preload.js, icon.png, www/)
mkdir -p "$B/asar"; cp package.json "$B/asar/"; cp -r app "$B/asar/app"
find "$B/asar" -name '.DS_Store' -delete
python3 tools/asar.py pack "$B/asar" "$B/app.asar"

# ---------- Windows ----------
W="$B/win"; mkdir -p "$W"; unzip -q "$C/electron-v$EV-win32-x64.zip" -d "$W"
mv "$W/electron.exe" "$W/BF Model.exe"; rm -f "$W/resources/default_app.asar"
cp "$B/app.asar" "$W/resources/app.asar"
find "$W/locales" -name '*.pak' ! -name 'en-US.pak' ! -name 'en-GB.pak' -delete
python3 tools/peicon.py "$W/BF Model.exe" app/icon.png
cp build/icon.ico "$B/icon.ico"; cp build/installer.nsi "$B/installer.nsi"
(cd "$B" && NSISDIR="$C/nsis" "$C/nsis/linux/makensis" -V2 -DVERSION="$VER" -DSTAGE=win \
   -DOUTFILE="$OUT/BF_Model-$VER-Windows-Setup.exe" installer.nsi)

# ---------- Mac (Apple Silicon and Intel) ----------
for A in arm64 x64; do
  M="$B/mac-$A"; mkdir -p "$M"; (cd "$M" && unzip -q "$C/electron-v$EV-darwin-$A.zip")
  APP="$M/BF Model.app"; mv "$M/Electron.app" "$APP"
  mv "$APP/Contents/MacOS/Electron" "$APP/Contents/MacOS/BF Model"
  R="$APP/Contents/Resources"; rm -f "$R/default_app.asar" "$R/electron.icns"
  cp "$B/app.asar" "$R/app.asar"; cp build/icon.icns "$R/icon.icns"
  find "$APP/Contents/Frameworks/Electron Framework.framework/Versions/A/Resources" -maxdepth 1 -name '*.lproj' \
       ! -name 'en.lproj' ! -name 'en_GB.lproj' -exec rm -rf {} +
  for H in "" " (GPU)" " (Plugin)" " (Renderer)"; do
    old="$APP/Contents/Frameworks/Electron Helper$H.app"; new="$APP/Contents/Frameworks/BF Model Helper$H.app"
    [ -d "$old" ] || continue
    mv "$old/Contents/MacOS/Electron Helper$H" "$old/Contents/MacOS/BF Model Helper$H"; mv "$old" "$new"
    python3 - "$new/Contents/Info.plist" "BF Model Helper$H" "$H" <<'PY'
import plistlib, sys
p, name, h = sys.argv[1:4]; d = plistlib.load(open(p, 'rb'))
suf = h.strip(' ()')
d.update(CFBundleExecutable=name, CFBundleDisplayName=name, CFBundleName=name,
         CFBundleIdentifier='com.bfburdenmodel.desktop.helper' + ('.' + suf if suf else ''))
plistlib.dump(d, open(p, 'wb'))
PY
  done
  python3 - "$APP/Contents/Info.plist" "$VER" <<'PY'
import plistlib, sys
p, ver = sys.argv[1:3]; d = plistlib.load(open(p, 'rb'))
d.update(CFBundleDisplayName='BF Model', CFBundleName='BF Model', CFBundleExecutable='BF Model',
         CFBundleIconFile='icon.icns', CFBundleIdentifier='com.bfburdenmodel.desktop',
         CFBundleShortVersionString=ver, CFBundleVersion=ver, NSHumanReadableCopyright='Niteen Kumar',
         LSApplicationCategoryType='public.app-category.productivity', LSMinimumSystemVersion='11.0')
plistlib.dump(d, open(p, 'wb'))
PY
  "$C/rcodesign" sign "$APP" > "$B/sign-$A.log" 2>&1
  NAME=$([ "$A" = arm64 ] && echo AppleSilicon || echo Intel)
  rm -f "$OUT/BF_Model-$VER-Mac-$NAME.zip"
  (cd "$M" && zip -qry9 "$OUT/BF_Model-$VER-Mac-$NAME.zip" "BF Model.app")
done

cd "$OUT"
sha256sum "BF_Model-$VER-Windows-Setup.exe" "BF_Model-$VER-Mac-AppleSilicon.zip" "BF_Model-$VER-Mac-Intel.zip" > "$ROOT/SHA256SUMS.txt"
ls -la "$OUT"; cat "$ROOT/SHA256SUMS.txt"
