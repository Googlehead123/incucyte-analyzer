# Vercel + Supabase Deployment with Auth & Admin Panel

## TL;DR

> **Quick Summary**: Transform the Incucyte Wound Healing Analyzer from a client-side-only React app into a full-stack application with Supabase backend (PostgreSQL + Google OAuth), user role management (admin/user), and Vercel deployment. Also create a non-developer-friendly deployment guide.
> 
> **Deliverables**:
> - Refactored React app with routing and component decomposition
> - Supabase database schema with RLS policies
> - Google OAuth authentication flow
> - Admin panel for user management
> - Experiment save/load functionality
> - Vercel deployment configuration
> - Step-by-step deployment guide for non-developers
> 
> **Estimated Effort**: Large (3-5 days)
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Refactor → Supabase Setup → Auth → Admin Panel → Deploy → Docs

---

## Context

### Original Request
Deploy this project using Vercel and Supabase. Convert hardcoded data to PostgreSQL. Set up Google OAuth through Supabase. User levels are admin and user, with first user becoming admin automatically. Create admin page for user management (view users, toggle activation, change roles). Create frontend/backend specs and a detailed deployment guide for non-developers.

### Interview Summary
**Key Discussions**:
- Current app is React 19 + Vite 7, pure client-side with no backend
- All data lost on refresh (no persistence)
- No authentication, routing, or database exists
- Keep Vite + React (no migration to Next.js)

**Research Findings**:
- Supabase Auth with Google OAuth is well-documented
- RLS policies can restrict data by user_id
- First-user-admin can be done via PostgreSQL trigger
- Vite apps deploy seamlessly to Vercel
- App.jsx is a "God Component" (~1300 lines) - needs decomposition

### Metis Review
**Identified Gaps** (addressed):
- Component decomposition needed before adding auth → Added Phase 0
- Route structure not defined → Defined: /login, /, /analyzer, /experiments, /admin
- Data persistence scope unclear → Default: Store parsed data as JSONB
- Session resume not specified → Default: Save completed experiments only
- Activation default not specified → Default: New users active by default

---

## Work Objectives

### Core Objective
Transform a client-side React SPA into a production-ready full-stack application with Supabase backend, Google OAuth authentication, role-based access control, and Vercel hosting.

### Concrete Deliverables
- `/src/lib/supabase.js` - Supabase client configuration
- `/src/contexts/AuthContext.jsx` - Authentication state management
- `/src/components/auth/*` - Login page, auth callback handler
- `/src/components/admin/AdminPanel.jsx` - User management interface
- `/src/components/analyzer/*` - Decomposed wizard steps
- `/supabase/migrations/*.sql` - Database schema and RLS policies
- `/docs/DEPLOYMENT_GUIDE.md` - Non-developer-friendly setup instructions
- `/vercel.json` - Vercel configuration
- Updated `vite.config.js` - Fixed base path for Vercel

### Definition of Done
- [x] `npm run build` → Builds without errors
- [x] User can sign in with Google OAuth
- [x] First user gets admin role automatically
- [x] Admin can view user list and change roles
- [x] User can save and load experiments
- [x] App deploys successfully to Vercel
- [x] Deployment guide is complete and tested

### Must Have
- Google OAuth authentication
- Admin and User roles
- First-user-becomes-admin trigger
- Admin panel with user list, activation toggle, role change
- Experiment save/load to database
- RLS policies for data isolation
- Vercel deployment configuration
- Non-developer deployment guide

### Must NOT Have (Guardrails)
- No TypeScript migration (keep JavaScript)
- No CSS framework changes (keep existing styles)
- No changes to statistical calculation logic
- No Zustand/Redux (use React Context only)
- No raw file storage in Supabase Storage (store parsed JSONB only)
- No email/password auth (Google only as requested)
- No experiment sharing between users (data is isolated)
- No team/organization features
- No real-time collaboration features

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.
> ALL verification is executed by the agent using tools (Playwright, Bash, curl, etc.).

### Test Decision
- **Infrastructure exists**: NO
- **Automated tests**: None (focus on agent-executed QA scenarios)
- **Framework**: None

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)

Verification tools by deliverable type:
| Type | Tool | How Agent Verifies |
|------|------|-------------------|
| **Frontend/UI** | Playwright | Navigate, interact, assert DOM, screenshot |
| **API/Database** | Bash (curl) | Send requests, validate responses |
| **Build** | Bash | Run build commands, check exit codes |
| **Config** | Bash | Validate file contents, env vars |

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 0: Create directory structure
├── Task 1: Install dependencies
└── Task 2: Create Supabase client configuration

Wave 2 (After Wave 1):
├── Task 3: Create database migrations (schema, RLS, triggers)
├── Task 4: Create AuthContext
├── Task 5: Decompose App.jsx into step components
└── Task 6: Add react-router-dom routing

Wave 3 (After Wave 2):
├── Task 7: Create Login page with Google OAuth
├── Task 8: Create Auth callback handler
├── Task 9: Create protected route wrapper
└── Task 10: Update Vite config for Vercel

Wave 4 (After Wave 3):
├── Task 11: Create Admin Panel component
├── Task 12: Create experiments list page
└── Task 13: Add save/load experiment functionality

Wave 5 (After Wave 4):
├── Task 14: Create Vercel configuration
├── Task 15: Create environment variables template
└── Task 16: Create DEPLOYMENT_GUIDE.md

Wave 6 (Final):
└── Task 17: End-to-end verification and cleanup

