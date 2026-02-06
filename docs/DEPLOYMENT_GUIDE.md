# Deployment Guide: Incucyte Analyzer with Supabase & Vercel

This guide will walk you through deploying the Incucyte Wound Healing Analyzer with authentication and database features using Supabase and Vercel.

## Prerequisites

- A Google account (for Google OAuth SSO)
- A GitHub account (for Vercel deployment)
- Basic familiarity with web browsers

## Overview

You'll be setting up:
1. **Supabase** - Database and authentication backend
2. **Google Cloud Console** - Google OAuth Credentials
3. **Vercel** - Frontend hosting

**Estimated time:** 30-45 minutes

---

## Part 1: Create Supabase Project

### Step 1: Sign up for Supabase

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign in with GitHub (recommended) or email

### Step 2: Create a new project

1. Click "New Project"
2. Fill in the details:
   - **Name**: `incucyte-analyzer` (or your preferred name)
   - **Database Password**: Create a strong password and **save it securely**
   - **Region**: Choose the region closest to your users
   - **Pricing Plan**: Free tier is sufficient to start
3. Click "Create new project"
4. Wait 2-3 minutes for the project to initialize

### Step 3: Save your project credentials

1. In your Supabase project dashboard, click "Settings" (gear icon) in the left sidebar
2. Click "API" under Project Settings
3. You'll see two important values - **copy and save these**:
   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (long string)

**Important:** Keep these values safe - you'll need them later!

---

## Part 2: Set Up Database

### Step 4: Run database migrations

1. In your Supabase project, click "SQL Editor" in the left sidebar
2. Click "New query"
3. Copy and paste the contents of `supabase/migrations/001_create_profiles.sql` from your project
4. Click "Run" (or press Ctrl+Enter)
5. Repeat for the remaining migration files in order:
   - `002_create_experiments.sql`
   - `003_first_user_admin_trigger.sql`
   - `004_auto_create_profile.sql`

**Tip:** You should see "Success. No rows returned" for each migration.

### Step 5: Verify tables were created

1. Click "Table Editor" in the left sidebar
2. You should see two tables:
   - `profiles`
   - `experiments`

---

## Part 3: Configure Google OAuth Authentication

### Step 6: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Navigate to **APIs & Services** → **OAuth consent screen**
4. Choose **External** user type, click Create
5. Fill in: App name ("Incucyte Analyzer"), user support email, developer email
6. Click **Save and Continue** through Scopes and Test Users
7. Go to **APIs & Services** → **Credentials**
8. Click **+ Create Credentials** → **OAuth client ID**
9. Application type: **Web application**
10. Name: "Incucyte Analyzer"
11. Under **Authorized redirect URIs**, add:
    - `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback`
    - *Note: Replace `<your-supabase-project-ref>` with your actual project reference from Step 3.*
12. Click **Create**
13. Copy **Client ID** and **Client Secret**

### Step 7: Enable Google in Supabase

1. In Supabase Dashboard → **Authentication** → **Providers**
2. Find **Google** and toggle it ON
3. Paste **Client ID** and **Client Secret**
4. Click **Save**

---

## Part 4: Deploy to Vercel

### Step 9: Push code to GitHub

1. If you haven't already, create a GitHub repository for your project
2. Push your code:
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

### Step 10: Deploy to Vercel

