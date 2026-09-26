#!/bin/bash
#  Apple-Style Native Desktop Widget Auto-Launch on Mac Login

CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLIST_PATH="$HOME/Library/LaunchAgents/com.applewidget.desktop.plist"
LAUNCHER_PATH="$CURRENT_DIR/mac-launcher.sh"

echo "🍏 Setting up macOS Login Auto-Start LaunchAgent..."
mkdir -p "$HOME/Library/LaunchAgents"

cat <<EOF > "$PLIST_PATH"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.applewidget.desktop</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$LAUNCHER_PATH</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$CURRENT_DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
    <key>StandardOutPath</key>
    <string>$CURRENT_DIR/data/autostart.log</string>
    <key>StandardErrorPath</key>
    <string>$CURRENT_DIR/data/autostart.err</string>
</dict>
</plist>
EOF

launchctl unload "$PLIST_PATH" 2>/dev/null
launchctl load "$PLIST_PATH"

echo "✅ Auto-run on login is successfully CONFIGURED!"
