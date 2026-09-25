<div align="center">

#  Team To-Do
### Native Apple-Style Real-time Team Task & Calendar Desktop Widget

[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-000000?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/yahiabinzaman/team-to-do)
[![Electron](https://img.shields.io/badge/Electron-Desktop%20Widget-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://electronjs.org)
[![Real-Time](https://img.shields.io/badge/Real--Time-WebSocket%20Sync-0A84FF?style=for-the-badge)](https://github.com/yahiabinzaman/team-to-do)
[![License](https://img.shields.io/badge/License-MIT-30D158?style=for-the-badge)](LICENSE)

*An authentic Cupertino Human Interface Guidelines (HIG) desktop widget for macOS and Windows. Features real-time multi-device sync, smart chronological date grouping, team member matrix, 2-column live calendar timeline, and a 1-year completed task archive.*

---

</div>

## ✨ Highlights & Key Features

### 1.  Authentic Apple Human Interface Guidelines (HIG)
- **Frosted Glass Squircle**: Deep translucent background (`rgba(30, 30, 35, 0.94)`) with `backdrop-filter: blur(50px)`, delicate 1px glass borders, and 22px rounded corners.
- **Frameless & Transparent**: Floats cleanly on your desktop without bulky window chrome or titlebars.
- **Freeform Resizing & Memory**: Drag corners to resize freely; remembers exact screen position across restarts in `data/bounds.json`.
- **System Tray & Menu Bar Integration**: Quick access icon on macOS Menu Bar and Windows Taskbar Tray.

### 2. ⚡ Real-Time Instant Multi-Device Sync
- Embedded high-performance WebSocket server with automatic state replication.
- Any change (adding a task, checking completion, editing team members) propagates **instantly** to all connected Mac and Windows PCs.
- LAN auto-discovery with built-in network address display in Settings.

### 3. 📋 4 Powerful Widget Views

| View | Description |
| :--- | :--- |
| **Tasks** | Active tasks grouped chronologically by date (`Overdue`, `Today`, `Tomorrow`, specific upcoming dates, and `Other`). Round Apple checkboxes with completion strike-through. |
| **Team** | Team member matrix displaying assigned daily clients and pending task counters. Clicking any member instantly filters the Tasks tab to show only their work. |
| **Timeline** | 2-column Apple Calendar widget (`TODAY` & `TOMORROW`) with a live red real-time scrubber indicator (`---•---`). Clicking any hourly task chip jumps straight to it. |
| **History** | Dedicated **1-Year Archive** of completed tasks. Grouped by `Completed Today`, `Completed Yesterday`, and month/year. Restore any task back with 1-click or search history. |

### 4. 👤 Highlighted Assignee & Client Badges
- Glowing translucent color-coded chips for each team member (e.g. `Tanvir`, `Rafiqul`, `Sarah`).
- Clean client tags and due time formatting for effortless scanning.

### 5. 🗄️ 1-Year Server Retention Policy
- Automatically retains completed task history for **365 days** on the server before pruning.
- Full offline persistence via atomic JSON store (`data/store.json`).

### 6. 🎵 Web Audio Sound Effects
- Synthesized native Apple completion chime and tactile pop sounds without external audio file dependencies.

---

## 🚀 Quick Start & Installation

### 🍎 macOS Installation

#### Method 1: Terminal 1-Line Installer (Recommended)
Open Terminal and run:
```bash
curl -sSL https://raw.githubusercontent.com/yahiabinzaman/team-to-do/main/install-mac.sh | bash
```

#### Method 2: Manual Clone
```bash
# 1. Clone repository
git clone https://github.com/yahiabinzaman/team-to-do.git
cd team-to-do

# 2. Install dependencies
npm install

# 3. Setup macOS auto-start on login
chmod +x setup-mac-autostart.sh mac-launcher.sh
./setup-mac-autostart.sh

# 4. Launch Widget
./mac-launcher.sh
```

---

### 🪟 Windows Installation

#### Method 1: PowerShell 1-Line Installer (Recommended)
Open PowerShell and run:
```powershell
irm https://raw.githubusercontent.com/yahiabinzaman/team-to-do/main/install-windows.ps1 | iex
```

#### Method 2: 1-Click Setup
1. Download or clone this repository to your Windows PC:
   ```cmd
   git clone https://github.com/yahiabinzaman/team-to-do.git
   cd team-to-do
   ```
2. Run `npm install` in command prompt.
3. **To Launch**: Double-click **`start-windows.bat`**.
4. **To Auto-Start on Windows Boot**: Double-click **`setup-windows-autostart.bat`**.

---

## 🌐 Free Global Cloud Sync (Across Different Wi-Fi Networks)

To sync your widget across different networks/locations anywhere in the world 100% free:

### 🌟 Free 1-Click Deployment on Render.com
1. Fork / push this repo to your GitHub account.
2. Sign up at [Render.com](https://render.com) (Free).
3. Create a **New Web Service** and select this GitHub repository.
4. Set **Build Command**: `npm install` and **Start Command**: `node server.js`.
5. Render will provide a free live URL (e.g. `https://my-team-todo.onrender.com`).
6. Point your Mac and Windows clients to this URL for instant global sync!

---

## 📦 Building Standalone Installers (`.dmg`, `.exe`)

To generate distributable installers for macOS and Windows using `electron-builder`:

```bash
# Build for current OS
npm run dist

# Build macOS DMG and ZIP
npm run dist:mac

# Build Windows NSIS Installer and Portable EXE
npm run dist:win
```
The compiled binaries will be output to the `dist/` directory.

---

## 🛠️ Tech Stack & Architecture

- **Runtime**: [Electron](https://electronjs.org) (Frameless, transparent desktop window)
- **Backend**: Node.js, [Express](https://expressjs.com), [ws](https://github.com/websockets/ws) (WebSocket server)
- **Frontend**: Vanilla HTML5, Modern CSS Glassmorphism, Vanilla ES6 JavaScript
- **Audio**: Web Audio API (Synthesized Apple chimes)
- **Storage**: Persistent Atomic JSON Store with 1-Year Retention Filter

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).

<div align="center">
  <b>Crafted with ❤️ by <a href="https://github.com/yahiabinzaman">Yahia Bin Zaman</a></b>
</div>
