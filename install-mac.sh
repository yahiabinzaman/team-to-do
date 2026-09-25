#!/usr/bin/env bash
#  Team To-Do - macOS 1-Line Installer
set -e

echo "========================================================"
echo "  Installing Team To-Do Desktop Widget on macOS..."
echo "========================================================"

INSTALL_DIR="$HOME/Team-To-Do"

if [ -d "$INSTALL_DIR" ]; then
  echo "Updating existing installation in $INSTALL_DIR..."
  cd "$INSTALL_DIR"
  git pull origin main || true
else
  echo "Cloning repository to $INSTALL_DIR..."
  git clone https://github.com/yahiabinzaman/team-to-do.git "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

echo "Installing required dependencies..."
npm install

echo "Setting up macOS login autostart..."
chmod +x setup-mac-autostart.sh mac-launcher.sh
./setup-mac-autostart.sh

echo "Launching Team To-Do Widget..."
./mac-launcher.sh

echo "========================================================"
echo " [SUCCESS] Team To-Do installed and running!"
echo " It will automatically launch whenever you login."
echo "========================================================"