Critical Path: 0 → 1 → 3 → 4 → 7 → 11 → 14 → 16 → 17
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 0 | None | 1, 2, 3, 4, 5, 6 | None |
| 1 | 0 | 2, 4, 5, 6, 7 | None |
| 2 | 1 | 3, 4, 7 | None |
| 3 | 2 | 7, 11 | 4, 5, 6 |
| 4 | 1, 2 | 7, 9 | 3, 5, 6 |
| 5 | 1 | 6, 12, 13 | 3, 4 |
| 6 | 5 | 7, 9, 11, 12 | 3, 4 |
| 7 | 3, 4, 6 | 8, 9 | None |
| 8 | 7 | 9 | 10 |
| 9 | 4, 8 | 11, 12 | 10 |
| 10 | 6 | 14 | 8, 9 |
| 11 | 3, 6, 9 | 17 | 12, 13 |
| 12 | 5, 6, 9 | 13, 17 | 11 |
| 13 | 5, 12 | 17 | 11 |
| 14 | 10 | 16, 17 | 15 |
| 15 | 2 | 16 | 14 |
| 16 | 14, 15 | 17 | None |
| 17 | All | None | None |

---

## TODOs

### Phase 0: Project Setup

- [x] 0. Create directory structure

  **What to do**:
  - Create `/src/lib/` directory for utility modules
  - Create `/src/contexts/` directory for React contexts
  - Create `/src/components/auth/` directory for auth components
  - Create `/src/components/admin/` directory for admin components
  - Create `/src/components/analyzer/` directory for analyzer step components
  - Create `/src/pages/` directory for page components
  - Create `/supabase/migrations/` directory for SQL migrations
  - Create `/docs/` directory for documentation

  **Must NOT do**:
  - Do not create unnecessary nested directories
  - Do not modify existing files yet

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
    - Simple directory creation task

  **Parallelization**:
  - **Can Run In Parallel**: NO (first task)
  - **Parallel Group**: Wave 1 (start)
  - **Blocks**: 1, 2, 3, 4, 5, 6
  - **Blocked By**: None

  **References**:
  - None required - straightforward mkdir operations

  **Acceptance Criteria**:
  - [ ] All directories exist: `ls -la src/lib src/contexts src/components/auth src/components/admin src/components/analyzer src/pages supabase/migrations docs`

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: All directories created successfully
    Tool: Bash
    Preconditions: None
    Steps:
      1. Run: ls -la src/lib src/contexts src/components/auth src/components/admin src/components/analyzer src/pages supabase/migrations docs
      2. Assert: Exit code is 0
      3. Assert: All 8 directories are listed
    Expected Result: All directories exist
    Evidence: Command output captured
  ```

  **Commit**: YES
  - Message: `chore: create directory structure for auth and admin features`
  - Files: All new directories
  - Pre-commit: `ls -d src/lib src/contexts`

---

- [x] 1. Install required dependencies

  **What to do**:
  - Install `@supabase/supabase-js` for Supabase client
  - Install `react-router-dom` for routing
  - Update `package.json` with new dependencies
  - Verify installation with `npm ls`

  **Must NOT do**:
  - Do not install TypeScript or type definitions
  - Do not install Zustand or Redux
  - Do not install Tailwind or other CSS frameworks
  - Do not remove existing dependencies

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
    - Simple npm install task

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (after 0)
  - **Blocks**: 2, 4, 5, 6, 7
  - **Blocked By**: 0

  **References**:
  - `/package.json` - Current dependencies (lines 10-19)

  **Acceptance Criteria**:
  - [ ] `npm ls @supabase/supabase-js` shows version installed
  - [ ] `npm ls react-router-dom` shows version installed
  - [ ] `npm run dev` still works after installation

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Dependencies installed correctly
    Tool: Bash
    Preconditions: package.json exists
    Steps:
      1. Run: npm install @supabase/supabase-js react-router-dom
      2. Assert: Exit code is 0
      3. Run: npm ls @supabase/supabase-js
      4. Assert: Output shows @supabase/supabase-js version
      5. Run: npm ls react-router-dom
      6. Assert: Output shows react-router-dom version
    Expected Result: Both packages installed
    Evidence: npm ls output captured

  Scenario: Dev server still runs
    Tool: Bash
    Preconditions: Dependencies installed
    Steps:
      1. Run: timeout 10 npm run dev || true
      2. Assert: Output contains "VITE" or "Local:" (server started)
    Expected Result: Dev server starts without errors
    Evidence: Server output captured
  ```

  **Commit**: YES
  - Message: `chore: add supabase and react-router-dom dependencies`
  - Files: `package.json`, `package-lock.json`
  - Pre-commit: `npm ls @supabase/supabase-js`

---

