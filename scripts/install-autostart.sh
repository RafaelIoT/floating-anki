#!/usr/bin/env bash
# Installs a macOS LaunchAgent that launches Floating Anki at login and
# relaunches it (with a minimum 10s throttle) if the app fully quits.
#
# Usage: bash scripts/install-autostart.sh [path/to/Floating Anki.app]
#
# With no argument, it searches ~/Applications and /Applications.

set -euo pipefail

LABEL="com.complear.floating-anki"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
LOG_OUT="$HOME/Library/Logs/floating-anki.log"
LOG_ERR="$HOME/Library/Logs/floating-anki.err.log"

find_app() {
  for candidate in "$HOME/Applications/Floating Anki.app" "/Applications/Floating Anki.app"; do
    if [[ -d "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

APP_PATH="${1:-$(find_app || true)}"

if [[ -z "${APP_PATH:-}" || ! -d "$APP_PATH" ]]; then
  echo "error: could not locate Floating Anki.app" >&2
  echo "  pass the path explicitly: bash scripts/install-autostart.sh /path/to/Floating\\ Anki.app" >&2
  exit 1
fi

BIN="$APP_PATH/Contents/MacOS/Floating Anki"
if [[ ! -x "$BIN" ]]; then
  echo "error: executable not found inside app: $BIN" >&2
  exit 1
fi

# Remove any existing agent before rewriting.
if launchctl list | grep -q "$LABEL"; then
  launchctl unload "$PLIST" 2>/dev/null || true
fi

mkdir -p "$(dirname "$PLIST")"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LABEL}</string>

    <key>ProgramArguments</key>
    <array>
        <string>${BIN}</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>ThrottleInterval</key>
    <integer>10</integer>

    <key>ProcessType</key>
    <string>Interactive</string>

    <key>StandardOutPath</key>
    <string>${LOG_OUT}</string>

    <key>StandardErrorPath</key>
    <string>${LOG_ERR}</string>
</dict>
</plist>
EOF

launchctl load -w "$PLIST"
echo "installed: $PLIST"
echo "launches:  $BIN"
echo "logs:      $LOG_OUT, $LOG_ERR"
echo "disable:   bash scripts/uninstall-autostart.sh"
