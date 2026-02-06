# Incucyte Wound Healing Analyzer

A web-based application for analyzing wound healing experiments using Incucyte live-cell imaging data. This tool provides statistical analysis, visualization, and data persistence for wound healing assays.

## Features

- **Wound Healing Analysis**: Upload Incucyte CSV data and perform automated statistical analysis
- **Google OAuth Authentication**: Secure login via Google OAuth through Supabase
- **User Role Management**: First user becomes admin automatically; admins can manage user roles
- **Experiment Persistence**: Save and retrieve experiments from PostgreSQL database
- **Admin Panel**: User management interface for administrators
- **Data Visualization**: Interactive charts and statistical summaries using Recharts
- **Export Capabilities**: Download analyzed data as CSV or PNG charts

## Tech Stack

- **Frontend**: React 19 + Vite 7 (SPA)
- **Backend**: Supabase (PostgreSQL + Auth)
- **Routing**: react-router-dom
- **Visualization**: Recharts
- **Styling**: CSS-in-JS with theme support

## Prerequisites

- Node.js 20.19+ or 22.12+
- npm or yarn
- Supabase account (free tier available)
- Vercel account (for deployment)

## Local Development Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd incucyte-analyzer
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
3. Fill in your Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

### 4. Set Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services** → **Credentials**
2. Create an OAuth 2.0 Client ID (Web application)
3. Add authorized redirect URIs:
   - Local: `http://localhost:5173/auth/callback`
   - Production: `https://your-domain.com/auth/callback`
4. In Supabase Dashboard → **Authentication** → **Providers**, enable **Google**
5. Paste your Client ID and Client Secret

### 5. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build locally

## Project Structure

```
src/
├── components/
│   ├── auth/              # Authentication components
│   │   ├── LoginPage.jsx
│   │   ├── AuthCallback.jsx
│   │   └── ProtectedRoute.jsx
│   ├── admin/             # Admin panel
│   │   └── AdminPanel.jsx
│   └── analyzer/          # Analysis workflow components
│       ├── UploadStep.jsx
│       ├── PlateMapStep.jsx
│       ├── ReviewStep.jsx
│       └── ResultsStep.jsx
├── contexts/
│   ├── AuthContext.jsx    # Auth provider
│   └── useAuth.js         # Auth hook
├── lib/
│   └── supabase.js        # Supabase client
├── pages/
│   └── ExperimentsPage.jsx # Saved experiments
├── App.jsx                # Main analyzer app
└── main.jsx               # Entry point
```

## Database Schema

The application uses PostgreSQL with the following tables:

- **profiles**: User profiles with role management
- **experiments**: Saved experiment data and results

See `supabase/migrations/` for complete schema definitions.

## Deployment

For complete deployment instructions including Vercel setup, environment variables, and production configuration, see [DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md).

### Quick Deployment Steps

1. Push code to GitHub
2. Connect repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

## Environment Variables

Required environment variables:

- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key

These should be set in:
- `.env.local` for local development
- Vercel dashboard for production

## Authentication Flow

1. User clicks "Sign in with Google"
2. Redirected to Google OAuth consent screen
3. After approval, redirected to `/auth/callback`
4. User profile created automatically in PostgreSQL
5. First user is automatically assigned admin role
6. User redirected to main analyzer

## Support

For issues or questions, please refer to the [DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) for troubleshooting and additional information.

---

## React + Vite Template Information

This project is built on a React + Vite template. For more information about the template setup:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

### React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

### Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