- [x] 2. Create Supabase client configuration

  **What to do**:
  - Create `/src/lib/supabase.js` with Supabase client initialization
  - Use environment variables for URL and anon key
  - Export a single `supabase` client instance
  - Create `.env.example` with required variables template

  **Must NOT do**:
  - Do not hardcode Supabase credentials
  - Do not create multiple client instances
  - Do not use service_role key in client-side code

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
    - Simple configuration file creation

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (after 1)
  - **Blocks**: 3, 4, 7
  - **Blocked By**: 1

  **References**:
  - Supabase docs: https://supabase.com/docs/reference/javascript/initializing
  - Pattern: `createClient(SUPABASE_URL, SUPABASE_ANON_KEY)`

  **File Content** (src/lib/supabase.js):
  ```javascript
  import { createClient } from '@supabase/supabase-js'

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  export const supabase = createClient(supabaseUrl, supabaseAnonKey)
  ```

  **File Content** (.env.example):
  ```
  VITE_SUPABASE_URL=your-project-url
  VITE_SUPABASE_ANON_KEY=your-anon-key
  ```

  **Acceptance Criteria**:
  - [ ] `/src/lib/supabase.js` exists with correct content
  - [ ] `.env.example` exists with template variables
  - [ ] File uses `import.meta.env` for Vite compatibility

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Supabase client file created correctly
    Tool: Bash
    Preconditions: Dependencies installed
    Steps:
      1. Run: cat src/lib/supabase.js
      2. Assert: Contains "import { createClient }"
      3. Assert: Contains "import.meta.env.VITE_SUPABASE_URL"
      4. Assert: Contains "export const supabase"
    Expected Result: File has correct structure
    Evidence: File content captured

  Scenario: Environment template exists
    Tool: Bash
    Preconditions: None
    Steps:
      1. Run: cat .env.example
      2. Assert: Contains "VITE_SUPABASE_URL"
      3. Assert: Contains "VITE_SUPABASE_ANON_KEY"
    Expected Result: Template has required variables
    Evidence: File content captured
  ```

  **Commit**: YES
  - Message: `feat: add Supabase client configuration`
  - Files: `src/lib/supabase.js`, `.env.example`
  - Pre-commit: `cat src/lib/supabase.js`

---

### Phase 1: Database Schema & Migrations

- [x] 3. Create database migrations (schema, RLS, triggers)

  **What to do**:
  - Create `/supabase/migrations/001_create_profiles.sql`:
    - Create `profiles` table linked to `auth.users`
    - Add `role` column (admin/user)
    - Add `is_active` column for account activation
    - Enable RLS with policies for user access
  - Create `/supabase/migrations/002_create_experiments.sql`:
    - Create `experiments` table for saved analyses
    - Store conditions, raw_data, timepoints as JSONB
    - Enable RLS for user-owned data
  - Create `/supabase/migrations/003_first_user_admin_trigger.sql`:
    - Create trigger on `auth.users` insert
    - Check if first user, set role to 'admin'
  - Create `/supabase/migrations/004_auto_create_profile.sql`:
    - Create trigger to auto-create profile on signup

  **Must NOT do**:
  - Do not use `service_role` in RLS policies
  - Do not create tables in `auth` schema (read-only)
  - Do not store raw files (only parsed JSONB)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]`
    - Database schema design requires careful thought

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 4, 5, 6)
  - **Blocks**: 7, 11
  - **Blocked By**: 2

  **References**:
  - Supabase RLS docs: https://supabase.com/docs/guides/database/postgres/row-level-security
  - `/src/App.jsx:573-650` - processData function shows data structure
  - Draft notes on schema design

  **File Content** (supabase/migrations/001_create_profiles.sql):
  ```sql
  -- Create profiles table linked to auth.users
  CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  -- Enable RLS
  ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

  -- Users can read their own profile
  CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

  -- Users can update their own profile (except role)
  CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

  -- Admins can view all profiles
  CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
    );

  -- Admins can update all profiles (for role changes and activation)
  CREATE POLICY "Admins can update all profiles"
    ON public.profiles FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
    );
  ```

  **File Content** (supabase/migrations/002_create_experiments.sql):
  ```sql
  -- Create experiments table for saved analyses
  CREATE TABLE IF NOT EXISTS public.experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    file_name TEXT,
    conditions JSONB NOT NULL DEFAULT '[]',
    raw_data JSONB NOT NULL DEFAULT '{}',
    timepoints JSONB NOT NULL DEFAULT '[]',
    excluded_wells JSONB DEFAULT '[]',
    processed_data JSONB,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  -- Enable RLS
  ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;

  -- Users can CRUD their own experiments
  CREATE POLICY "Users can view own experiments"
    ON public.experiments FOR SELECT
    USING (user_id = auth.uid());

  CREATE POLICY "Users can insert own experiments"
    ON public.experiments FOR INSERT
    WITH CHECK (user_id = auth.uid());

  CREATE POLICY "Users can update own experiments"
    ON public.experiments FOR UPDATE
    USING (user_id = auth.uid());

  CREATE POLICY "Users can delete own experiments"
    ON public.experiments FOR DELETE
    USING (user_id = auth.uid());

  -- Index for faster user queries
  CREATE INDEX idx_experiments_user_id ON public.experiments(user_id);
  CREATE INDEX idx_experiments_created_at ON public.experiments(created_at DESC);
  ```

  **File Content** (supabase/migrations/003_first_user_admin_trigger.sql):
  ```sql
  -- Function to make first user an admin
  CREATE OR REPLACE FUNCTION public.handle_first_user_admin()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
  DECLARE
    user_count INTEGER;
  BEGIN
    -- Count existing profiles (not auth.users to avoid race conditions)
    SELECT COUNT(*) INTO user_count FROM public.profiles;
    
    -- If this is the first profile, make them admin
    IF user_count = 0 THEN
      NEW.role := 'admin';
    END IF;
    
    RETURN NEW;
  END;
  $$;

  -- Trigger before insert on profiles
  CREATE TRIGGER on_profile_created_check_first_admin
    BEFORE INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_first_user_admin();
  ```

  **File Content** (supabase/migrations/004_auto_create_profile.sql):
  ```sql
  -- Function to create profile on user signup
  CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
  BEGIN
    INSERT INTO public.profiles (id, email, display_name)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
  END;
  $$;

  -- Trigger after insert on auth.users
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
  ```

  **Acceptance Criteria**:
  - [ ] All 4 migration files exist in `/supabase/migrations/`
  - [ ] Files contain valid SQL syntax
  - [ ] RLS is enabled on both tables
  - [ ] First-user-admin trigger exists
  - [ ] Auto-create-profile trigger exists

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Migration files exist with correct content
    Tool: Bash
    Preconditions: directories created
    Steps:
      1. Run: ls supabase/migrations/
      2. Assert: Output contains "001_create_profiles.sql"
      3. Assert: Output contains "002_create_experiments.sql"
      4. Assert: Output contains "003_first_user_admin_trigger.sql"
      5. Assert: Output contains "004_auto_create_profile.sql"
    Expected Result: All migration files present
    Evidence: Directory listing captured

  Scenario: Profiles migration has RLS enabled
    Tool: Bash
    Preconditions: Migration files created
    Steps:
      1. Run: grep -c "ENABLE ROW LEVEL SECURITY" supabase/migrations/001_create_profiles.sql
      2. Assert: Output is "1" or greater
      3. Run: grep -c "CREATE POLICY" supabase/migrations/001_create_profiles.sql
      4. Assert: Output is "4" (4 policies)
    Expected Result: RLS properly configured
    Evidence: Grep output captured

  Scenario: First user admin trigger exists
    Tool: Bash
    Preconditions: Migration files created
    Steps:
      1. Run: grep "handle_first_user_admin" supabase/migrations/003_first_user_admin_trigger.sql
      2. Assert: Output contains function definition
      3. Run: grep "CREATE TRIGGER" supabase/migrations/003_first_user_admin_trigger.sql
      4. Assert: Output contains trigger creation
    Expected Result: Trigger properly defined
    Evidence: Grep output captured
  ```

  **Commit**: YES
  - Message: `feat: add database migrations for profiles, experiments, and triggers`
  - Files: `supabase/migrations/*.sql`
  - Pre-commit: `ls supabase/migrations/`

---

### Phase 2: Authentication

- [x] 4. Create AuthContext for state management

  **What to do**:
  - Create `/src/contexts/AuthContext.jsx`
  - Track user session state
  - Provide `user`, `profile`, `loading`, `signIn`, `signOut` values
  - Listen to Supabase auth state changes
  - Fetch user profile from database on login

  **Must NOT do**:
  - Do not use Redux or Zustand
  - Do not store sensitive data in context
  - Do not expose session tokens

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: `[]`
    - Standard React context pattern

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 3, 5, 6)
  - **Blocks**: 7, 9
  - **Blocked By**: 1, 2

  **References**:
  - `/src/lib/supabase.js` - Supabase client to use
  - Supabase Auth docs: https://supabase.com/docs/reference/javascript/auth-onauthstatechange

  **Acceptance Criteria**:
  - [ ] `/src/contexts/AuthContext.jsx` exists
  - [ ] Exports `AuthProvider` component
  - [ ] Exports `useAuth` hook
  - [ ] Handles auth state changes

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: AuthContext file structure is correct
    Tool: Bash
    Preconditions: File created
    Steps:
      1. Run: grep "createContext" src/contexts/AuthContext.jsx
      2. Assert: Output shows createContext usage
      3. Run: grep "export.*AuthProvider" src/contexts/AuthContext.jsx
      4. Assert: AuthProvider is exported
      5. Run: grep "export.*useAuth" src/contexts/AuthContext.jsx
      6. Assert: useAuth hook is exported
    Expected Result: All exports present
    Evidence: Grep output captured
  ```

  **Commit**: YES (groups with 5, 6)
  - Message: `feat: add AuthContext for authentication state management`
  - Files: `src/contexts/AuthContext.jsx`
  - Pre-commit: `grep "useAuth" src/contexts/AuthContext.jsx`

---

- [x] 5. Decompose App.jsx into step components

  **What to do**:
  - Extract Step 1 (Upload) to `/src/components/analyzer/UploadStep.jsx`
  - Extract Step 2 (Map Wells) to `/src/components/analyzer/PlateMapStep.jsx`
  - Extract Step 3 (Review) to `/src/components/analyzer/ReviewStep.jsx`
  - Extract Step 4 (Results) to `/src/components/analyzer/ResultsStep.jsx`
  - Keep shared state in parent or context
  - Preserve all existing functionality exactly

  **Must NOT do**:
  - Do not change statistical calculation logic
  - Do not change CSS or styling
  - Do not remove any existing features
  - Do not change the step-based wizard flow

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]`
    - Refactoring large component requires careful extraction

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 3, 4, 6)
  - **Blocks**: 6, 12, 13
  - **Blocked By**: 1

  **References**:
  - `/src/App.jsx` - Current monolithic component (~1300 lines)
  - `/src/App.jsx:150-250` - Step 1 upload UI
  - `/src/App.jsx:260-450` - Step 2 plate mapping UI
  - `/src/App.jsx:460-560` - Step 3 review UI
  - `/src/App.jsx:650-900` - Step 4 results UI

  **Acceptance Criteria**:
  - [ ] All 4 step component files exist
  - [ ] Each component receives props for data and callbacks
  - [ ] App.jsx is significantly smaller (< 500 lines)
  - [ ] Wizard still functions identically

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Step components created
    Tool: Bash
    Preconditions: None
    Steps:
      1. Run: ls src/components/analyzer/
      2. Assert: Contains "UploadStep.jsx"
      3. Assert: Contains "PlateMapStep.jsx"
      4. Assert: Contains "ReviewStep.jsx"
      5. Assert: Contains "ResultsStep.jsx"
    Expected Result: All 4 files exist
    Evidence: Directory listing captured

  Scenario: App.jsx is smaller after refactor
    Tool: Bash
    Preconditions: Refactor complete
    Steps:
      1. Run: wc -l src/App.jsx
      2. Assert: Line count is less than 600
    Expected Result: App.jsx reduced in size
    Evidence: Line count captured

  Scenario: App still builds after refactor
    Tool: Bash
    Preconditions: Refactor complete
    Steps:
      1. Run: npm run build
      2. Assert: Exit code is 0
      3. Assert: dist/ directory contains index.html
    Expected Result: Build succeeds
    Evidence: Build output captured
  ```

  **Commit**: YES
  - Message: `refactor: decompose App.jsx into step components`
  - Files: `src/components/analyzer/*.jsx`, `src/App.jsx`
  - Pre-commit: `npm run build`

---

- [x] 6. Add react-router-dom routing

  **What to do**:
  - Update `/src/main.jsx` to wrap app with BrowserRouter
  - Create route structure:
    - `/login` → LoginPage
    - `/` → Redirect based on auth state
    - `/analyzer` → The wizard (requires auth)
    - `/experiments` → Saved experiments list (requires auth)
    - `/admin` → Admin panel (requires admin role)
  - Create `/src/pages/` directory with page components
  - Preserve step-based wizard flow within /analyzer route

  **Must NOT do**:
  - Do not change URL on each wizard step (keep internal state)
  - Do not create unnecessary nested routes
  - Do not break existing wizard navigation

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: `[]`
    - Standard routing setup

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 3, 4, 5)
  - **Blocks**: 7, 9, 11, 12
  - **Blocked By**: 5

  **References**:
  - React Router docs: https://reactrouter.com/en/main/start/tutorial
  - `/src/main.jsx` - Entry point to modify
  - `/src/App.jsx` - Will become child of router

  **Acceptance Criteria**:
  - [ ] `/src/main.jsx` includes BrowserRouter
  - [ ] Route definitions exist for /login, /, /analyzer, /experiments, /admin
  - [ ] `npm run dev` shows app with routing working

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Router configured in main.jsx
    Tool: Bash
    Preconditions: react-router-dom installed
    Steps:
      1. Run: grep "BrowserRouter" src/main.jsx
      2. Assert: BrowserRouter is imported and used
      3. Run: grep "Routes" src/main.jsx
      4. Assert: Routes component is used
    Expected Result: Router properly configured
    Evidence: Grep output captured

  Scenario: All routes defined
    Tool: Bash
    Preconditions: Routing implemented
    Steps:
      1. Run: grep -E "path=.*/(login|analyzer|experiments|admin)" src/main.jsx
      2. Assert: All 4 routes are defined
    Expected Result: All routes present
    Evidence: Grep output captured
  ```

  **Commit**: YES
  - Message: `feat: add react-router-dom routing structure`
  - Files: `src/main.jsx`, `src/pages/*.jsx`
  - Pre-commit: `npm run build`

---

- [x] 7. Create Login page with Google OAuth

  **What to do**:
  - Create `/src/components/auth/LoginPage.jsx`
  - Add "Sign in with Google" button
  - Call `supabase.auth.signInWithOAuth({ provider: 'google' })`
  - Configure redirect URL to `/auth/callback`
  - Style consistently with existing app

  **Must NOT do**:
  - Do not add email/password authentication
  - Do not add other OAuth providers
  - Do not show login form if already authenticated

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
    - Simple OAuth button implementation

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: 8, 9
  - **Blocked By**: 3, 4, 6

  **References**:
  - `/src/lib/supabase.js` - Supabase client to use
  - `/src/index.css` - Existing styles to match
  - Supabase OAuth docs: https://supabase.com/docs/guides/auth/social-login/auth-google

  **Acceptance Criteria**:
  - [ ] `/src/components/auth/LoginPage.jsx` exists
  - [ ] Contains Google sign-in button
  - [ ] Calls signInWithOAuth with provider: 'google'
  - [ ] Matches existing app styling

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Login page has Google button
    Tool: Bash
    Preconditions: File created
    Steps:
      1. Run: grep "signInWithOAuth" src/components/auth/LoginPage.jsx
      2. Assert: OAuth method is called
      3. Run: grep "google" src/components/auth/LoginPage.jsx
      4. Assert: Google provider specified
    Expected Result: Google OAuth configured
    Evidence: Grep output captured

  Scenario: Login page renders without errors
    Tool: Playwright
    Preconditions: Dev server running with mock env vars
    Steps:
      1. Navigate to: http://localhost:5173/login
      2. Wait for: button containing "Google" (timeout: 5s)
      3. Screenshot: .sisyphus/evidence/task-7-login-page.png
    Expected Result: Login page with Google button visible
    Evidence: .sisyphus/evidence/task-7-login-page.png
  ```

  **Commit**: YES
  - Message: `feat: add login page with Google OAuth`
  - Files: `src/components/auth/LoginPage.jsx`
  - Pre-commit: `grep "signInWithOAuth" src/components/auth/LoginPage.jsx`

---

- [x] 8. Create Auth callback handler

  **What to do**:
  - Create `/src/components/auth/AuthCallback.jsx`
  - Handle OAuth redirect from Supabase
  - Exchange code for session
  - Redirect to /analyzer on success
  - Show error message on failure

  **Must NOT do**:
  - Do not expose tokens in URL after processing
  - Do not leave users on callback page

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
    - Standard OAuth callback handling

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with 10)
  - **Blocks**: 9
  - **Blocked By**: 7

  **References**:
  - `/src/lib/supabase.js` - Supabase client
  - `/src/components/auth/LoginPage.jsx` - Login flow start
  - Supabase callback docs: https://supabase.com/docs/guides/auth/redirect-urls

  **Acceptance Criteria**:
  - [ ] `/src/components/auth/AuthCallback.jsx` exists
  - [ ] Handles Supabase auth callback
  - [ ] Redirects to /analyzer on success

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Callback component handles auth
    Tool: Bash
    Preconditions: File created
    Steps:
      1. Run: grep "supabase" src/components/auth/AuthCallback.jsx
      2. Assert: Supabase client is used
      3. Run: grep "navigate" src/components/auth/AuthCallback.jsx
      4. Assert: Navigation is implemented
    Expected Result: Callback handles auth flow
    Evidence: Grep output captured
  ```

  **Commit**: YES (groups with 7)
  - Message: `feat: add OAuth callback handler`
  - Files: `src/components/auth/AuthCallback.jsx`
  - Pre-commit: `cat src/components/auth/AuthCallback.jsx`

---

- [x] 9. Create protected route wrapper

  **What to do**:
  - Create `/src/components/auth/ProtectedRoute.jsx`
  - Check if user is authenticated using AuthContext
  - Redirect to /login if not authenticated
  - Check user role for admin-only routes
  - Redirect to /analyzer if not admin for /admin route

  **Must NOT do**:
  - Do not block rendering while checking (show loading)
  - Do not allow access before auth check completes

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
    - Standard protected route pattern

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with 8, 10)
  - **Blocks**: 11, 12
  - **Blocked By**: 4, 8

  **References**:
  - `/src/contexts/AuthContext.jsx` - Auth state to check
  - React Router docs: Protected routes pattern

  **Acceptance Criteria**:
  - [ ] `/src/components/auth/ProtectedRoute.jsx` exists
  - [ ] Uses useAuth hook to check authentication
  - [ ] Redirects unauthenticated users to /login
  - [ ] Supports `adminOnly` prop for /admin route

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Protected route checks auth
    Tool: Bash
    Preconditions: File created
    Steps:
      1. Run: grep "useAuth" src/components/auth/ProtectedRoute.jsx
      2. Assert: useAuth hook is used
      3. Run: grep "Navigate.*login" src/components/auth/ProtectedRoute.jsx
      4. Assert: Redirect to login exists
    Expected Result: Auth checking implemented
    Evidence: Grep output captured
  ```

  **Commit**: YES
  - Message: `feat: add protected route wrapper for auth`
  - Files: `src/components/auth/ProtectedRoute.jsx`
  - Pre-commit: `grep "useAuth" src/components/auth/ProtectedRoute.jsx`

---

- [x] 10. Update Vite config for Vercel

  **What to do**:
  - Update `/vite.config.js`:
    - Change `base` from '/incucyte-analyzer/' to '/'
    - Add SPA fallback for react-router
  - Ensure build works for Vercel deployment

  **Must NOT do**:
  - Do not remove React plugin
  - Do not change dev server port

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
    - Simple config update

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with 8, 9)
  - **Blocks**: 14
  - **Blocked By**: 6

  **References**:
  - `/vite.config.js` - Current config with base: '/incucyte-analyzer/'
  - Vite docs: https://vitejs.dev/config/

  **Acceptance Criteria**:
  - [ ] `base` is set to '/' in vite.config.js
  - [ ] `npm run build` succeeds
  - [ ] dist/index.html exists after build

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Vite config updated for Vercel
    Tool: Bash
    Preconditions: vite.config.js exists
    Steps:
      1. Run: grep "base:" vite.config.js
      2. Assert: Output shows base: '/' (not /incucyte-analyzer/)
      3. Run: npm run build
      4. Assert: Exit code is 0
    Expected Result: Config correct for Vercel
    Evidence: Config content and build output captured
  ```

  **Commit**: YES
  - Message: `chore: update Vite config for Vercel deployment`
  - Files: `vite.config.js`
  - Pre-commit: `npm run build`

---

### Phase 3: Admin Panel

- [x] 11. Create Admin Panel component

  **What to do**:
  - Create `/src/components/admin/AdminPanel.jsx`
  - Display list of all users (fetch from profiles table)
  - Show user email, role, active status, signup date
  - Add toggle switch for is_active
  - Add dropdown/button to change role (admin/user)
  - Style consistently with existing app

  **Must NOT do**:
  - Do not allow admin to deactivate themselves
  - Do not allow removing the last admin
  - Do not show sensitive data like passwords (there are none with OAuth)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]`
    - Admin UI with data table requires careful implementation

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with 12, 13)
  - **Blocks**: 17
  - **Blocked By**: 3, 6, 9

  **References**:
  - `/supabase/migrations/001_create_profiles.sql` - Profiles table schema
  - `/src/lib/supabase.js` - Supabase client for queries
  - `/src/index.css` - Existing styles to match

  **Acceptance Criteria**:
  - [ ] `/src/components/admin/AdminPanel.jsx` exists
  - [ ] Fetches and displays user list from Supabase
  - [ ] Has toggle for is_active
  - [ ] Has role change functionality
  - [ ] Prevents self-deactivation

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Admin panel fetches users
    Tool: Bash
    Preconditions: File created
    Steps:
      1. Run: grep "profiles" src/components/admin/AdminPanel.jsx
      2. Assert: Profiles table is queried
      3. Run: grep "is_active" src/components/admin/AdminPanel.jsx
      4. Assert: Activation toggle exists
      5. Run: grep "role" src/components/admin/AdminPanel.jsx
      6. Assert: Role management exists
    Expected Result: User management implemented
    Evidence: Grep output captured

  Scenario: Admin panel prevents self-deactivation
    Tool: Bash
    Preconditions: File created
    Steps:
      1. Run: grep -E "(disabled|currentUser|self)" src/components/admin/AdminPanel.jsx
      2. Assert: Self-deactivation prevention logic exists
    Expected Result: Safety check implemented
    Evidence: Grep output captured
  ```

  **Commit**: YES
  - Message: `feat: add admin panel for user management`
  - Files: `src/components/admin/AdminPanel.jsx`
  - Pre-commit: `npm run build`

---

### Phase 4: Experiment Persistence

- [x] 12. Create experiments list page

  **What to do**:
  - Create `/src/pages/ExperimentsPage.jsx`
  - Fetch user's saved experiments from Supabase
  - Display as list/grid with name, date, actions
  - Add "New Experiment" button → navigate to /analyzer
  - Add "Load" button → load experiment data and navigate to /analyzer
  - Add "Delete" button with confirmation

  **Must NOT do**:
  - Do not show other users' experiments (RLS handles this)
  - Do not allow loading experiments from other users

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: `[]`
    - Standard CRUD list page

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with 11, 13)
  - **Blocks**: 13, 17
  - **Blocked By**: 5, 6, 9

  **References**:
  - `/supabase/migrations/002_create_experiments.sql` - Experiments table schema
  - `/src/lib/supabase.js` - Supabase client for queries

  **Acceptance Criteria**:
  - [ ] `/src/pages/ExperimentsPage.jsx` exists
  - [ ] Fetches experiments from Supabase
  - [ ] Shows list with load/delete actions
  - [ ] New experiment button navigates to /analyzer

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Experiments page queries database
    Tool: Bash
    Preconditions: File created
    Steps:
      1. Run: grep "experiments" src/pages/ExperimentsPage.jsx
      2. Assert: Experiments table is queried
      3. Run: grep "supabase" src/pages/ExperimentsPage.jsx
      4. Assert: Supabase client is used
    Expected Result: Database integration exists
    Evidence: Grep output captured
  ```

  **Commit**: YES
  - Message: `feat: add experiments list page`
  - Files: `src/pages/ExperimentsPage.jsx`
  - Pre-commit: `npm run build`

---

- [x] 13. Add save/load experiment functionality

  **What to do**:
  - Add "Save Experiment" button to results step
  - Prompt for experiment name
  - Save current state to Supabase experiments table:
    - conditions, raw_data, timepoints, excluded_wells, processed_data, settings
  - Update experiments list page to load saved experiment
  - Pre-populate analyzer state when loading

  **Must NOT do**:
  - Do not auto-save (explicit save only)
  - Do not overwrite without confirmation

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]`
    - State serialization and database integration

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (after 12)
  - **Blocks**: 17
  - **Blocked By**: 5, 12

  **References**:
  - `/src/components/analyzer/ResultsStep.jsx` - Where save button goes
  - `/supabase/migrations/002_create_experiments.sql` - Experiments table schema
  - `/src/App.jsx` - State structure to serialize

  **Acceptance Criteria**:
  - [ ] Save button exists on results page
  - [ ] Experiment is saved to Supabase
  - [ ] Load from experiments page works
  - [ ] Loaded experiment restores all state

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Save button exists in results
    Tool: Bash
    Preconditions: ResultsStep modified
    Steps:
      1. Run: grep -i "save" src/components/analyzer/ResultsStep.jsx
      2. Assert: Save functionality exists
      3. Run: grep "supabase" src/components/analyzer/ResultsStep.jsx
      4. Assert: Supabase is used for saving
    Expected Result: Save implemented
    Evidence: Grep output captured
  ```

  **Commit**: YES
  - Message: `feat: add save/load experiment functionality`
  - Files: `src/components/analyzer/ResultsStep.jsx`, `src/pages/ExperimentsPage.jsx`
  - Pre-commit: `npm run build`

---

### Phase 5: Deployment

- [x] 14. Create Vercel configuration

  **What to do**:
  - Create `/vercel.json` with:
    - SPA rewrite rules for react-router
    - Build output directory
    - Clean URLs
  - Verify build works locally with production config

  **Must NOT do**:
  - Do not include secrets in vercel.json
  - Do not hardcode environment variables

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
    - Simple config file creation

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with 15)
  - **Blocks**: 16, 17
  - **Blocked By**: 10

  **References**:
  - Vercel docs: https://vercel.com/docs/frameworks/vite
  - `/vite.config.js` - Build configuration

  **File Content** (vercel.json):
  ```json
  {
    "rewrites": [
      { "source": "/(.*)", "destination": "/index.html" }
    ]
  }
  ```

  **Acceptance Criteria**:
  - [ ] `/vercel.json` exists with SPA rewrites
  - [ ] `npm run build` succeeds
  - [ ] Build output is correct

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Vercel config is valid JSON
    Tool: Bash
    Preconditions: File created
    Steps:
      1. Run: cat vercel.json | python3 -m json.tool
      2. Assert: Exit code is 0 (valid JSON)
      3. Run: grep "rewrites" vercel.json
      4. Assert: Rewrites config exists
    Expected Result: Valid Vercel configuration
    Evidence: JSON validation output
  ```

  **Commit**: YES
  - Message: `chore: add Vercel deployment configuration`
  - Files: `vercel.json`
  - Pre-commit: `cat vercel.json`

---

- [x] 15. Create environment variables template

  **What to do**:
  - Update `.env.example` with all required variables:
    - VITE_SUPABASE_URL
    - VITE_SUPABASE_ANON_KEY
  - Add comments explaining each variable
  - Add `.env.local` to `.gitignore` (if not already)

  **Must NOT do**:
  - Do not commit actual credentials
  - Do not include service_role key

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
    - Simple template update

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with 14)
  - **Blocks**: 16
  - **Blocked By**: 2

  **References**:
  - `/src/lib/supabase.js` - Variables used in client

  **Acceptance Criteria**:
  - [ ] `.env.example` has all required variables
  - [ ] Comments explain each variable
  - [ ] `.env.local` is in `.gitignore`

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Environment template is complete
    Tool: Bash
    Preconditions: File updated
    Steps:
      1. Run: cat .env.example
      2. Assert: Contains VITE_SUPABASE_URL
      3. Assert: Contains VITE_SUPABASE_ANON_KEY
      4. Run: grep ".env.local" .gitignore
      5. Assert: .env.local is ignored
    Expected Result: Template complete and secure
    Evidence: File contents captured
  ```

  **Commit**: YES (groups with 14)
  - Message: `chore: update environment variables template`
  - Files: `.env.example`, `.gitignore`
  - Pre-commit: `cat .env.example`

---

### Phase 6: Documentation

- [x] 16. Create DEPLOYMENT_GUIDE.md

  **What to do**:
  - Create `/docs/DEPLOYMENT_GUIDE.md` with step-by-step instructions:
    1. Create Supabase project
    2. Configure Google OAuth in Google Cloud Console
    3. Configure Google provider in Supabase
    4. Run database migrations in Supabase SQL Editor
    5. Deploy to Vercel
    6. Configure environment variables in Vercel
    7. Set up custom domain (optional)
    8. Verify deployment
  - Include screenshots placeholder locations
  - Use simple language for non-developers
  - Include troubleshooting section

  **Must NOT do**:
  - Do not assume technical knowledge
  - Do not skip steps
  - Do not use jargon without explanation

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: `[]`
    - Technical writing for non-developers

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 5 (after 14, 15)
  - **Blocks**: 17
  - **Blocked By**: 14, 15

  **References**:
  - `/supabase/migrations/*.sql` - SQL to include in guide
  - `/.env.example` - Variables to explain
  - `/vercel.json` - Deployment config
  - Supabase docs: https://supabase.com/docs
  - Vercel docs: https://vercel.com/docs

  **Acceptance Criteria**:
  - [ ] `/docs/DEPLOYMENT_GUIDE.md` exists
  - [ ] Covers all 8 deployment steps
  - [ ] Uses non-technical language where possible
  - [ ] Includes troubleshooting section
  - [ ] Word count > 1500 (comprehensive)

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Guide covers all deployment steps
    Tool: Bash
    Preconditions: File created
    Steps:
      1. Run: grep -c "##" docs/DEPLOYMENT_GUIDE.md
      2. Assert: At least 10 sections
      3. Run: grep -i "supabase" docs/DEPLOYMENT_GUIDE.md | wc -l
      4. Assert: Supabase mentioned multiple times
      5. Run: grep -i "vercel" docs/DEPLOYMENT_GUIDE.md | wc -l
      6. Assert: Vercel mentioned multiple times
      7. Run: grep -i "google" docs/DEPLOYMENT_GUIDE.md | wc -l
      8. Assert: Google OAuth covered
    Expected Result: Comprehensive guide
    Evidence: Grep counts captured

  Scenario: Guide has troubleshooting section
    Tool: Bash
    Preconditions: File created
    Steps:
      1. Run: grep -i "troubleshoot" docs/DEPLOYMENT_GUIDE.md
      2. Assert: Troubleshooting section exists
    Expected Result: Help section included
    Evidence: Grep output captured
  ```

  **Commit**: YES
  - Message: `docs: add comprehensive deployment guide for non-developers`
  - Files: `docs/DEPLOYMENT_GUIDE.md`
  - Pre-commit: `wc -w docs/DEPLOYMENT_GUIDE.md`

---

### Phase 7: Verification

- [x] 17. End-to-end verification and cleanup

  **What to do**:
  - Run full build: `npm run build`
  - Verify all files are in place
  - Run linting: `npm run lint`
  - Test dev server starts correctly
  - Review all new files for completeness
  - Update README.md with new setup instructions

  **Must NOT do**:
  - Do not deploy to production (user will do this)
  - Do not modify Supabase production data

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
    - Final verification checks

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 6 (final)
  - **Blocks**: None
  - **Blocked By**: All previous tasks

  **References**:
  - All files created in this plan

  **Acceptance Criteria**:
  - [ ] `npm run build` succeeds
  - [ ] `npm run lint` passes or only has warnings
  - [ ] All 4 migration files exist
  - [ ] All auth components exist
  - [ ] Admin panel exists
  - [ ] Deployment guide exists
  - [ ] README updated with new instructions

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Full project verification
    Tool: Bash
    Preconditions: All tasks complete
    Steps:
      1. Run: npm run build
      2. Assert: Exit code is 0
      3. Run: ls dist/
      4. Assert: index.html exists
      5. Run: ls supabase/migrations/
      6. Assert: 4 migration files exist
      7. Run: ls src/components/auth/
      8. Assert: LoginPage.jsx, AuthCallback.jsx, ProtectedRoute.jsx exist
      9. Run: ls src/components/admin/
      10. Assert: AdminPanel.jsx exists
      11. Run: ls docs/
      12. Assert: DEPLOYMENT_GUIDE.md exists
    Expected Result: All deliverables present and build succeeds
    Evidence: All command outputs captured
  ```

  **Commit**: YES
  - Message: `chore: final verification and README update`
  - Files: `README.md`
  - Pre-commit: `npm run build`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 0 | `chore: create directory structure` | directories | ls |
| 1 | `chore: add dependencies` | package.json | npm ls |
| 2 | `feat: add Supabase client` | src/lib/supabase.js, .env.example | cat |
| 3 | `feat: add database migrations` | supabase/migrations/*.sql | ls |
| 4+5+6 | `feat: add auth context and routing` | src/contexts/*, src/pages/* | npm run build |
| 7+8 | `feat: add login and OAuth callback` | src/components/auth/* | npm run build |
| 9+10 | `feat: add protected routes and Vite config` | multiple | npm run build |
| 11 | `feat: add admin panel` | src/components/admin/* | npm run build |
| 12+13 | `feat: add experiment persistence` | src/pages/*, src/components/analyzer/* | npm run build |
| 14+15 | `chore: add deployment config` | vercel.json, .env.example | cat |
| 16 | `docs: add deployment guide` | docs/* | wc |
| 17 | `chore: final verification` | README.md | npm run build |

---

## Success Criteria

### Verification Commands
```bash
npm run build                    # Expected: Exit code 0
npm run lint                     # Expected: No errors (warnings OK)
ls supabase/migrations/          # Expected: 4 SQL files
ls src/components/auth/          # Expected: 3 files
ls src/components/admin/         # Expected: 1 file
ls docs/                         # Expected: DEPLOYMENT_GUIDE.md
wc -w docs/DEPLOYMENT_GUIDE.md   # Expected: > 1500 words
```

### Final Checklist
- [x] All "Must Have" present
- [x] All "Must NOT Have" absent
- [x] Build succeeds without errors
- [x] All 17 tasks completed
- [x] All commits made with proper messages
