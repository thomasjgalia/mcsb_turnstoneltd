# Get Supabase Service Role Key

## Steps:

1. Go to: https://supabase.com/dashboard/project/idnazqdzdnbnoptmqujb/settings/api

2. Look for the **"service_role"** key under **Project API keys**

3. Click the **eye icon** to reveal the key

4. Copy the key (it starts with `eyJ...`)

5. Update `.env` file:
   ```
   SUPABASE_SERVICE_ROLE_KEY=eyJ...your-key-here
   ```

⚠️ **IMPORTANT**: Keep this key secret! Never commit it to git or share it publicly.

## Also Update Azure SQL Credentials

If you're using the same Oracle database credentials for Azure SQL:

```env
# Azure SQL Database Configuration (for user data storage)
AZURE_SQL_SERVER=your-server.database.windows.net
AZURE_SQL_DATABASE=your-database
AZURE_SQL_USER=ADMIN
AZURE_SQL_PASSWORD=S0Lfiliilibertati$
```

Or use connection string format (recommended):

```env
AZURE_SQL_CONNECTION_STRING=Server=your-server.database.windows.net;Database=your-database;User Id=ADMIN;Password=S0Lfiliilibertati$;Encrypt=true;TrustServerCertificate=true;
```

## Test the Integration

Once you've updated the keys:

1. **Restart the dev server**: `npm run dev`
2. **Sign in** to the app
3. **Check browser console** - You should see:
   - "Creating user profile" or similar message
4. **Perform a search** - Check console for search tracking
5. **Build a code set** - Click "Save Code Set" button
6. **Check Azure SQL** - Verify data was saved:
   ```sql
   SELECT * FROM user_profiles;
   SELECT * FROM search_history ORDER BY searched_at DESC;
   SELECT * FROM saved_code_sets ORDER BY created_at DESC;
   ```
