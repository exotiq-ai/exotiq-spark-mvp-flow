#!/bin/bash

# Test script for Rari MCP Server
# This helps debug why ElevenLabs isn't seeing tools

BASE_URL="https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-mcp-server"

echo "🔍 Testing Rari MCP Server Endpoints..."
echo ""

# Test 1: Server Info
echo "1️⃣ Testing Server Info Endpoint:"
curl -s "$BASE_URL" | jq '.' || echo "❌ Failed"
echo ""
echo "---"
echo ""

# Test 2: Manifest Endpoint (ElevenLabs format)
echo "2️⃣ Testing Manifest Endpoint (ElevenLabs format):"
curl -s "$BASE_URL/manifest" | jq '.' || echo "❌ Failed"
echo ""
echo "---"
echo ""

# Test 3: Tools List (REST)
echo "3️⃣ Testing Tools List (REST):"
curl -s "$BASE_URL/tools" | jq '.tools | length' && echo "tools found" || echo "❌ Failed"
echo ""
echo "---"
echo ""

# Test 4: SSE Endpoint (check if it connects)
echo "4️⃣ Testing SSE Endpoint (first 5 seconds):"
timeout 5 curl -N -s "$BASE_URL/sse" || echo "❌ SSE connection failed or timed out"
echo ""
echo "---"
echo ""

# Test 5: JSON-RPC Initialize
echo "5️⃣ Testing JSON-RPC Initialize:"
curl -s -X POST "$BASE_URL/messages?sessionId=test-123" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    }
  }' | jq '.' || echo "❌ Failed"
echo ""
echo "---"
echo ""

# Test 6: Tools List via JSON-RPC
echo "6️⃣ Testing Tools List (JSON-RPC):"
curl -s -X POST "$BASE_URL/messages?sessionId=test-123" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }' | jq '.result.tools | length' && echo "tools found" || echo "❌ Failed"
echo ""

echo "✅ Testing complete!"
echo ""
echo "If all tests pass, the MCP server is working correctly."
echo "If ElevenLabs still can't see tools, the issue is likely:"
echo "  - SSE endpoint format compatibility"
echo "  - CORS headers"
echo "  - ElevenLabs expecting different response format"
