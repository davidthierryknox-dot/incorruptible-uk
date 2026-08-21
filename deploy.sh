#!/bin/bash
# Incorruptible UK Translation Engine — Vercel Deploy Script
# Run this once from this directory: bash deploy.sh

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo ""
echo "── Incorruptible UK Translation Engine: Vercel Deploy ──────────"
echo ""

# Check for Vercel CLI
if ! command -v vercel &> /dev/null; then
  echo "Installing Vercel CLI..."
  npm install -g vercel
fi

echo "Deploying to Vercel..."
echo ""
echo "  • You'll be prompted to log in if not already authenticated."
echo "  • When asked about project settings, accept the defaults."
echo "  • After deploy, set these environment variables in Vercel dashboard:"
echo ""
echo "    ANTHROPIC_API_KEY  =  <your Anthropic API key>"
echo "    FILE_IDS           =  <contents of .file_ids.json (after running --setup)>"
echo ""

vercel --prod

echo ""
echo "✓ Deployed! Next steps:"
echo "  1. Go to your Vercel dashboard → project → Settings → Environment Variables"
echo "  2. Add ANTHROPIC_API_KEY"
echo "  3. Add FILE_IDS (paste the JSON from .file_ids.json if you have it)"
echo "  4. Redeploy if you add env vars after the first deploy"
echo ""
