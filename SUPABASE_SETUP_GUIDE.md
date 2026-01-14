# Supabase Setup Guide

Complete guide to setting up Supabase for the Medical Code Set Builder application.

---

## Step 1: Create a Supabase Project

1. Go to https://supabase.com
2. Click **Sign In** (or **Start your project** if new)
3. Click **New Project**
4. Fill in project details:
   - **Name:** `mcsb-oracle` (or your preferred name)
   - **Database Password:** Choose a strong password (save it somewhere safe!)
   - **Region:** Choose closest to your users (e.g., `US East (Ohio)` or `US West (Oregon)`)
   - **Pricing Plan:** Free tier is fine for development
5. Click **Create new project**
6. Wait 2-3 minutes for project to provision

---

## Step 2: Enable Email Authentication

1. In your Supabase project dashboard, go to **Authentication** → **Providers**
2. Find **Email** in the list
3. Make sure it's **Enabled** (should be enabled by default)
4. Scroll down to **Email Templates** (optional but recommended):
   - Click **Magic Link** template
   - Customize the email if desired
   - Click **Save**

### Configure Email Settings (Optional)

For production, you may want to configure a custom SMTP server:
1. Go to **Project Settings** → **Auth**
2. Scroll to **SMTP Settings**
3. Enable **Use Custom SMTP Server**
4. Enter your SMTP credentials (Gmail, SendGrid, etc.)

For development, Supabase's default email service works fine (but has rate limits).

---

## Step 3: Run the Database Setup SQL

1. In Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **New Query**
3. Copy the entire contents of `supabase_setup.sql` and paste it into the editor
4. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`)
5. Wait for execution to complete (~5 seconds)
6. You should see: **Success. No rows returned**

### Verify Tables Were Created

Run this verification query in SQL Editor:

```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('user_preferences', 'saved_code_sets', 'search_history');
```

**Expected result:** 3 rows showing your three tables.

---

## Step 4: Verify Row Level Security (RLS)

RLS ensures users can only access their own data. Verify it's enabled:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('user_preferences', 'saved_code_sets', 'search_history');
```

**Expected result:** All three tables should show `rowsecurity = true`.

---

## Step 5: Get Your API Credentials

1. Go to **Project Settings** → **API** (gear icon in left sidebar)
2. Copy these values:

### Project URL
```
https://your-project-ref.supabase.co
```

### Project API Keys
- **anon (public)** key - Use this in your frontend (safe to expose)
- **service_role (secret)** key - **DO NOT expose this** (only use in backend if needed)

---

## Step 6: Configure Your .env File

1. In your project root, create `.env` file (if it doesn't exist):
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Supabase credentials:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here

# Oracle Database Configuration (for later)
ORACLE_USER=ADMIN
ORACLE_PASSWORD=your-oracle-password
ORACLE_CONNECTION_STRING=your-connection-string
ORACLE_WALLET_LOCATION=/path/to/wallet
ORACLE_WALLET_PASSWORD=your-wallet-password
```

**Replace:**
- `your-project-ref` with your actual Supabase project reference
- `your-anon-public-key-here` with the actual anon key

---

## Step 7: Test Authentication (Optional)

You can test authentication directly in Supabase before running the app:

1. Go to **Authentication** → **Users**
2. Click **Add user** → **Create new user**
3. Enter a test email (use your own email to receive the magic link)
4. Click **Create user**
5. Check your email for the magic link
6. Click the link to verify it works

---

## Step 8: Configure Site URL (Important for Production)

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL** to your production domain:
   - Development: `http://localhost:5173`
   - Production: `https://your-app.vercel.app`
3. Add **Redirect URLs** (if needed):
   - `http://localhost:5173/**`
   - `https://your-app.vercel.app/**`
4. Click **Save**

---

## Database Schema Summary

Your Supabase database now has these tables:

### 1. `user_preferences`
Stores user UI preferences (default domain, theme)

| Column | Type | Description |
|---|---|---|
| `user_id` | UUID (PK) | References auth.users |
| `default_domain` | TEXT | Default medical domain |
| `theme` | TEXT | UI theme (light/dark) |
| `updated_at` | TIMESTAMP | Last update time |

### 2. `saved_code_sets`
Stores user's saved shopping carts

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Unique identifier |
| `user_id` | UUID (FK) | User who created it |
| `name` | TEXT | Code set name |
| `hierarchy_concept_ids` | BIGINT[] | Array of concept IDs |
| `created_at` | TIMESTAMP | Creation time |

### 3. `search_history`
Tracks recent searches

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Unique identifier |
| `user_id` | UUID (FK) | User who searched |
| `search_term` | TEXT | Search query |
| `domain` | TEXT | Medical domain |
| `created_at` | TIMESTAMP | Search time |

---

## Troubleshooting

### Error: "relation does not exist"
**Solution:** You haven't run the setup SQL. Go back to Step 3.

### Error: "new row violates row-level security policy"
**Solution:** RLS is working correctly! This means you're trying to insert data without proper authentication. Make sure you're signed in when testing.

### Magic link emails not arriving
**Solution:**
1. Check spam folder
2. Wait a few minutes (rate limits on free tier)
3. Try a different email address
4. Configure custom SMTP (see Step 2)

### Can't see data in tables
**Solution:** This is normal! Users must be authenticated to see their data due to RLS policies. Sign in first, then data will appear.

---

## Next Steps

✅ **Supabase is now fully configured!**

You can now:
1. Run the frontend application locally
2. Test authentication (magic link sign-in)
3. Search, build carts, and save code sets (once Oracle is set up)

---

## Useful Supabase Dashboard Links

- **Table Editor:** View and edit data - `https://supabase.com/dashboard/project/YOUR_PROJECT/editor`
- **SQL Editor:** Run queries - `https://supabase.com/dashboard/project/YOUR_PROJECT/sql`
- **Authentication:** Manage users - `https://supabase.com/dashboard/project/YOUR_PROJECT/auth/users`
- **API Docs:** Auto-generated API reference - `https://supabase.com/dashboard/project/YOUR_PROJECT/api`
- **Logs:** Debug issues - `https://supabase.com/dashboard/project/YOUR_PROJECT/logs`

---

## Cleanup (If You Need to Start Over)

To delete all tables and start fresh:

```sql
DROP TABLE IF EXISTS search_history CASCADE;
DROP TABLE IF EXISTS saved_code_sets CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_search_history() CASCADE;
```

Then re-run the setup SQL from Step 3.

---

## Success Checklist

Before moving on, verify:

- [ ] Supabase project created
- [ ] Email authentication enabled
- [ ] Database setup SQL executed successfully
- [ ] Three tables exist (user_preferences, saved_code_sets, search_history)
- [ ] RLS is enabled on all tables
- [ ] API credentials copied to .env file
- [ ] Test user can sign in (optional but recommended)
- [ ] Site URL configured

**If all checked, you're ready to test the application!** 🎉
