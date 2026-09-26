#!/bin/bash

# Force complete PATH for macOS Finder execution
export PATH="/Users/colorlab/homebrew/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

APP_DIR="/Users/colorlab/Downloads/Widgets"
cd "$APP_DIR" || exit 1

# Ensure background sync server is running
if ! curl -s --head --request GET "http://localhost:4973/api/network-info" | grep "200" > /dev/null; then
    nohup node "$APP_DIR/server.js" > "$APP_DIR/data/widget.log" 2>&1 &
    sleep 1
fi

# Launch True Native Frameless macOS Desktop Widget via Electron
"$APP_DIR/node_modules/.bin/electron" "$APP_DIR/electron-main.js" > "$APP_DIR/data/electron.log" 2>&1 &
