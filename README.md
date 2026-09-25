<div align="center">

# Team To do
### Real-Time Team Task & Calendar Desktop Widget

[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-000000?style=flat-square&logo=apple&logoColor=white)](https://github.com/yahiabinzaman/team-to-do)
[![Database](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![Sync](https://img.shields.io/badge/Sync-Real--Time%20WebSocket-0A84FF?style=flat-square)](https://github.com/yahiabinzaman/team-to-do)
[![License](https://img.shields.io/badge/License-MIT-30D158?style=flat-square)](LICENSE)

An authentic Apple Reminders-style desktop widget designed for seamless, multi-device team collaboration with instantaneous cloud synchronization.

</div>

---

## Key Features

- **Desktop Background Widget**: Glued to the desktop wallpaper level on macOS and Windows, ensuring it never obstructs or steals focus from active application windows.
- **Instant Cloud Synchronization**: Powered by Supabase PostgreSQL and real-time WebSockets to synchronize task updates across all team members in under a second.
- **Date-Grouped Task Lists**: Intelligent chronological categorization separating Today, Tomorrow, and upcoming deadlines.
- **Team Member Filter**: Interactive member directory showing pending task counts and client distribution per member.
- **Interactive 2-Column Timeline**: Apple Calendar-style hourly schedule with live time tracking scrubber.
- **1-Year Completed Task Archive**: Searchable 365-day history log with one-click task restoration.
- **Minimalist macOS Status Bar Integration**: Native monochrome template icon with quick mode switching (Pin to Desktop, Normal Window, Always on Top).

---

## Installation

### macOS (One-Line Terminal Installer)

```bash
curl -sSL https://raw.githubusercontent.com/yahiabinzaman/team-to-do/main/install-mac.sh | bash
```

### Windows (One-Line PowerShell Installer)

```powershell
irm https://raw.githubusercontent.com/yahiabinzaman/team-to-do/main/install-windows.ps1 | iex
```

---

## Manual Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yahiabinzaman/team-to-do.git
   cd team-to-do
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Create a `.env` file based on `.env.example`:
   ```env
   PORT=4173
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_service_role_or_anon_key
   ```

4. **Launch Application**:
   - **macOS**: `./mac-launcher.sh`
   - **Windows**: Run `start-windows.bat`

---

## Tech Stack

- **Desktop Runtime**: Electron
- **Backend & Realtime Server**: Node.js, Express, WebSockets (`ws`)
- **Database**: Supabase PostgreSQL
- **Styling**: Vanilla CSS (Apple Human Interface Guidelines, Glassmorphism)

---

## License & Credits

Distributed under the [MIT License](LICENSE).

Developed and maintained by **[Yahia Bin Zaman](https://github.com/yahiabinzaman)**.
