import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const AdminPanel = () => {
  const { user, profile } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserActive = async (userId, currentStatus) => {
    if (userId === user?.id) {
      alert('You cannot deactivate your own account');
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('id', userId);

      if (error) throw error;
      fetchUsers();
    } catch (err) {
      alert(`Error updating user: ${err.message}`);
    }
  };

  const changeUserRole = async (userId, newRole) => {
    if (userId === user?.id) {
      alert('You cannot change your own role');
      return;
    }

    // Check if this would remove the last admin
    if (newRole === 'user') {
      const adminCount = users.filter(u => u.role === 'admin').length;
      if (adminCount <= 1) {
        alert('Cannot remove the last admin. There must be at least one admin.');
        return;
      }
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;
      fetchUsers();
    } catch (err) {
      alert(`Error updating role: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', color: '#f1f5f9' }}>
        <p>Loading users...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px', color: '#ef4444' }}>
        <p>Error: {error}</p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      padding: '24px',
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: 'bold',
          color: '#f1f5f9',
          marginBottom: '24px',
        }}>
          User Management
        </h1>

        <div style={{
          background: 'rgba(30, 41, 59, 0.8)',
          borderRadius: '12px',
          border: '1px solid rgba(51, 65, 85, 0.5)',
          overflow: 'hidden',
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
          }}>
            <thead>
              <tr style={{
                background: 'rgba(15, 23, 42, 0.5)',
                borderBottom: '1px solid rgba(51, 65, 85, 0.5)',
              }}>
                <th style={{ padding: '16px', textAlign: 'left', color: '#94a3b8', fontWeight: '500' }}>Email</th>
                <th style={{ padding: '16px', textAlign: 'left', color: '#94a3b8', fontWeight: '500' }}>Display Name</th>
                <th style={{ padding: '16px', textAlign: 'left', color: '#94a3b8', fontWeight: '500' }}>Role</th>
                <th style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontWeight: '500' }}>Active</th>
                <th style={{ padding: '16px', textAlign: 'left', color: '#94a3b8', fontWeight: '500' }}>Joined</th>
                <th style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontWeight: '500' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{
                  borderBottom: '1px solid rgba(51, 65, 85, 0.3)',
                  background: u.id === user?.id ? 'rgba(8, 145, 178, 0.1)' : 'transparent',
                }}>
                  <td style={{ padding: '16px', color: '#f1f5f9' }}>
                    {u.email}
                    {u.id === user?.id && <span style={{ marginLeft: '8px', fontSize: '12px', color: '#0891b2' }}>(You)</span>}
                  </td>
                  <td style={{ padding: '16px', color: '#cbd5e1' }}>{u.display_name || '-'}</td>
                  <td style={{ padding: '16px' }}>
                    <select
                      value={u.role}
                      onChange={(e) => changeUserRole(u.id, e.target.value)}
                      disabled={u.id === user?.id}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid rgba(51, 65, 85, 0.5)',
                        background: u.id === user?.id ? 'rgba(51, 65, 85, 0.3)' : 'rgba(30, 41, 59, 0.8)',
                        color: u.role === 'admin' ? '#fbbf24' : '#94a3b8',
                        cursor: u.id === user?.id ? 'not-allowed' : 'pointer',
                        fontWeight: '500',
                      }}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td style={{ padding: '16px', textAlign: 'center' }}>
                    <button
                      onClick={() => toggleUserActive(u.id, u.is_active)}
                      disabled={u.id === user?.id}
                      style={{
                        padding: '6px 16px',
                        borderRadius: '6px',
                        border: 'none',
                        background: u.is_active ? '#10b981' : '#ef4444',
                        color: 'white',
                        cursor: u.id === user?.id ? 'not-allowed' : 'pointer',
                        fontWeight: '500',
                        opacity: u.id === user?.id ? 0.5 : 1,
                      }}
                    >
                      {u.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td style={{ padding: '16px', color: '#94a3b8', fontSize: '14px' }}>
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '16px', textAlign: 'center' }}>
                    <button
                      onClick={() => toggleUserActive(u.id, u.is_active)}
                      disabled={u.id === user?.id}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid rgba(51, 65, 85, 0.5)',
                        background: 'rgba(30, 41, 59, 0.8)',
                        color: '#94a3b8',
                        cursor: u.id === user?.id ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        opacity: u.id === user?.id ? 0.5 : 1,
                      }}
                    >
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{
          marginTop: '24px',
          padding: '16px',
          background: 'rgba(30, 41, 59, 0.5)',
          borderRadius: '8px',
          border: '1px solid rgba(51, 65, 85, 0.5)',
          color: '#94a3b8',
          fontSize: '14px',
        }}>
          <p><strong>Total Users:</strong> {users.length}</p>
          <p><strong>Active Users:</strong> {users.filter(u => u.is_active).length}</p>
          <p><strong>Admins:</strong> {users.filter(u => u.role === 'admin').length}</p>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
