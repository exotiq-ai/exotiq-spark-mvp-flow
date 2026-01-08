#!/bin/bash

# RARI Universal Query - One-Command Deployment
# This deploys your universal query function to Supabase

echo "🚀 Deploying Rari Universal Query Function..."
echo ""

# Deploy the function
npx supabase functions deploy rari-universal-query

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Your function URL:"
echo "https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-universal-query"
echo ""
echo "🧪 Test it with:"
echo "curl -X POST https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rari-universal-query \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"query\": \"What is my total revenue this month?\"}'"
echo ""
echo "📖 Next steps:"
echo "1. Test the function with curl (see above)"
echo "2. Add it to ElevenLabs (see RARI_UNIVERSAL_QUERY_SETUP.md)"
echo "3. Upload RARI_CAPABILITIES_KNOWLEDGE_BASE.md to ElevenLabs"
echo "4. Ask Rari questions!"
echo ""
echo "🎉 You're ready to scale!"
