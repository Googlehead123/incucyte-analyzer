# Deployment Guide: Incucyte Analyzer with Supabase & Vercel

This guide will walk you through deploying the Incucyte Wound Healing Analyzer with authentication and database features using Supabase and Vercel.

## Prerequisites

- A Microsoft / Azure account (for Azure AD SSO)
- A GitHub account (for Vercel deployment)
- Basic familiarity with web browsers

## Overview

You'll be setting up:
1. **Supabase** - Database and authentication backend
2. **Azure Portal** - Azure AD App Registration
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

## Part 3: Configure Azure AD Authentication

### Step 6: Create Azure App Registration

1. Go to the [Azure Portal](https://portal.azure.com)
2. Navigate to **Microsoft Entra ID** (formerly Azure Active Directory)
3. In the left sidebar, click **App registrations**
4. Click **+ New registration**
5. Fill in the details:
   - **Name**: `Incucyte Analyzer`
   - **Supported account types**: Select **"Accounts in this organizational directory only (Single tenant)"**
     - *Note: This restricts access to only users within your organization's email domain.*
6. Under **Redirect URI**, select **Web** from the dropdown and enter:
   - `https://YOUR_SUPABASE_PROJECT_URL/auth/v1/callback`
   - Replace `YOUR_SUPABASE_PROJECT_URL` with your actual Supabase URL from Step 3
   - Example: `https://abcdefghijk.supabase.co/auth/v1/callback`
7. Click **Register**

### Step 7: Save Application Credentials

1. On the **Overview** page of your new app registration, copy and save the following:
   - **Application (client) ID**
   - **Directory (tenant) ID**
2. In the left sidebar, click **Certificates & secrets**
3. Click the **Client secrets** tab, then click **+ New client secret**
4. Enter a description (e.g., `Supabase Auth`) and choose an expiry (recommended: 24 months)
5. Click **Add**
6. **IMPORTANT**: Copy the **Value** (not the Secret ID) immediately. You will not be able to see it again.
7. **Note the expiry date** and set a calendar reminder to rotate the secret before it expires.

### Step 8: Enable Azure (Microsoft) in Supabase

1. Go back to your Supabase project dashboard
2. Click **Authentication** in the left sidebar, then click **Providers**
3. Find **Azure (Microsoft)** and toggle it ON
4. Enter your Azure credentials:
   - **Client ID**: Paste the Application (client) ID from Step 7
   - **Client Secret**: Paste the Secret Value from Step 7
   - **Azure Tenant URL**: `https://login.microsoftonline.com/YOUR_TENANT_ID`
     - Replace `YOUR_TENANT_ID` with the Directory (tenant) ID from Step 7
5. Click **Save**

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

### Step 12: Update Azure AD redirect URLs

1. Copy your Vercel deployment URL (e.g., `https://your-project.vercel.app`)
2. Go back to the [Azure Portal](https://portal.azure.com) → **App registrations** → Your app
3. Click **Authentication** in the left sidebar
4. Under **Web** → **Redirect URIs**, click **Add URI**
5. Add your production callback URL:
   - `https://your-project.vercel.app/auth/callback`
6. (Optional) For local development, add:
   - `http://localhost:5173/auth/callback`
   - *Note: Azure requires `localhost`, it does not allow `127.0.0.1`.*
7. Click **Save** at the top of the page

---

## Part 5: Test Your Deployment

### Step 13: Test the application

1. Visit your Vercel URL
2. You should see the Incucyte Analyzer homepage
3. Click **Sign in with Microsoft**
4. Complete the Microsoft sign-in flow
5. You should be redirected back to the analyzer

### Step 14: Verify first user is admin

1. After signing in, navigate to `/admin` in your browser
2. You should see the admin panel with your user listed as "admin"
3. If you see this, congratulations! Your first user is automatically an admin.

---

## Part 6: Ongoing Management

### Adding More Users

- Share your Vercel URL with other users in your organization
- They can sign in with their Microsoft/O365 accounts
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

### Azure AD SSO not working

**Problem:** Clicking "Sign in with Microsoft" doesn't work or shows an error.

**Solution:**
1. **Check Redirect URIs**: Verify the redirect URI in Azure Portal matches your Supabase URL or Vercel URL exactly.
2. **Azure Tenant URL**: Ensure the "Azure Tenant URL" in Supabase is set to `https://login.microsoftonline.com/<your-tenant-id>`.
3. **Localhost vs 127.0.0.1**: Azure requires `localhost` for local development. Ensure you are not using `127.0.0.1`.
4. **Client Secret**: Verify the Client Secret Value (not ID) is correct and not expired.

### "Application is not configured as a multi-tenant application"

**Problem:** Error during sign-in about multi-tenant configuration.

**Solution:**
1. Ensure you have set the **Azure Tenant URL** in the Supabase Dashboard (Authentication → Providers → Azure). This tells Supabase to use your specific tenant instead of the common multi-tenant endpoint.

### Email not returned from Microsoft

**Problem:** User signs in but email is missing or account creation fails.

**Solution:**
1. Ensure the `email` scope is included in the authentication request (this is usually handled by the application's `signInWithOAuth` call).

### Users outside my organization can sign in

**Problem:** You want to restrict access to your organization only.

**Solution:**
1. Verify the app registration in Azure is set to **"Accounts in this organizational directory only"**.
2. Ensure the **Azure Tenant URL** is correctly configured in Supabase with your specific Tenant ID.

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
3. **Rotate Client Secrets** - Set reminders to update Azure secrets before they expire
4. **Regularly review user access** - Use the admin panel to audit users

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
- **Azure AD Docs**: [https://learn.microsoft.com/en-us/entra/identity/](https://learn.microsoft.com/en-us/entra/identity/)

---

## Summary Checklist

- [ ] Supabase project created
- [ ] Database migrations run successfully
- [ ] Azure App Registration created
- [ ] Application (client) ID and Tenant ID saved
- [ ] Client secret created and value saved
- [ ] Azure (Microsoft) provider enabled in Supabase
- [ ] Azure Tenant URL configured in Supabase
- [ ] Code pushed to GitHub
- [ ] Vercel project deployed
- [ ] Environment variables set in Vercel
- [ ] Azure AD redirect URIs updated (Supabase & Vercel)
- [ ] Application tested and working
- [ ] First user verified as admin

**Congratulations! Your Incucyte Analyzer is now deployed with Azure AD authentication and database features!**
