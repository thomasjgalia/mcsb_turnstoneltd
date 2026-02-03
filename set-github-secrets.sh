#!/bin/bash

# Script to set GitHub Actions secrets for mcsb_turnstoneltd repository
# Prerequisites: GitHub CLI (gh) must be installed and authenticated
# Run: gh auth login (if not already authenticated)

REPO="thomasjgalia/mcsb_turnstoneltd"

echo "Setting GitHub Actions secrets for $REPO..."

# Set each secret
gh secret set AZURE_SQL_CONNECTION_STRING \
  --repo "$REPO" \
  --body "Server=mcsbserver.database.windows.net;Database=omop_vocabulary;User Id=CloudSAb1e05bb3;Password=S0Lfiliilibertati;Encrypt=true;TrustServerCertificate=true;"

gh secret set AZURE_SQL_DATABASE \
  --repo "$REPO" \
  --body "omop_vocabulary"

gh secret set AZURE_SQL_PASSWORD \
  --repo "$REPO" \
  --body "S0Lfiliilibertati"

gh secret set AZURE_SQL_SERVER \
  --repo "$REPO" \
  --body "mcsbserver.database.windows.net"

gh secret set AZURE_SQL_USER \
  --repo "$REPO" \
  --body "CloudSAb1e05bb3"

gh secret set SUPABASE_SERVICE_ROLE_KEY \
  --repo "$REPO" \
  --body "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkbmF6cWR6ZG5ibm9wdG1xdWpiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMzMzE0MSwiZXhwIjoyMDgzOTA5MTQxfQ.rc4Pwm0r4DoXeU519izTFL2wQwOYJw7LS8dohdrJCgg"

gh secret set VITE_SUPABASE_ANON_KEY \
  --repo "$REPO" \
  --body "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkbmF6cWR6ZG5ibm9wdG1xdWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzMxNDEsImV4cCI6MjA4MzkwOTE0MX0.UtAL6X5cjCasB3IfFkONwMh5zx_RejBCU34gIoe-E2w"

gh secret set VITE_SUPABASE_URL \
  --repo "$REPO" \
  --body "https://idnazqdzdnbnoptmqujb.supabase.co"

echo "✓ All secrets have been set successfully!"
echo "You can verify them at: https://github.com/$REPO/settings/secrets/actions"
