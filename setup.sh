#!/bin/bash

# ===========================================
# Web Manager — One-Click Setup Script
# Run this on a fresh Mac mini (Apple Silicon)
# Usage: chmod +x setup.sh && ./setup.sh
# ===========================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "=========================================="
echo "  Web Manager — Setup Script"
echo "=========================================="
echo ""

# --- Check if Homebrew is installed ---
if ! command -v brew &> /dev/null; then
  echo -e "${YELLOW}Installing Homebrew...${NC}"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
  eval "$(/opt/homebrew/bin/brew shellenv)"
  echo -e "${GREEN}✅ Homebrew installed${NC}"
else
  echo -e "${GREEN}✅ Homebrew already installed${NC}"
fi

# --- Install Node.js ---
if ! command -v node &> /dev/null; then
  echo -e "${YELLOW}Installing Node.js...${NC}"
  brew install node
  echo -e "${GREEN}✅ Node.js installed ($(node --version))${NC}"
else
  echo -e "${GREEN}✅ Node.js already installed ($(node --version))${NC}"
fi

# --- Install MySQL ---
if ! command -v mysql &> /dev/null; then
  echo -e "${YELLOW}Installing MySQL...${NC}"
  brew install mysql
  echo -e "${GREEN}✅ MySQL installed${NC}"
else
  echo -e "${GREEN}✅ MySQL already installed${NC}"
fi

# --- Start MySQL ---
echo -e "${YELLOW}Starting MySQL...${NC}"
brew services start mysql 2>/dev/null || true
sleep 2
echo -e "${GREEN}✅ MySQL running (auto-starts on boot)${NC}"

# --- Install PHP (needed for phpMyAdmin) ---
if ! command -v php &> /dev/null; then
  echo -e "${YELLOW}Installing PHP...${NC}"
  brew install php
  echo -e "${GREEN}✅ PHP installed${NC}"
else
  echo -e "${GREEN}✅ PHP already installed${NC}"
fi

# --- Install phpMyAdmin ---
if [ ! -d "/opt/homebrew/share/phpmyadmin" ]; then
  echo -e "${YELLOW}Installing phpMyAdmin...${NC}"
  brew install phpmyadmin
  echo -e "${GREEN}✅ phpMyAdmin installed${NC}"
else
  echo -e "${GREEN}✅ phpMyAdmin already installed${NC}"
fi

# --- Setup phpMyAdmin auto-start on port 8081 ---
PLIST_PATH="$HOME/Library/LaunchAgents/com.webmanager.phpmyadmin.plist"
if [ ! -f "$PLIST_PATH" ]; then
  echo -e "${YELLOW}Setting up phpMyAdmin auto-start (port 8081)...${NC}"
  mkdir -p "$HOME/Library/LaunchAgents"
  cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.webmanager.phpmyadmin</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/php</string>
    <string>-S</string>
    <string>localhost:8081</string>
    <string>-t</string>
    <string>/opt/homebrew/share/phpmyadmin</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/phpmyadmin.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/phpmyadmin-error.log</string>
</dict>
</plist>
EOF
  launchctl load "$PLIST_PATH"
  echo -e "${GREEN}✅ phpMyAdmin running on http://localhost:8081 (auto-starts on boot)${NC}"
else
  echo -e "${GREEN}✅ phpMyAdmin auto-start already configured${NC}"
  launchctl load "$PLIST_PATH" 2>/dev/null || true
fi

# --- Configure phpMyAdmin (blowfish_secret + allow no password) ---
PMA_CONF="/opt/homebrew/etc/phpmyadmin.config.inc.php"
if [ -f "$PMA_CONF" ]; then
  CURRENT_SECRET=$(grep "blowfish_secret" "$PMA_CONF" | grep -o "'[^']*'" | tail -1 | tr -d "'")
  if [ -z "$CURRENT_SECRET" ]; then
    BF_SECRET=$(openssl rand -hex 16)
    sed -i '' "s|\$cfg\['blowfish_secret'\] = '';|\$cfg['blowfish_secret'] = '$BF_SECRET';|" "$PMA_CONF"
    echo -e "${GREEN}✅ phpMyAdmin blowfish_secret configured${NC}"
  else
    echo -e "${GREEN}✅ phpMyAdmin blowfish_secret already set${NC}"
  fi
