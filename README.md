# Web Manager — Multi-Node Application Management Panel

A lightweight admin dashboard for managing multiple Node.js applications on a Mac mini using PM2.

Built for non-technical staff to monitor apps, view logs, and restart services — without needing SSH or terminal access.

---

## What This Panel Does

- Monitor all PM2-managed Node.js apps (status, CPU, memory, uptime)
- Start / Stop / Restart apps with one click
- View and clear application logs
- Monitor server health (CPU, memory, disk, uptime)
- Check MySQL connection status
- Access phpMyAdmin from the dashboard
- Audit trail — all admin actions are logged

## What Happens If This Panel Crashes?

**Nothing happens to your apps.** PM2 runs independently as its own daemon. This panel is just a viewer/controller — it does NOT host your apps. If the panel goes down, all your Node.js apps continue running normally. PM2 will auto-restart this panel within seconds.

---

## One-Click Setup (Recommended)

On a **fresh Mac mini**, just copy this project folder and run:

```bash
cd /path/to/Web\ Manager
chmod +x setup.sh
./setup.sh
```

The script will ask for your password once (needed for auto-start on boot).

It automatically installs and configures everything:
- Homebrew, Node.js, MySQL, PHP, PM2
- phpMyAdmin (on port 8081, auto-starts on boot)
- Project dependencies and database
- PM2 auto-start on boot
- Log rotation

After it finishes:
- **Panel:** http://localhost:3000
- **phpMyAdmin:** http://localhost:8081
- **Login:** `admin` / `admin123`

**⚠️ Change the default password after first login!**

### What Auto-Starts on Boot

| Service | Auto-Start |
|---------|-----------|
| MySQL | ✅ via Homebrew |
| PM2 + all apps + this panel | ✅ via launchd |
| phpMyAdmin (port 8081) | ✅ via launchd |
| Cloudflare Tunnel | ✅ if configured |

---

## Manual Setup (Step by Step)

If you prefer to set up manually instead of using the script.

### Step 1: Install Homebrew

Open **Terminal** (Applications → Utilities → Terminal) and run:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

After it finishes, follow the instructions it prints to add Homebrew to your PATH:

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

### Step 2: Install Node.js, MySQL, PHP

```bash
brew install node
brew install mysql
brew install php
brew install phpmyadmin
```

Start MySQL (auto-starts on boot):

```bash
brew services start mysql
```

(Optional) Set a MySQL root password:

```bash
mysql_secure_installation
```

> **Note:** Homebrew MySQL default login is `root` with **no password**. If you run `mysql_secure_installation`, you'll set a password — put that password in your `.env` file later.

Start phpMyAdmin on port 8081:

```bash
php -S localhost:8081 -t /opt/homebrew/share/phpmyadmin
```

### Step 3: Install PM2

```bash
npm install -g pm2
```

### Step 4: Install Project Dependencies

```bash
cd /path/to/Web\ Manager
npm install
```

### Step 5: Setup Database

```bash
mysql -u root < schema.sql
```

### Step 6: Configure Environment

```bash
cp .env.example .env
```

Edit the `.env` file and set `DB_PASSWORD` and `SESSION_SECRET`.

### Step 7: Start the Panel

```bash
pm2 start app.js --name web-manager
pm2 save
pm2 startup
# Run the sudo command it prints
```

---

## Adding Your Apps to PM2

For each Node.js app you want to manage:

```bash
pm2 start /path/to/your-app/app.js --name "app-name"
pm2 save
```

Or use the ecosystem config file:

```bash
# Edit config/ecosystem.config.js with your apps
pm2 start config/ecosystem.config.js
pm2 save
```

Once added, apps will automatically appear in the dashboard.

---

## Remote Access with Cloudflare Tunnel

Access your panel and apps from anywhere without exposing ports or configuring a firewall.

Managed from the **Settings** page in the panel (⚙️ gear icon → SUPER_ADMIN only).

### Step 1: Install Cloudflared

Go to **Settings** → click **Install Cloudflared**. This installs it via Homebrew.

### Step 2: Login to Cloudflare (Terminal — one time only)

This is the only step that requires Terminal. It opens a browser to authenticate with your Cloudflare account:

```bash
cloudflared tunnel login
```

Select the domain you want to use. This saves a certificate to `~/.cloudflared/cert.pem`.

### Step 3: Create a Tunnel

Back in the **Settings** page, enter a tunnel name (e.g. `indosofthouse`) and click **Create**. This generates a tunnel ID and credentials file.

### Step 4: Edit Config

In the config editor on the Settings page, paste your config:

```yaml
tunnel: YOUR-TUNNEL-ID
credentials-file: /Users/YOUR-USER/.cloudflared/YOUR-TUNNEL-ID.json

ingress:
  - hostname: panel.yourdomain.com
    service: http://localhost:3000
  - hostname: db.yourdomain.com
    service: http://localhost:8081
  - service: http_status:404
```

Click **Save Config**.

### Step 5: Add DNS Records

In your Cloudflare dashboard, add CNAME records:

| Name | Target |
|------|--------|
| `panel` | `YOUR-TUNNEL-ID.cfargotunnel.com` |
| `db` | `YOUR-TUNNEL-ID.cfargotunnel.com` |

### Step 6: Start the Tunnel

Click **Start Tunnel** on the Settings page. Your panel is now accessible at `panel.yourdomain.com`.

### Step 7: Auto-Start on Boot (Terminal — one time only)

```bash
sudo cloudflared service install
```

### Summary

| What | Where |
|------|-------|
| Install, Create, Config, Start/Stop | ✅ GUI (Settings page) |
| Login to Cloudflare | Terminal (one time) |
| Auto-start on boot | Terminal (one time) |

---

## User Roles

| Role | Dashboard | Logs | Start/Stop/Restart |
|------|-----------|------|--------------------|
| SUPER_ADMIN | ✅ | ✅ | ✅ |
| ADMIN | ✅ | ✅ | ✅ |
| STAFF | ✅ | ✅ | ❌ (view only) |

---

## Project Structure

```
├── app.js                  # Main entry point
├── setup.sh                # One-click setup script
├── config/
│   ├── database.js         # MySQL connection
│   ├── ecosystem.config.js # PM2 config template
│   └── cloudflare-tunnel.example.yml
├── controllers/            # Route handlers
├── middleware/              # Auth, roles, rate-limit
├── services/               # PM2, system, DB, audit
├── routes/                 # Express routes
├── views/                  # EJS templates
├── public/                 # CSS + JS
└── schema.sql              # Database setup
```

---

## Security Notes

- No arbitrary shell commands — PM2 actions use a hardcoded whitelist
- App names are validated against PM2 before any action
- CSRF protection on all forms
- Login rate-limited (5 attempts per 15 minutes)
- Helmet security headers enabled
- All admin actions logged with username, action, IP, and timestamp
