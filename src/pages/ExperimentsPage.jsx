import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const ExperimentsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExperiments();
  }, []);

  const fetchExperiments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('experiments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExperiments(data || []);
    } catch (err) {
      console.error('Error fetching experiments:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteExperiment = async (id) => {
    if (!confirm('Are you sure you want to delete this experiment?')) return;

    try {
      const { error } = await supabase
        .from('experiments')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchExperiments();
    } catch (err) {
      alert(`Error deleting experiment: ${err.message}`);
    }
  };

  const loadExperiment = (exp) => {
    navigate('/analyzer', { state: { experiment: exp } });
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        padding: '24px',
        color: '#f1f5f9',
      }}>
        <p>Loading experiments...</p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      padding: '24px',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#f1f5f9' }}>
            My Experiments
          </h1>
          <button
            onClick={() => navigate('/analyzer')}
            style={{
              padding: '12px 24px',
              backgroundColor: '#0891b2',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            + New Experiment
          </button>
        </div>

        {experiments.length === 0 ? (
          <div style={{
            background: 'rgba(30, 41, 59, 0.8)',
            borderRadius: '12px',
            border: '1px solid rgba(51, 65, 85, 0.5)',
            padding: '48px',
            textAlign: 'center',
            color: '#94a3b8',
          }}>
            <p style={{ fontSize: '18px', marginBottom: '16px' }}>No experiments yet</p>
            <p>Create your first experiment to get started</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {experiments.map((exp) => (
              <div
                key={exp.id}
                style={{
                  background: 'rgba(30, 41, 59, 0.8)',
                  borderRadius: '12px',
                  border: '1px solid rgba(51, 65, 85, 0.5)',
                  padding: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = '#0891b2';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(51, 65, 85, 0.5)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#f1f5f9', marginBottom: '8px' }}>
                  {exp.name}
                </h3>
                <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '4px' }}>
                  {exp.file_name || 'No file'}
                </p>
                <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
                  {new Date(exp.created_at).toLocaleDateString()} at {new Date(exp.created_at).toLocaleTimeString()}
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => loadExperiment(exp)}
                    style={{
                      flex: 1,
                      padding: '8px 16px',
                      backgroundColor: '#0891b2',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                    }}
                  >
                    Load
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteExperiment(exp.id);
                    }}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: 'rgba(239, 68, 68, 0.2)',
                      color: '#ef4444',
                      border: '1px solid #ef4444',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExperimentsPage;
