#!/bin/bash

# ===========================================
# Web Manager — Uninstall Script
# Removes everything so you can run setup.sh fresh
# Usage: chmod +x uninstall.sh && ./uninstall.sh
# ===========================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "=========================================="
echo "  Web Manager — Uninstall Script"
echo "=========================================="
echo ""
echo -e "${RED}⚠️  This will remove: PM2 apps, MySQL, phpMyAdmin, PHP${NC}"
echo -e "${RED}⚠️  Node.js and Homebrew will NOT be removed${NC}"
echo ""
read -p "Are you sure? (y/N): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "Cancelled."
  exit 0
fi

# --- Stop and remove PM2 ---
echo -e "${YELLOW}Stopping PM2 and all apps...${NC}"
pm2 kill 2>/dev/null || true
pm2 unstartup 2>/dev/null || true
npm uninstall -g pm2 2>/dev/null || true
rm -rf ~/.pm2 2>/dev/null || true
echo -e "${GREEN}✅ PM2 removed${NC}"

# --- Stop and remove phpMyAdmin LaunchAgent ---
echo -e "${YELLOW}Removing phpMyAdmin auto-start...${NC}"
PLIST_PATH="$HOME/Library/LaunchAgents/com.webmanager.phpmyadmin.plist"
launchctl unload "$PLIST_PATH" 2>/dev/null || true
rm -f "$PLIST_PATH" 2>/dev/null || true
echo -e "${GREEN}✅ phpMyAdmin LaunchAgent removed${NC}"

# --- Stop MySQL ---
echo -e "${YELLOW}Stopping MySQL...${NC}"
brew services stop mysql 2>/dev/null || true
echo -e "${GREEN}✅ MySQL stopped${NC}"

# --- Uninstall via Homebrew ---
echo -e "${YELLOW}Uninstalling phpMyAdmin...${NC}"
brew uninstall phpmyadmin 2>/dev/null || true
echo -e "${GREEN}✅ phpMyAdmin uninstalled${NC}"

echo -e "${YELLOW}Uninstalling PHP...${NC}"
brew uninstall php 2>/dev/null || true
echo -e "${GREEN}✅ PHP uninstalled${NC}"

echo -e "${YELLOW}Uninstalling MySQL...${NC}"
brew uninstall mysql 2>/dev/null || true
rm -rf /opt/homebrew/var/mysql 2>/dev/null || true
echo -e "${GREEN}✅ MySQL uninstalled${NC}"

# --- Clean project ---
echo -e "${YELLOW}Cleaning project files...${NC}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
rm -rf "$SCRIPT_DIR/node_modules" 2>/dev/null || true
rm -f "$SCRIPT_DIR/.env" 2>/dev/null || true
echo -e "${GREEN}✅ Project cleaned (node_modules + .env removed)${NC}"

# --- Brew cleanup ---
echo -e "${YELLOW}Running brew cleanup...${NC}"
brew cleanup 2>/dev/null || true

echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}  ✅ Uninstall Complete!${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
echo -e "  Everything has been removed."
echo -e "  To reinstall, run: ${YELLOW}chmod +x setup.sh && ./setup.sh${NC}"
echo ""
