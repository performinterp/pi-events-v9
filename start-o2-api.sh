#!/bin/bash

# O2 Sync API Server Startup Script

echo "================================================"
echo "Starting O2 Sync API Server"
echo "================================================"
echo ""

# Check if Flask is installed
if ! python3 -c "import flask" &> /dev/null; then
    echo "⚠️  Flask not installed. Installing dependencies..."
    pip3 install -r requirements-o2-api.txt
    echo ""
fi

# Check if required scripts exist
if [ ! -f "o2-scraper-enhanced.py" ]; then
    echo "❌ Error: o2-scraper-enhanced.py not found"
    exit 1
fi

if [ ! -f "o2-sync-complete.py" ]; then
    echo "❌ Error: o2-sync-complete.py not found"
    exit 1
fi

echo "✅ All dependencies ready"
echo ""
echo "Starting API server on http://localhost:5001"
echo "Press Ctrl+C to stop"
echo "================================================"
echo ""

# Start the API server
python3 o2-sync-api.py
