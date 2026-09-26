#!/bin/bash

# Force complete PATH for macOS Finder / LaunchAgent execution
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/homebrew/bin:$PATH"

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR" || exit 1

# If official /Applications/Team To do.app exists, launch it cleanly
if [ -d "/Applications/Team To do.app" ]; then
    open -a "/Applications/Team To do.app"
    exit 0
fi

# Ensure background sync server is running if launched locally
if ! curl -s --head --request GET "http://localhost:4973/api/network-info" | grep "200" > /dev/null; then
    nohup node "$APP_DIR/server.js" > "$APP_DIR/data/widget.log" 2>&1 &
    sleep 1
fi

# Fallback: Launch native Electron desktop widget
if [ -f "$APP_DIR/node_modules/.bin/electron" ]; then
    "$APP_DIR/node_modules/.bin/electron" "$APP_DIR/electron-main.js" > "$APP_DIR/data/electron.log" 2>&1 &
fi
