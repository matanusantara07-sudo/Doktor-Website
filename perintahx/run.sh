#!/bin/bash
# PerintahX v1 - Quick run script

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  PerintahX v1 - Startup Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if config exists
if [ ! -f "config.yaml" ]; then
    echo -e "${RED}Error: config.yaml not found!${NC}"
    echo "Please create config.yaml from the template in README.md"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo -e "${YELLOW}Virtual environment not found. Creating...${NC}"
    python3 -m venv .venv
    echo -e "${GREEN}Virtual environment created.${NC}"
fi

# Activate virtual environment
source .venv/bin/activate

# Check if dependencies are installed
if ! python3 -c "import requests, yaml, psutil" 2>/dev/null; then
    echo -e "${YELLOW}Dependencies not installed. Installing...${NC}"
    pip install -q -r requirements.txt
    echo -e "${GREEN}Dependencies installed.${NC}"
fi

# Display current mode
MODE=$(python3 -c "import yaml; print(yaml.safe_load(open('config.yaml')).get('mode', 'OBSERVE_ONLY'))")
echo ""
echo -e "Current mode: ${YELLOW}${MODE}${NC}"

if [ "$MODE" = "OBSERVE_ONLY" ]; then
    echo -e "${GREEN}Safe mode: Will monitor and log only (no system changes)${NC}"
else
    echo -e "${RED}ACTIVE mode: Will execute recovery actions automatically!${NC}"
    echo -e "${YELLOW}Press Ctrl+C within 5 seconds to cancel...${NC}"
    sleep 5
fi

echo ""
echo -e "${GREEN}Starting PerintahX...${NC}"
echo -e "Audit log: ${YELLOW}audit.log.jsonl${NC}"
echo -e "Kill switch: ${YELLOW}touch KILL_SWITCH${NC} to emergency halt"
echo ""
echo -e "${GREEN}========================================${NC}"
echo ""

# Run the main script
python3 main.py