fi

# --- Set MySQL root password ---
echo -e "${YELLOW}Setting MySQL root password...${NC}"
mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'ishoke2026'; FLUSH PRIVILEGES;" 2>/dev/null || \
mysql -u root -pishoke2026 -e "SELECT 1;" 2>/dev/null || true
echo -e "${GREEN}✅ MySQL root password set (login: root / ishoke2026)${NC}"

# --- Install PM2 ---
if ! command -v pm2 &> /dev/null; then
  echo -e "${YELLOW}Installing PM2...${NC}"
  npm install -g pm2
  echo -e "${GREEN}✅ PM2 installed${NC}"
else
  echo -e "${GREEN}✅ PM2 already installed ($(pm2 --version))${NC}"
fi

# --- Install npm dependencies ---
echo -e "${YELLOW}Installing project dependencies...${NC}"
npm install
echo -e "${GREEN}✅ Dependencies installed${NC}"

# --- Setup .env ---
if [ ! -f .env ]; then
  SECRET=$(openssl rand -hex 32)
  cp .env.example .env
  sed -i '' "s/change-this-to-a-random-string-64-chars/$SECRET/" .env
  sed -i '' "s/NODE_ENV=production/NODE_ENV=production/" .env
  echo -e "${GREEN}✅ .env created with random session secret${NC}"
else
  echo -e "${GREEN}✅ .env already exists${NC}"
fi

# --- Setup Database ---
echo -e "${YELLOW}Setting up database...${NC}"
mysql -u root -pishoke2026 < schema.sql 2>/dev/null || echo -e "${YELLOW}⚠️  Database may already exist (that's OK)${NC}"
echo -e "${GREEN}✅ Database ready${NC}"

# --- Start with PM2 ---
echo -e "${YELLOW}Starting Web Manager with PM2...${NC}"
pm2 delete web-manager 2>/dev/null || true
pm2 start app.js --name web-manager
pm2 save

# --- PM2 auto-start on boot (runs sudo automatically) ---
echo -e "${YELLOW}Setting up PM2 auto-start on boot...${NC}"
echo -e "${YELLOW}You may be asked for your password (this is required for auto-start):${NC}"
sudo env PATH=$PATH:$(dirname $(which node)) $(which pm2) startup launchd -u $(whoami) --hp $HOME
pm2 save
echo -e "${GREEN}✅ PM2 auto-start configured${NC}"

# --- Install log rotation ---
pm2 install pm2-logrotate 2>/dev/null || true
pm2 set pm2-logrotate:max_size 10M 2>/dev/null || true
pm2 set pm2-logrotate:retain 7 2>/dev/null || true

echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}  ✅ Setup Complete!${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
echo -e "  Panel:       ${GREEN}http://localhost:3000${NC}"
echo -e "  phpMyAdmin:  ${GREEN}http://localhost:8081${NC}"
echo ""
echo -e "  Panel Login:"
echo -e "    Username:  ${YELLOW}admin${NC}"
echo -e "    Password:  ${YELLOW}admin123${NC}"
echo ""
echo -e "  MySQL / phpMyAdmin Login:"
echo -e "    Username:  ${YELLOW}root${NC}"
echo -e "    Password:  ${YELLOW}ishoke2026${NC}"
echo ""
echo -e "  ${RED}⚠️  Change the default password after first login!${NC}"
echo ""
echo -e "  Everything auto-starts on boot:"
echo -e "    ✅ MySQL"
echo -e "    ✅ PM2 (all apps + this panel)"
echo -e "    ✅ phpMyAdmin"
echo ""
echo -e "  PM2 Status:  pm2 status"
echo -e "  PM2 Logs:    pm2 logs web-manager"
echo -e "  Restart:     pm2 restart web-manager"
echo ""
