#!/bin/bash
# Creates a GitHub repo and pushes the site. Run from Claude Code or terminal.
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

REPO_NAME="incorruptible-uk"

echo ""
echo "── Creating GitHub repo: $REPO_NAME ────────────────────────────"

# Remove any broken .git from sandbox attempt
rm -rf .git

# Init fresh
git init -b main
git config user.email "davidthierryknox@gmail.com"
git config user.name "Buffalo Dave"

# .gitignore
cat > .gitignore << 'EOF'
.DS_Store
node_modules/
.env
.vercel
EOF

git add .
git commit -m "Initial commit: Incorruptible UK Translation Engine"

# Create repo on GitHub and push
if command -v gh &>/dev/null; then
  gh repo create "$REPO_NAME" --public --source=. --remote=origin --push
  echo ""
  echo "✓ Repo created and pushed: https://github.com/$(gh api user -q .login)/$REPO_NAME"
else
  echo ""
  echo "⚠️  GitHub CLI (gh) not found. Install it: brew install gh"
  echo "   Then run: gh auth login"
  echo "   Then re-run this script."
fi
