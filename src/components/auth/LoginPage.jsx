import { supabase } from '../../lib/supabase';

const LoginPage = () => {
  const handleAzureSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'email',
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      console.error('Error signing in:', error.message);
      alert('Failed to sign in with Microsoft. Please try again.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    }}>
      <div style={{
        background: 'rgba(30, 41, 59, 0.8)',
        padding: '48px',
        borderRadius: '16px',
        border: '1px solid rgba(51, 65, 85, 0.5)',
        maxWidth: '400px',
        width: '100%',
        textAlign: 'center',
      }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: 'bold',
          color: '#f1f5f9',
          marginBottom: '8px',
        }}>
          Incucyte Analyzer
        </h1>
        <p style={{
          color: '#94a3b8',
          marginBottom: '8px',
        }}>
          Sign in to save and manage your experiments
        </p>
        <p style={{
          color: '#64748b',
          fontSize: '13px',
          marginBottom: '32px',
        }}>
          Use your organization email to sign in
        </p>

        <button
          onClick={handleAzureSignIn}
          style={{
            width: '100%',
            padding: '12px 24px',
            backgroundColor: '#0078d4',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            transition: 'background-color 0.2s',
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#106ebe'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#0078d4'}
        >
          <svg width="20" height="20" viewBox="0 0 21 21" fill="none">
            <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
            <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
            <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
          </svg>
          Sign in with Microsoft
        </button>

        <p style={{
          marginTop: '24px',
          color: '#64748b',
          fontSize: '14px',
        }}>
          First user automatically becomes admin
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
