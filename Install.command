#!/bin/bash
cd "$(dirname "$0")"
chmod +x setup.sh
./setup.sh
echo ""
echo "Press any key to close this window..."
read -n 1
