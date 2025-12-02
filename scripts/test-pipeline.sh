#!/bin/bash

# Test Pipeline Script
# Quick test script to verify the complete pipeline

set -e  # Exit on error

echo "================================"
echo "LiveATC Pipeline Test"
echo "================================"
echo ""

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ Error: ffmpeg is not installed"
    echo "Please install ffmpeg:"
    echo "  macOS: brew install ffmpeg"
    echo "  Ubuntu: apt-get install ffmpeg"
    exit 1
fi

echo "✓ ffmpeg is installed"

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "Please copy .env.example to .env and configure it"
    exit 1
fi

echo "✓ .env file exists"

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "Installing dependencies..."
    npm install
fi

echo "✓ Dependencies installed"
echo ""

# Test 1: Record 30 seconds
echo "================================"
echo "Test 1: Recording (30 seconds)"
echo "================================"
echo ""

node scripts/liveatc-recorder.js --feed kjfk_gnd --duration 30

if [ $? -ne 0 ]; then
    echo "❌ Recording failed"
    exit 1
fi

echo ""
echo "✓ Recording successful"
echo ""

# Find the most recent recording (try both naming patterns)
RECORDING=$(ls -t recordings/raw/kjfk_gnd_*.mp3 recordings/raw/kjfk_ground_*.mp3 2>/dev/null | head -n 1)

if [ -z "$RECORDING" ]; then
    echo "❌ No recording file found"
    echo "Expected files matching: recordings/raw/kjfk_gnd_*.mp3 or recordings/raw/kjfk_ground_*.mp3"
    exit 1
fi

echo "Recording file: $RECORDING"
echo ""

# Test 2: Segment audio
echo "================================"
echo "Test 2: Segmentation"
echo "================================"
echo ""

node scripts/segment-audio.js --input "$RECORDING"

if [ $? -ne 0 ]; then
    echo "❌ Segmentation failed"
    exit 1
fi

echo ""
echo "✓ Segmentation successful"
echo ""

# Find the segments directory
BASENAME=$(basename "$RECORDING" .mp3)
SEGMENT_DIR="recordings/segments/$BASENAME"

if [ ! -d "$SEGMENT_DIR" ]; then
    echo "❌ Segments directory not found"
    exit 1
fi

SEGMENT_COUNT=$(ls "$SEGMENT_DIR"/*.mp3 2>/dev/null | wc -l | tr -d ' ')
echo "Segments created: $SEGMENT_COUNT"
echo ""

# Test 3: Upload to Supabase
echo "================================"
echo "Test 3: Upload to Supabase"
echo "================================"
echo ""

node scripts/upload-to-supabase.js --raw-file "$RECORDING" --segment-dir "$SEGMENT_DIR"

if [ $? -ne 0 ]; then
    echo "❌ Upload failed"
    echo ""
    echo "Make sure you have:"
    echo "  1. Created Supabase project"
    echo "  2. Run database migration"
    echo "  3. Created storage buckets"
    echo "  4. Set correct credentials in .env"
    exit 1
fi

echo ""
echo "✓ Upload successful"
echo ""

# Summary
echo "================================"
echo "✅ All Tests Passed!"
echo "================================"
echo ""
echo "Next steps:"
echo "  1. Start admin interface: npm run dev"
echo "  2. Open http://localhost:3000/admin/liveatc"
echo "  3. View your recording and segments"
echo ""
echo "To test the full pipeline:"
echo "  node scripts/scheduled-pipeline.js --feed kjfk --once"
echo ""
