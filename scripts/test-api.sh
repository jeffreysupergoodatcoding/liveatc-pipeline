#!/bin/bash

# Edge Case Detection API Test Script
# Tests all API endpoints

BASE_URL="http://localhost:3001"

echo "🧪 Testing Edge Case Detection API"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1: Taxonomy
echo "1️⃣  Testing Taxonomy Endpoint..."
RESPONSE=$(curl -s "$BASE_URL/api/edge-cases/taxonomy")
CASE_COUNT=$(echo $RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['metadata']['total_cases'])" 2>/dev/null)
if [ "$CASE_COUNT" = "57" ]; then
  echo "   ✅ Taxonomy loaded (57 cases)"
else
  echo "   ❌ Taxonomy test failed"
fi
echo ""

# Test 2: Rule Templates
echo "2️⃣  Testing Rule Templates..."
RESPONSE=$(curl -s "$BASE_URL/api/edge-cases/rules/templates")
TEMPLATE_COUNT=$(echo $RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['count'])" 2>/dev/null)
if [ "$TEMPLATE_COUNT" = "5" ]; then
  echo "   ✅ Rule templates available (5 templates)"
else
  echo "   ❌ Templates test failed"
fi
echo ""

# Test 3: Statistics
echo "3️⃣  Testing Statistics..."
RESPONSE=$(curl -s "$BASE_URL/api/segments/stats")
TOTAL=$(echo $RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['overall']['total_segments'])" 2>/dev/null)
if [ ! -z "$TOTAL" ]; then
  echo "   ✅ Statistics working ($TOTAL segments in database)"
else
  echo "   ❌ Statistics test failed"
fi
echo ""

# Test 4: Custom Rules
echo "4️⃣  Testing Custom Rules..."
RESPONSE=$(curl -s "$BASE_URL/api/edge-cases/rules")
STATUS=$?
if [ $STATUS -eq 0 ]; then
  echo "   ✅ Custom rules endpoint working"
else
  echo "   ❌ Custom rules test failed"
fi
echo ""

# Test 5: Check if API key is configured
echo "5️⃣  Checking Deepgram API Key..."
if grep -q "DEEPGRAM_API_KEY=.\+" .env 2>/dev/null; then
  echo "   ✅ Deepgram API key configured"
  echo ""
  echo "   🎤 You can now test audio detection:"
  echo "      curl -X POST $BASE_URL/api/segments/detect \\"
  echo "        -F \"audio=@path/to/audio.mp3\""
else
  echo "   ⚠️  Deepgram API key not configured"
  echo "      Add your key to .env to enable audio detection"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ API tests complete!"
echo ""
echo "📚 Full Documentation: EDGE_CASE_DETECTION.md"
echo "🔧 Verification Report: VERIFICATION.md"
