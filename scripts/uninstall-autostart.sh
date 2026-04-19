#!/usr/bin/env bash
# Removes the Floating Anki LaunchAgent.

set -euo pipefail

LABEL="com.complear.floating-anki"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"

if [[ ! -f "$PLIST" ]]; then
  echo "not installed (no plist at $PLIST)"
  exit 0
fi

launchctl unload "$PLIST" 2>/dev/null || true
rm -f "$PLIST"
echo "removed: $PLIST"
echo "(the app is not deleted; remove ~/Applications/Floating\\ Anki.app manually if you want)"