1. Go to [https://vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "Add New" → "Project"
4. Import your GitHub repository
5. Configure the project:
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (leave as default)
   - **Build Command**: `npm run build` (should be auto-detected)
   - **Output Directory**: `dist` (should be auto-detected)

### Step 11: Add Environment Variables

1. Before clicking "Deploy", expand "Environment Variables"
2. Add two variables:
   - **Name**: `VITE_SUPABASE_URL`
     **Value**: Your Supabase Project URL from Step 3
   - **Name**: `VITE_SUPABASE_ANON_KEY`
     **Value**: Your Supabase anon key from Step 3
3. Click "Deploy"
4. Wait 2-3 minutes for deployment to complete

### Step 12: Update Google OAuth redirect URLs

1. Copy your Vercel deployment URL (e.g., `https://your-project.vercel.app`)
2. Go back to the [Google Cloud Console](https://console.cloud.google.com) → **Credentials** → Your OAuth client
3. Under **Authorized redirect URIs**, add your production callback URL:
   - `https://your-project.vercel.app/auth/callback`
4. (Optional) For local development, add:
   - `http://localhost:5173/auth/callback`
5. Click **Save**

---

## Part 5: Test Your Deployment

### Step 13: Test the application

1. Visit your Vercel URL
2. You should see the Incucyte Analyzer homepage
3. Click **Sign in with Google**
4. Complete the Google sign-in flow
5. You should be redirected back to the analyzer

### Step 14: Verify first user is admin

1. After signing in, navigate to `/admin` in your browser
2. You should see the admin panel with your user listed as "admin"
3. If you see this, congratulations! Your first user is automatically an admin.

---

## Part 6: Ongoing Management

### Adding More Users

- Share your Vercel URL with other users in your organization
- They can sign in with their Google accounts
- New users will have "user" role by default
- Admins can change roles in the admin panel

### Managing Users (Admin Only)

1. Go to `/admin` on your deployed site
2. You can:
   - View all users
   - Change user roles (admin/user)
   - Activate/deactivate accounts

### Viewing Experiments

- Users can save experiments from the Results page
- Access saved experiments at `/experiments`
- Load previous experiments to continue analysis

---

## Troubleshooting

### "Missing Supabase environment variables" error

**Problem:** The app shows an error about missing environment variables.

**Solution:**
1. Go to Vercel dashboard → Your project → Settings → Environment Variables
2. Verify both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
3. Redeploy: Deployments → Click "..." → Redeploy

### Google OAuth SSO not working

**Problem:** Clicking "Sign in with Google" doesn't work or shows an error.

**Solution:**
1. **"redirect_uri_mismatch"**: Check that the redirect URIs in Google Cloud Console match your Supabase URL or Vercel URL exactly.
2. **"Access blocked: app has not been verified"**: Add test users in the OAuth consent screen settings or submit the app for verification.
3. **"OAuth consent screen not configured"**: Complete the consent screen setup in Google Cloud Console.
4. **Client Secret**: Verify the Client ID and Client Secret are correct.

### Email not returned from Google

**Problem:** User signs in but email is missing or account creation fails.

**Solution:**
1. Ensure the `email` scope is included in the authentication request (this is usually handled by the application's `signInWithOAuth` call).

### Users outside my organization can sign in

**Problem:** You want to restrict access to your organization only.

**Solution:**
1. Use domain restriction in Google Workspace if you have a Workspace account.
2. Alternatively, you can implement a check in the application to only allow specific email domains.

### "Row Level Security" errors

**Problem:** Users can't save experiments or see data.

**Solution:**
1. Go to Supabase → SQL Editor
2. Re-run all migration files in order
3. Verify RLS is enabled: Go to Table Editor → profiles → Click table → Check "Enable RLS" is ON

---

## Security Best Practices

1. **Never commit `.env.local`** - It contains sensitive credentials
2. **Use strong database passwords** - Supabase requires this
3. **Rotate Client Secrets** - Periodically rotate your Google OAuth client secrets for enhanced security
4. **OAuth Consent Screen** - Ensure your OAuth consent screen is verified for production use to avoid "unverified app" warnings
5. **Regularly review user access** - Use the admin panel to audit users

---

## Cost Information

### Supabase Free Tier Includes:
- 500 MB database space
- 1 GB file storage
- 2 GB bandwidth
- 50,000 monthly active users

### Vercel Free Tier Includes:
- Unlimited deployments
- 100 GB bandwidth per month
- Automatic HTTPS

**Both services are free for small teams and personal use!**

---

## Getting Help

- **Supabase Docs**: [https://supabase.com/docs](https://supabase.com/docs)
- **Vercel Docs**: [https://vercel.com/docs](https://vercel.com/docs)
- **Google OAuth Docs**: [https://developers.google.com/identity/protocols/oauth2](https://developers.google.com/identity/protocols/oauth2)

---

## Summary Checklist

- [ ] Supabase project created
- [ ] Database migrations run successfully
- [ ] Google Cloud Project created
- [ ] OAuth consent screen configured
- [ ] OAuth client ID and Client Secret saved
- [ ] Google provider enabled in Supabase
- [ ] Code pushed to GitHub
- [ ] Vercel project deployed
- [ ] Environment variables set in Vercel
- [ ] Google OAuth redirect URIs updated (Supabase & Vercel)
- [ ] Application tested and working
- [ ] First user verified as admin

**Congratulations! Your Incucyte Analyzer is now deployed with Google OAuth authentication and database features!**
