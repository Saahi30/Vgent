#!/bin/bash
set -e

echo "══════════════════════════════════════════"
echo "  Vgent — Local Development Setup"
echo "══════════════════════════════════════════"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_command() {
    if command -v "$1" &> /dev/null; then
        echo -e "${GREEN}✓${NC} $1 found"
        return 0
    else
        echo -e "${RED}✗${NC} $1 not found"
        return 1
    fi
}

echo "Step 1: Checking prerequisites..."
echo "──────────────────────────────────"

MISSING=0
check_command node || MISSING=1
check_command pnpm || MISSING=1
check_command python3 || MISSING=1
check_command pip3 || MISSING=1
check_command redis-server || { echo -e "${YELLOW}  Install with: brew install redis${NC}"; MISSING=1; }

if [ $MISSING -eq 1 ]; then
    echo ""
    echo -e "${RED}Missing prerequisites. Install them and re-run this script.${NC}"
    echo ""
    echo "Quick install (macOS):"
    echo "  brew install node pnpm python@3.11 redis"
    echo ""
    exit 1
fi

echo ""
echo "Step 2: Setting up environment..."
echo "──────────────────────────────────"

if [ ! -f .env.local ]; then
    cp .env.example .env.local
    echo -e "${GREEN}✓${NC} Created .env.local from .env.example"
    echo -e "${YELLOW}  ⚠ Fill in your API keys in .env.local before running the app${NC}"
else
    echo -e "${GREEN}✓${NC} .env.local already exists"
fi

# Generate secrets if not set
if grep -q "^API_SECRET_KEY=$" .env.local 2>/dev/null; then
    SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    sed -i '' "s|^API_SECRET_KEY=.*|API_SECRET_KEY=${SECRET}|" .env.local
    echo -e "${GREEN}✓${NC} Generated API_SECRET_KEY"
fi

if grep -q "^FERNET_ENCRYPTION_KEY=$" .env.local 2>/dev/null; then
    FERNET=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" 2>/dev/null || echo "")
    if [ -n "$FERNET" ]; then
        sed -i '' "s|^FERNET_ENCRYPTION_KEY=.*|FERNET_ENCRYPTION_KEY=${FERNET}|" .env.local
        echo -e "${GREEN}✓${NC} Generated FERNET_ENCRYPTION_KEY"
    else
        echo -e "${YELLOW}  ⚠ Install cryptography first: pip3 install cryptography${NC}"
    fi
fi

echo ""
echo "Step 3: Installing Node.js dependencies..."
echo "──────────────────────────────────────────"
pnpm install
echo -e "${GREEN}✓${NC} Node dependencies installed"

echo ""
echo "Step 4: Installing Python dependencies..."
echo "──────────────────────────────────────────"
cd apps/api
python3 -m venv .venv 2>/dev/null || true
source .venv/bin/activate
pip install -r requirements.txt --quiet
echo -e "${GREEN}✓${NC} Python dependencies installed (venv at apps/api/.venv)"
cd ../..

echo ""
echo "Step 5: Starting Redis..."
echo "──────────────────────────────────────────"
if redis-cli ping &> /dev/null; then
    echo -e "${GREEN}✓${NC} Redis already running"
else
    brew services start redis 2>/dev/null || redis-server --daemonize yes
    echo -e "${GREEN}✓${NC} Redis started"
fi

echo ""
echo "══════════════════════════════════════════"
echo -e "${GREEN}  Setup complete!${NC}"
echo "══════════════════════════════════════════"
echo ""
echo "Next steps:"
echo ""
echo "  1. Fill in your API keys in .env.local:"
echo "     - Supabase URL + keys (required)"
echo "     - Groq API key"
echo "     - Deepgram API key"
echo "     - Google API key"
echo "     - Sarvam API key"
echo ""
echo "  2. Run the Supabase migrations:"
echo "     Go to Supabase SQL Editor and run:"
echo "     - packages/database/migrations/001_initial.sql"
echo "     - packages/database/migrations/002_rls.sql"
echo "     - packages/database/migrations/003_functions.sql"
echo "     - packages/database/seed.sql"
echo ""
echo "  3. Start the dev servers:"
echo "     Terminal 1: cd apps/api && source .venv/bin/activate && uvicorn main:app --reload --port 8000"
echo "     Terminal 2: cd apps/web && pnpm dev"
echo "     Terminal 3: cd apps/api && source .venv/bin/activate && celery -A celery_app worker --loglevel=info"
echo ""
