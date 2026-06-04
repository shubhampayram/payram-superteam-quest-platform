import React, { useState, useEffect } from 'react';
import { Campaign, Task, Tag } from '../types.ts';
import { buildLLMUrl, LLM_TARGETS, getLLMInfo } from '../lib/llm-utils.ts';
import {
  Plus, Edit, Eye, Trash2, Check, ToggleLeft, ToggleRight,
  ArrowLeft, Sparkles, FileText, MoveUp, MoveDown, AlertCircle, Loader2, Tag as TagIcon, X
} from 'lucide-react';

interface AdminCampaignsProps {
  adminToken: string;
}

const TAG_PALETTE = [
  '#7C3AED', '#FF007F', '#10B981', '#F59E0B', '#3B82F6',
  '#EF4444', '#8B5CF6', '#06B6D4', '#F97316', '#84CC16'
];

export default function AdminCampaigns({ adminToken }: AdminCampaignsProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [viewState, setViewState] = useState<'list' | 'campaign_form' | 'tasks_view'>('list');
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [selectedCampaignForTasks, setSelectedCampaignForTasks] = useState<Campaign | null>(null);
  const [campaignTasks, setCampaignTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const [campForm, setCampForm] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    superteam_submission_url: '',
    status: 'active' as 'active' | 'disabled'
  });

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState({
    type: 'llm_search' as 'llm_search' | 'blog',
    label: '',
    description: '',
    llm_target: 'chatgpt' as 'chatgpt' | 'perplexity' | 'gemini' | 'claude',
    llm_prompt: '',
    blog_prompt: '',
    blog_platforms_whitelist: [] as string[]
  });

  const BLOG_PLATFORMS = ['Medium', 'Dev.to', 'Hashnode', 'Substack', 'Any URL'];

  // ── Tags state ────────────────────────────────────────────────────────────
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [showTagPanel, setShowTagPanel] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_PALETTE[0]);
  const [tagError, setTagError] = useState('');
  const [taskSelectedTags, setTaskSelectedTags] = useState<Record<string, string[]>>({}); // taskId → tagIds

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`
  };

  const loadCampaigns = async () => {
    try {
      setLoading(true); setError('');
      const [campsRes, tagsRes] = await Promise.all([
        fetch('/api/campaigns', { headers: authHeaders }),
        fetch('/api/admin/tags', { headers: authHeaders })
      ]);
      // 401 means server restarted and session expired — prompt re-login
      if (campsRes.status === 401 || tagsRes.status === 401) {
        setError('Session expired. Please log out and log in again.');
        return;
      }
      if (!campsRes.ok) { setError('Failed to load campaigns.'); return; }
      setCampaigns(await campsRes.json());
      if (tagsRes.ok) setAllTags(await tagsRes.json());
    } catch { setError('Network error. Make sure the dev server is running (npm run dev).'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadCampaigns(); }, []);

  // ── Tag helpers ───────────────────────────────────────────────────────────
  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    setTagError('');
    try {
      const res = await fetch('/api/admin/tags', {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ name: newTagName.trim(), color: newTagColor })
      });
      const data = await res.json();
      if (!res.ok) { setTagError(data.error || 'Failed to create tag.'); return; }
      setAllTags(prev => [...prev, data]);
      setNewTagName('');
    } catch {
      setTagError('Network error. Make sure the server is running.');
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    try {
      const res = await fetch(`/api/admin/tags/${tagId}`, { method: 'DELETE', headers: authHeaders });
      if (res.ok) { setAllTags(prev => prev.filter(t => t.id !== tagId)); }
    } catch { /* silent */ }
  };

  const loadTagsForTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/tags`, { headers: authHeaders });
      if (res.ok) {
        const tags: Tag[] = await res.json();
        setTaskSelectedTags(prev => ({ ...prev, [taskId]: tags.map(t => t.id) }));
      }
    } catch { /* silent */ }
  };

  const handleToggleTaskTag = async (taskId: string, tagId: string) => {
    const current = taskSelectedTags[taskId] || [];
    const next = current.includes(tagId) ? current.filter(id => id !== tagId) : [...current, tagId];
    setTaskSelectedTags(prev => ({ ...prev, [taskId]: next }));
    try {
      await fetch(`/api/tasks/${taskId}/tags`, {
        method: 'PUT', headers: authHeaders,
        body: JSON.stringify({ tag_ids: next })
      });
    } catch { /* silent */ }
  };

  const dateShort = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

  const handleToggleStatus = async (camp: Campaign) => {
    const nextStatus = camp.status === 'active' ? 'disabled' : 'active';
    try {
      const res = await fetch(`/api/campaigns/${camp.id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        loadCampaigns();
        if (selectedCampaignForTasks?.id === camp.id) {
          setSelectedCampaignForTasks({ ...selectedCampaignForTasks, status: nextStatus });
        }
      }
    } catch { /* silent */ }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!window.confirm('Delete this campaign and all its tasks permanently? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: 'DELETE', headers: authHeaders });
      if (res.ok) {
        loadCampaigns();
        if (selectedCampaignForTasks?.id === id) setViewState('list');
      }
    } catch { /* silent */ }
  };

  const handleOpenNewCampaign = () => {
    setEditingCampaign(null);
    setCampForm({ title: '', description: '', start_date: '', end_date: '', superteam_submission_url: '', status: 'active' });
    setViewState('campaign_form');
  };

  const handleOpenEditCampaign = (camp: Campaign) => {
    setEditingCampaign(camp);
    setCampForm({
      title: camp.title,
      description: camp.description,
      start_date: camp.start_date.split('T')[0],
      end_date: camp.end_date.split('T')[0],
      superteam_submission_url: camp.superteam_submission_url,
      status: camp.status
    });
    setViewState('campaign_form');
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingCampaign ? `/api/campaigns/${editingCampaign.id}` : '/api/campaigns';
    const method = editingCampaign ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, { method, headers: authHeaders, body: JSON.stringify(campForm) });
      const data = await res.json();
      if (res.ok) { await loadCampaigns(); setViewState('list'); }
      else setError(data.error || 'Failed to save campaign.');
    } catch { setError('Network error. Make sure the server is running.'); }
  };

  const loadTasksForCampaign = async (camp: Campaign) => {
    try {
      setLoadingTasks(true);
      const res = await fetch(`/api/campaigns/${camp.id}/tasks`, { headers: authHeaders });
      setCampaignTasks(await res.json());
    } catch { /* silent */ } finally {
      setLoadingTasks(false);
    }
  };

  const handleViewTasks = (camp: Campaign) => {
    setSelectedCampaignForTasks(camp);
    loadTasksForCampaign(camp);
    setViewState('tasks_view');
    setShowTaskForm(false);
    setEditingTask(null);
    setShowTagPanel(false);
  };

  const handleMoveTaskOrder = async (task: Task, direction: 'up' | 'down') => {
    const sorted = [...campaignTasks].sort((a, b) => a.display_order - b.display_order);
    const idx = sorted.findIndex(t => t.id === task.id);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const t1 = sorted[idx];
    const t2 = sorted[swapIdx];
    try {
      await Promise.all([
        fetch(`/api/tasks/${t1.id}`, { method: 'PUT', headers: authHeaders, body: JSON.stringify({ display_order: t2.display_order }) }),
        fetch(`/api/tasks/${t2.id}`, { method: 'PUT', headers: authHeaders, body: JSON.stringify({ display_order: t1.display_order }) })
      ]);
      if (selectedCampaignForTasks) loadTasksForCampaign(selectedCampaignForTasks);
    } catch { /* silent */ }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Delete this task permanently?')) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE', headers: authHeaders });
      if (res.ok && selectedCampaignForTasks) loadTasksForCampaign(selectedCampaignForTasks);
    } catch { /* silent */ }
  };

  const handleOpenNewTask = () => {
    setEditingTask(null);
    setTaskForm({ type: 'llm_search', label: '', description: '', llm_target: 'chatgpt', llm_prompt: '', blog_prompt: '', blog_platforms_whitelist: [] });
    setShowTaskForm(true);
  };

  const handleOpenEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskForm({
      type: task.type,
      label: task.label,
      description: task.description,
      // Only coerce llm_target for llm_search tasks; leave as-is for blog
      llm_target: (task.llm_target as any) || 'chatgpt',
      llm_prompt: task.llm_prompt || '',
      blog_prompt: task.blog_prompt || '',
      blog_platforms_whitelist: task.blog_platforms_whitelist || []
    });
    setShowTaskForm(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampaignForTasks) return;
    const url = editingTask ? `/api/tasks/${editingTask.id}` : `/api/campaigns/${selectedCampaignForTasks.id}/tasks`;
    const method = editingTask ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, { method, headers: authHeaders, body: JSON.stringify(taskForm) });
      if (res.ok) { await loadTasksForCampaign(selectedCampaignForTasks); setShowTaskForm(false); setEditingTask(null); }
    } catch { /* silent */ }
  };

  const handleToggleBlogPlatform = (platform: string) => {
    setTaskForm(prev => ({
      ...prev,
      blog_platforms_whitelist: prev.blog_platforms_whitelist.includes(platform)
        ? prev.blog_platforms_whitelist.filter(p => p !== platform)
        : [...prev.blog_platforms_whitelist, platform]
    }));
  };

  const previewLLMUrl = buildLLMUrl(taskForm.llm_target, taskForm.llm_prompt || 'your encoded prompt');

  return (
    <div className="space-y-6">

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {viewState === 'list' && (
        <div className="bg-white dark:bg-[#13131A] border border-zinc-200 dark:border-zinc-900 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-zinc-500 font-mono">Campaign Catalogue</h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Configured incentives and quests.</p>
            </div>
            <button
              id="btn-admin-campaign-new"
              onClick={handleOpenNewCampaign}
              className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer flex items-center space-x-1"
            >
              <Plus className="w-4 h-4" />
              <span>Create Campaign</span>
            </button>
          </div>

          {loading ? (
            <div className="py-16 flex items-center justify-center space-x-2 text-zinc-400 text-xs">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading campaigns...</span>
            </div>
          ) : campaigns.length === 0 ? (
            <p className="py-16 text-center text-zinc-400 text-xs border border-dashed rounded-xl">
              No campaigns yet. Click "Create Campaign" to get started.
            </p>
          ) : (
            <div className="overflow-x-auto text-xs font-semibold">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-900 font-black uppercase text-[10px] text-zinc-400">
                    <th className="py-4 font-mono">Title</th>
                    <th className="py-4 font-mono">Date Range</th>
                    <th className="py-4 font-mono">Status</th>
                    <th className="py-4 font-mono text-center">Superteam URL</th>
                    <th className="py-4 font-mono text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900/40 text-zinc-700 dark:text-zinc-300">
                  {campaigns.map(camp => (
                    <tr key={camp.id} className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20 transition-all ${camp.status === 'disabled' ? 'opacity-50' : ''}`}>
                      <td className="py-4 pr-4">
                        <div className="font-extrabold text-[#7C3AED] dark:text-[#39FF14] text-sm">{camp.title}</div>
                        <p className="text-[10px] font-normal text-zinc-400 mt-1 max-w-sm truncate">{camp.description}</p>
                      </td>
                      <td className="py-4 pr-4 font-mono text-[10px] text-zinc-400">
                        {dateShort(camp.start_date)} – {dateShort(camp.end_date)}
                      </td>
                      <td className="py-4 pr-3">
                        <button
                          id={`btn-campaign-toggle-status-${camp.id}`}
                          onClick={() => handleToggleStatus(camp)}
                          className="flex items-center space-x-1.5 text-[10px] uppercase font-black tracking-wider cursor-pointer bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 px-3 py-1.5 rounded-lg hover:opacity-85"
                        >
                          <span className={camp.status === 'active' ? 'text-[#39FF14]' : 'text-zinc-400'}>
                            {camp.status === 'active' ? '● Active' : '○ Disabled'}
                          </span>
                        </button>
                      </td>
                      <td className="py-4 pr-3 text-center">
                        <a
                          href={camp.superteam_submission_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-zinc-400 hover:text-[#7C3AED] dark:hover:text-[#39FF14] font-mono text-[10px] max-w-[120px] truncate block"
                        >
                          {camp.superteam_submission_url}
                        </a>
                      </td>
                      <td className="py-4 text-right space-x-2">
                        <button
                          id={`btn-campaign-tasks-view-${camp.id}`}
                          onClick={() => handleViewTasks(camp)}
                          className="px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded border border-zinc-200/40 dark:border-zinc-800 cursor-pointer inline-flex items-center space-x-1"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#7C3AED]" />
                          <span>Tasks</span>
                        </button>
                        <button
                          id={`btn-campaign-edit-${camp.id}`}
                          onClick={() => handleOpenEditCampaign(camp)}
                          className="px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded border border-zinc-200/40 dark:border-zinc-800 cursor-pointer inline-flex items-center space-x-1"
                        >
                          <Edit className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Edit</span>
                        </button>
                        <button
                          id={`btn-campaign-delete-${camp.id}`}
                          onClick={() => handleDeleteCampaign(camp.id)}
                          className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-red-500 rounded cursor-pointer inline-flex items-center space-x-0.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── CAMPAIGN FORM ── */}
      {viewState === 'campaign_form' && (
        <div className="bg-white dark:bg-[#13131A] border border-zinc-200 dark:border-zinc-900 rounded-2xl p-7 shadow-sm max-w-2xl mx-auto">
          <div className="flex items-center space-x-2.5 pb-6 mb-6 border-b border-zinc-100 dark:border-zinc-900">
            <button
              id="btn-form-back"
              onClick={() => setViewState('list')}
              className="p-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-500 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h3 className="font-extrabold text-lg text-zinc-950 dark:text-white">
              {editingCampaign ? 'Edit Campaign' : 'New Campaign'}
            </h3>
          </div>

          <form onSubmit={handleSaveCampaign} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-2">Campaign Title *</label>
              <input
                id="input-camp-title"
                type="text"
                required
                placeholder="e.g. PayRam Solana Integration Challenge"
                value={campForm.title}
                onChange={(e) => setCampForm(prev => ({ ...prev, title: e.target.value }))}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-xl py-3 px-4 text-xs focus:outline-none focus:border-[#7C3AED]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-2">Description</label>
              <textarea
                id="input-camp-description"
                placeholder="Provide directions, requirements and rules..."
                value={campForm.description}
                onChange={(e) => setCampForm(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-xl py-3 px-4 text-xs focus:outline-none focus:border-[#7C3AED]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-2">Launch Date *</label>
                <input
                  id="input-camp-start"
                  type="date"
                  required
                  value={campForm.start_date}
                  onChange={(e) => setCampForm(prev => ({ ...prev, start_date: e.target.value }))}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-xl py-3 px-4 text-xs focus:outline-none focus:border-[#7C3AED]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-2">Expiry Date *</label>
                <input
                  id="input-camp-end"
                  type="date"
                  required
                  value={campForm.end_date}
                  onChange={(e) => setCampForm(prev => ({ ...prev, end_date: e.target.value }))}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-xl py-3 px-4 text-xs focus:outline-none focus:border-[#7C3AED]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-2">Superteam Claim URL *</label>
              <input
                id="input-camp-url"
                type="url"
                required
                placeholder="https://superteam.fun/quests/payram-example"
                value={campForm.superteam_submission_url}
                onChange={(e) => setCampForm(prev => ({ ...prev, superteam_submission_url: e.target.value }))}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-xl py-3 px-4 text-xs focus:outline-none focus:border-[#7C3AED]"
              />
            </div>

            <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-950 px-5 py-4 rounded-xl border border-zinc-200/50 dark:border-zinc-900/60">
              <div>
                <p className="text-xs font-bold text-zinc-700 dark:text-zinc-200">Active Status</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">Toggle whether participants can view this campaign.</p>
              </div>
              <button
                id="btn-form-active-toggle"
                type="button"
                onClick={() => setCampForm(prev => ({ ...prev, status: prev.status === 'active' ? 'disabled' : 'active' }))}
                className="text-[#7C3AED] dark:text-[#39FF14] hover:opacity-85 cursor-pointer"
              >
                {campForm.status === 'active'
                  ? <ToggleRight className="w-11 h-11 text-indigo-600 dark:text-[#39FF14]" />
                  : <ToggleLeft className="w-11 h-11 text-zinc-400" />
                }
              </button>
            </div>

            <div className="flex justify-end gap-3.5 pt-4">
              <button
                id="btn-form-cancel"
                type="button"
                onClick={() => setViewState('list')}
                className="px-5 py-3 border border-zinc-200 dark:border-zinc-800 text-zinc-500 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-form-save"
                type="submit"
                className="px-5 py-3 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Save Campaign
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── TASKS VIEW ── */}
      {viewState === 'tasks_view' && selectedCampaignForTasks && (
        <div className="pt-2 space-y-6">
          <div className="flex items-center justify-between">
            <button
              id="btn-tasks-back-list"
              onClick={() => setViewState('list')}
              className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to campaigns</span>
            </button>
            {!showTaskForm && (
              <button
                id="btn-task-new-trigger"
                onClick={handleOpenNewTask}
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer flex items-center space-x-1"
              >
                <Plus className="w-4 h-4" />
                <span>Add Quest Task</span>
              </button>
            )}
          </div>

          <div className="bg-white dark:bg-[#13131A] border border-zinc-200 dark:border-zinc-900 rounded-2xl p-6 shadow-sm">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider font-mono text-zinc-400 block">Managing tasks for</span>
                <h3 className="font-extrabold text-xl text-zinc-950 dark:text-white mt-2">{selectedCampaignForTasks.title}</h3>
                <p className="text-xs text-zinc-400 font-semibold mt-1">Status: {selectedCampaignForTasks.status}</p>
              </div>
              <button
                onClick={() => setShowTagPanel(!showTagPanel)}
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border cursor-pointer transition-colors ${
                  showTagPanel ? 'bg-[#7C3AED] text-white border-[#7C3AED]' : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100'
                }`}
              >
                <TagIcon className="w-3.5 h-3.5" />
                <span>Manage Tags</span>
                {allTags.length > 0 && <span className="ml-1 bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-1.5 py-0.5 rounded text-[10px] font-black">{allTags.length}</span>}
              </button>
            </div>
          </div>

          {/* ── TAGS MANAGEMENT PANEL ── */}
          {showTagPanel && (
            <div className="bg-white dark:bg-[#13131A] border border-zinc-200 dark:border-zinc-900 rounded-2xl p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wider text-zinc-500 font-mono mb-4 flex items-center space-x-2">
                <TagIcon className="w-3.5 h-3.5 text-[#7C3AED]" />
                <span>Tag Library — Internal Use Only</span>
              </p>
              <p className="text-[10px] text-zinc-400 mb-5">Tags are admin-only labels. Participants cannot see them.</p>

              {/* Create new tag */}
              <div className="flex flex-wrap gap-3 items-end mb-5 pb-5 border-b border-zinc-100 dark:border-zinc-900">
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1.5">Tag Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Product Related"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 px-3 text-xs focus:outline-none focus:border-[#7C3AED]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1.5">Colour</label>
                  <div className="flex flex-wrap gap-1.5">
                    {TAG_PALETTE.map(color => (
                      <button key={color} type="button" onClick={() => setNewTagColor(color)}
                        className={`w-6 h-6 rounded-full cursor-pointer transition-transform hover:scale-110 ${newTagColor === color ? 'ring-2 ring-offset-2 ring-zinc-400 scale-110' : ''}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <button onClick={handleCreateTag} disabled={!newTagName.trim()}
                  className="flex items-center space-x-1 bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase cursor-pointer disabled:opacity-40 transition-colors">
                  <Plus className="w-3.5 h-3.5" /><span>Create</span>
                </button>
              </div>

              {tagError && (
                <p className="text-red-500 text-xs font-medium mb-3 flex items-center space-x-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{tagError}</span>
                </p>
              )}

              {/* Existing tags */}
              {allTags.length === 0 ? (
                <p className="text-xs text-zinc-400 text-center py-4">No tags yet. Create one above.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {allTags.map(tag => (
                    <div key={tag.id} className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-full border text-xs font-bold"
                      style={{ backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color + '40' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                      <span>{tag.name}</span>
                      <button onClick={() => handleDeleteTag(tag.id)}
                        className="ml-0.5 hover:opacity-60 cursor-pointer transition-opacity">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Task Form */}
          {showTaskForm && (
            <div id="task-panel-form" className="bg-[#F3F4F6] dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-2xl p-6 shadow-xl max-w-xl mx-auto space-y-6">
              <h4 className="font-black text-sm uppercase tracking-wider text-zinc-500 font-mono">
                {editingTask ? 'Edit Quest Task' : 'Create Quest Task'}
              </h4>

              <form onSubmit={handleSaveTask} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-2">Task Type</label>
                  <div className="grid grid-cols-2 gap-3 bg-zinc-200 dark:bg-zinc-900 p-1 rounded-xl">
                    <button
                      id="toggle-task-type-llm"
                      type="button"
                      onClick={() => setTaskForm(prev => ({ ...prev, type: 'llm_search' }))}
                      className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 cursor-pointer ${
                        taskForm.type === 'llm_search'
                          ? 'bg-white dark:bg-zinc-950 text-[#7C3AED] dark:text-[#39FF14] shadow-sm'
                          : 'text-zinc-500 hover:text-zinc-700'
                      }`}
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>LLM Search</span>
                    </button>
                    <button
                      id="toggle-task-type-blog"
                      type="button"
                      onClick={() => setTaskForm(prev => ({ ...prev, type: 'blog' }))}
                      className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 cursor-pointer ${
                        taskForm.type === 'blog'
                          ? 'bg-white dark:bg-zinc-950 text-[#7C3AED] dark:text-[#39FF14] shadow-sm'
                          : 'text-zinc-500 hover:text-zinc-700'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      <span>Blog Quest</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-2">Task Label *</label>
                  <input
                    id="input-task-label"
                    type="text"
                    required
                    placeholder="e.g. Search PayRam on ChatGPT"
                    value={taskForm.label}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, label: e.target.value }))}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3 px-4 text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-2">Instructions</label>
                  <textarea
                    id="input-task-desc"
                    placeholder="Describe what participants should do..."
                    value={taskForm.description}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3 px-4 text-xs focus:outline-none"
                  />
                </div>

                {taskForm.type === 'llm_search' ? (
                  <>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-2">LLM Target *</label>
                      <select
                        id="select-task-llm-target"
                        value={taskForm.llm_target}
                        onChange={(e) => setTaskForm(prev => ({ ...prev, llm_target: e.target.value as any }))}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3 px-3 text-xs focus:outline-none text-zinc-700 dark:text-zinc-200"
                      >
                        {LLM_TARGETS.map(target => (
                          <option key={target} value={target}>{getLLMInfo(target).label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-2">Search Prompt *</label>
                      <textarea
                        id="input-task-llm-prompt"
                        required
                        placeholder="Compare PayRam with Solana Pay..."
                        value={taskForm.llm_prompt}
                        onChange={(e) => setTaskForm(prev => ({ ...prev, llm_prompt: e.target.value }))}
                        rows={3}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3 px-4 text-xs focus:outline-none font-mono"
                      />
                    </div>

                    <div className="p-4 bg-zinc-100 dark:bg-zinc-900 w-full rounded-xl border border-dashed text-[10px]">
                      <p className="font-bold text-zinc-500 uppercase tracking-wide mb-1.5 font-mono">Live URL Preview</p>
                      <p className="text-[#7C3AED] dark:text-[#39FF14] break-all font-mono">{previewLLMUrl}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-2 flex justify-between">
                        <span>Blog Topic Prompt *</span>
                        <span className="text-zinc-500 normal-case font-normal">{taskForm.blog_prompt.length}/1000</span>
                      </label>
                      <textarea
                        id="input-task-blog-prompt"
                        required
                        maxLength={1000}
                        placeholder="Write a blog post reviewing PayRam... min 300 words."
                        value={taskForm.blog_prompt}
                        onChange={(e) => setTaskForm(prev => ({ ...prev, blog_prompt: e.target.value }))}
                        rows={4}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3 px-4 text-xs focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-2">Accepted Platforms</label>
                      <div className="flex flex-wrap gap-2.5">
                        {BLOG_PLATFORMS.map(plat => {
                          const active = taskForm.blog_platforms_whitelist.includes(plat);
                          return (
                            <button
                              key={plat}
                              type="button"
                              onClick={() => handleToggleBlogPlatform(plat)}
                              className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer flex items-center space-x-1 ${
                                active
                                  ? 'bg-[#7C3AED] text-white border-[#7C3AED]'
                                  : 'bg-white dark:bg-zinc-900 text-zinc-600 border-zinc-200 dark:border-zinc-800'
                              }`}
                            >
                              {active && <Check className="w-3 h-3" />}
                              <span>{plat}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    id="btn-task-form-cancel"
                    type="button"
                    onClick={() => setShowTaskForm(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border text-zinc-400 hover:text-zinc-600 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    id="btn-task-form-save"
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-bold uppercase bg-[#7C3AED] hover:bg-[#6D28D9] text-white cursor-pointer"
                  >
                    Save Task
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Task List */}
          <div className="bg-white dark:bg-[#13131A] border border-zinc-200 dark:border-zinc-900 rounded-2xl p-6 shadow-sm">
            <h4 className="font-black text-xs uppercase tracking-wider text-zinc-500 mb-6 font-mono">Task List</h4>
            {loadingTasks ? (
              <div className="py-12 flex items-center justify-center space-x-2 text-zinc-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading tasks...</span>
              </div>
            ) : campaignTasks.length === 0 ? (
              <p className="py-12 text-center text-zinc-400 text-xs border border-dashed rounded-xl">
                No tasks yet. Click "Add Quest Task" to create one.
              </p>
            ) : (
              <div className="space-y-4">
                {campaignTasks
                  .sort((a, b) => a.display_order - b.display_order)
                  .map((task, idx) => {
                  // Load tags for this task the first time it renders
                  if (allTags.length > 0 && taskSelectedTags[task.id] === undefined) {
                    loadTagsForTask(task.id);
                  }
                  return (
                    <div
                      key={task.id}
                      className="p-5 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors space-y-3"
                    >
                      <div className="flex items-start space-x-3.5">
                        <div className="flex flex-col space-y-1">
                          <button
                            id={`btn-order-up-${task.id}`}
                            onClick={() => handleMoveTaskOrder(task, 'up')}
                            disabled={idx === 0}
                            className="p-0.5 rounded text-zinc-400 hover:text-zinc-900 dark:hover:text-white disabled:opacity-20 cursor-pointer"
                          >
                            <MoveUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`btn-order-down-${task.id}`}
                            onClick={() => handleMoveTaskOrder(task, 'down')}
                            disabled={idx === campaignTasks.length - 1}
                            className="p-0.5 rounded text-zinc-400 hover:text-zinc-900 dark:hover:text-white disabled:opacity-20 cursor-pointer"
                          >
                            <MoveDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center space-x-2">
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                              task.type === 'llm_search'
                                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                : 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'
                            }`}>
                              {task.type === 'llm_search' ? `${task.llm_target} Search` : 'Blog writeup'}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono">#{task.display_order}</span>
                          </div>
                          <h5 className="font-extrabold text-sm text-zinc-950 dark:text-zinc-100 leading-snug">{task.label}</h5>
                          <p className="text-xs text-zinc-400 max-w-lg truncate">{task.description}</p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          id={`btn-task-edit-${task.id}`}
                          onClick={() => handleOpenEditTask(task)}
                          className="px-2.5 py-1.5 text-xs font-bold border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-900 rounded hover:bg-zinc-100 cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          id={`btn-task-delete-${task.id}`}
                          onClick={() => handleDeleteTask(task.id)}
                          className="px-2.5 py-1.5 text-xs font-bold bg-red-500/15 text-red-500 border border-red-500/20 rounded hover:bg-red-500/25 cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>

                      {/* Tag assignment — shown when tags exist, admin-internal only */}
                      {allTags.length > 0 && (
                        <div className="flex flex-wrap gap-2 items-center pt-3 border-t border-zinc-100 dark:border-zinc-900">
                          <span className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Tags:</span>
                          {allTags.map(tag => {
                            const isActive = (taskSelectedTags[task.id] || []).includes(tag.id);
                            return (
                              <button key={tag.id} type="button"
                                onClick={() => handleToggleTaskTag(task.id, tag.id)}
                                className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full border text-[10px] font-bold cursor-pointer transition-all ${isActive ? 'opacity-100' : 'opacity-30 hover:opacity-60'}`}
                                style={isActive
                                  ? { backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color + '40' }
                                  : { color: tag.color, borderColor: tag.color + '40' }
                                }
                              >
                                {isActive && <Check className="w-2.5 h-2.5" />}
                                <span>{tag.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
