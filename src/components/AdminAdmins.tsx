import { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, Eye, EyeOff, CheckCircle, XCircle, AlertCircle, Pencil, X } from 'lucide-react';

interface Admin {
  id: string;
  email: string;
  name: string | null;
  is_active: boolean;
  created_at: string;
}

interface Props {
  adminToken: string;
  currentEmail: string;
}

export default function AdminAdmins({ adminToken, currentEmail }: Props) {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPwd, setShowEditPwd] = useState(false);
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  const auth = { headers: { Authorization: `Bearer ${adminToken}` } };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/admins', auth);
      if (res.ok) setAdmins(await res.json());
      else setError('Failed to load admins.');
    } catch { setError('Network error.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newEmail.trim() || !newPassword) return;
    setCreateError(''); setCreating(true);
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST', headers: { ...auth.headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail.trim(), password: newPassword, name: newName.trim() || undefined })
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error || 'Failed to create admin.'); return; }
      setAdmins(prev => [...prev, data]);
      setNewEmail(''); setNewName(''); setNewPassword(''); setShowCreate(false);
    } catch { setCreateError('Network error.'); }
    finally { setCreating(false); }
  };

  const handleToggleActive = async (admin: Admin) => {
    const res = await fetch(`/api/admin/admins/${admin.id}`, {
      method: 'PATCH', headers: { ...auth.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !admin.is_active })
    });
    if (res.ok) { const d = await res.json(); setAdmins(prev => prev.map(a => a.id === d.id ? d : a)); }
  };

  const handleSaveEdit = async () => {
    if (!editId) return;
    setEditError(''); setSaving(true);
    const body: Record<string, unknown> = { name: editName };
    if (editPassword) body.password = editPassword;
    try {
      const res = await fetch(`/api/admin/admins/${editId}`, {
        method: 'PATCH', headers: { ...auth.headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.error || 'Failed to update.'); return; }
      setAdmins(prev => prev.map(a => a.id === data.id ? data : a));
      setEditId(null); setEditName(''); setEditPassword('');
    } catch { setEditError('Network error.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this admin? This cannot be undone.')) return;
    const res = await fetch(`/api/admin/admins/${id}`, { method: 'DELETE', headers: auth.headers });
    const data = await res.json();
    if (res.ok) setAdmins(prev => prev.filter(a => a.id !== id));
    else alert(data.error || 'Failed to delete.');
  };

  if (loading) return <div className="p-8 text-center text-zinc-400">Loading admins…</div>;
  if (error) return <div className="p-8 text-center text-red-400">{error}</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Shield className="w-6 h-6 text-violet-400" />
          <h2 className="text-xl font-bold text-white">Admin Accounts</h2>
          <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">{admins.length}</span>
        </div>
        <button
          onClick={() => { setShowCreate(v => !v); setCreateError(''); }}
          className="flex items-center space-x-1.5 bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Admin</span>
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">New Admin</h3>
          {createError && (
            <p className="flex items-center space-x-1.5 text-red-400 text-xs">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /><span>{createError}</span>
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-zinc-400 mb-1">Email *</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
                placeholder="admin@example.com" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Display Name</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
                placeholder="Jane Doe" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Password * (min 8 chars)</label>
              <div className="relative">
                <input type={showNewPwd ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 pr-9 focus:outline-none focus:border-violet-500"
                  placeholder="••••••••" />
                <button type="button" onClick={() => setShowNewPwd(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200">
                  {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <div className="flex space-x-2 pt-1">
            <button onClick={handleCreate} disabled={creating || !newEmail || !newPassword}
              className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              {creating ? 'Creating…' : 'Create Admin'}
            </button>
            <button onClick={() => { setShowCreate(false); setCreateError(''); }}
              className="text-zinc-400 hover:text-white text-sm px-4 py-2 rounded-lg transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Admin list */}
      <div className="space-y-2">
        {admins.map(admin => (
          <div key={admin.id} className="bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden shadow-sm">
            {editId === admin.id ? (
              /* Edit mode */
              <div className="p-4 space-y-3">
                {editError && (
                  <p className="flex items-center space-x-1.5 text-red-400 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /><span>{editError}</span>
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Display Name</label>
                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">New Password (leave blank to keep)</label>
                    <div className="relative">
                      <input type={showEditPwd ? 'text' : 'password'} value={editPassword} onChange={e => setEditPassword(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 pr-9 focus:outline-none focus:border-violet-500"
                        placeholder="••••••••" />
                      <button type="button" onClick={() => setShowEditPwd(v => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200">
                        {showEditPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button onClick={handleSaveEdit} disabled={saving}
                    className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => { setEditId(null); setEditError(''); }}
                    className="text-zinc-400 hover:text-white text-sm px-3 py-1.5 rounded-lg transition-colors">Cancel</button>
                </div>
              </div>
            ) : (
              /* View mode */
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${admin.is_active ? 'bg-green-500' : 'bg-zinc-600'}`} />
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span className="text-sm font-semibold text-zinc-100 dark:text-white truncate">{admin.name || admin.email}</span>
                      {admin.email === currentEmail && (
                        <span className="text-xs bg-violet-600 text-white px-1.5 py-0.5 rounded font-medium">you</span>
                      )}
                      {!admin.is_active && (
                        <span className="text-xs bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded">inactive</span>
                      )}
                    </div>
                    {admin.name && <p className="text-xs text-zinc-400 truncate">{admin.email}</p>}
                    <p className="text-xs text-zinc-500">Added {new Date(admin.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-1 flex-shrink-0">
                  {/* Edit */}
                  <button onClick={() => { setEditId(admin.id); setEditName(admin.name || ''); setEditPassword(''); setEditError(''); }}
                    title="Edit"
                    className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  {/* Toggle active */}
                  <button onClick={() => handleToggleActive(admin)} title={admin.is_active ? 'Deactivate' : 'Activate'}
                    className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors">
                    {admin.is_active
                      ? <XCircle className="w-4 h-4 text-amber-400" />
                      : <CheckCircle className="w-4 h-4 text-green-400" />}
                  </button>
                  {/* Delete */}
                  {admin.email !== currentEmail && (
                    <button onClick={() => handleDelete(admin.id)} title="Delete"
                      className="p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {admins.length === 0 && (
        <p className="text-center text-zinc-500 text-sm py-8">No admins found.</p>
      )}
    </div>
  );
}
