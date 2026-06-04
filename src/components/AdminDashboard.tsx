import { useEffect, useState } from 'react';
import { Campaign, Task, TaskCompletion, Participant } from '../types.ts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, CheckSquare, Flag, Lightbulb, Loader2, Clock, AlertCircle } from 'lucide-react';

interface AdminDashboardProps {
  admin: { email: string };
  adminToken: string;
}

export default function AdminDashboard({ adminToken }: AdminDashboardProps) {
  const [stats, setStats] = useState({
    totalParticipants: 0,
    totalCompletions: 0,
    flaggedSubmissions: 0,
    activeCampaigns: 0
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [recentCompletions, setRecentCompletions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [flaggingComp, setFlaggingComp] = useState<any | null>(null);
  const [flagReason, setFlagReason] = useState('');
  const [isFlaggingSubmitting, setIsFlaggingSubmitting] = useState(false);

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      const [statsRes, chartRes, compsRes, partsRes, campsRes] = await Promise.all([
        fetch('/api/admin/stats', { headers: authHeaders }),
        fetch('/api/admin/chart-completions', { headers: authHeaders }),
        fetch('/api/completions', { headers: authHeaders }),
        fetch('/api/participants', { headers: authHeaders }),
        fetch('/api/campaigns', { headers: authHeaders })
      ]);

      if (!statsRes.ok) {
        setError('Session expired or unauthorized. Please log out and log in again.');
        return;
      }

      const statsData = await statsRes.json();
      const chartVal = await chartRes.json();
      const allComps: TaskCompletion[] = await compsRes.json();
      const allParts: Participant[] = await partsRes.json();
      const allCamps: Campaign[] = await campsRes.json();

      setStats(statsData);
      setChartData(chartVal);

      const taskLists = await Promise.all(
        allCamps.map(c =>
          fetch(`/api/campaigns/${c.id}/tasks`)
            .then(r => r.json())
            .catch(() => [])
        )
      );
      const allTasks: Task[] = taskLists.flat();

      const mapped = allComps.map(c => {
        const p = allParts.find(x => x.id === c.participant_id);
        const t = allTasks.find(x => x.id === c.task_id);
        const camp = allCamps.find(x => x.id === c.campaign_id);
        return {
          ...c,
          username: p?.superteam_username ?? 'Unknown',
          taskName: t?.label ?? 'Unknown Task',
          campaignName: camp?.title ?? 'Unknown Campaign'
        };
      });

      mapped.sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());
      setRecentCompletions(mapped.slice(0, 10));
    } catch {
      setError('Network error loading dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboardData(); }, []);

  const handleOpenFlagModal = (comp: any) => {
    setFlaggingComp(comp);
    setFlagReason(comp.flag_reason || '');
  };

  const handleConfirmFlag = async () => {
    if (!flaggingComp || !flagReason.trim()) return;
    setIsFlaggingSubmitting(true);
    try {
      const res = await fetch(`/api/completions/${flaggingComp.id}/flag`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ is_flagged: true, flag_reason: flagReason.trim() })
      });
      if (res.ok) {
        // Optimistic UI update
        setRecentCompletions(prev =>
          prev.map(c =>
            c.id === flaggingComp.id
              ? { ...c, is_flagged: true, flag_reason: flagReason.trim() }
              : c
          )
        );
        setFlaggingComp(null);
        setFlagReason('');
      }
    } finally {
      setIsFlaggingSubmitting(false);
    }
  };

  const formatShortDate = (iso: string) => {
    const d = new Date(iso);
    return (
      d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }) +
      ' ' +
      d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    );
  };

  return (
    <div className="space-y-8 pr-1">
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <Loader2 className="w-10 h-10 text-[#7C3AED] animate-spin" />
          <p className="text-xs font-semibold text-zinc-500">Calculating platform statistics...</p>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Total Participants', value: stats.totalParticipants, icon: <Users className="w-5 h-5" />, color: 'bg-[#7C3AED]/10 text-[#7C3AED]' },
              { label: 'Total Completions', value: stats.totalCompletions, icon: <CheckSquare className="w-5 h-5" />, color: 'bg-[#39FF14]/10 text-green-500 dark:text-[#39FF14]' },
              { label: 'Flagged Submissions', value: stats.flaggedSubmissions, icon: <Flag className="w-5 h-5" />, color: 'bg-red-500/10 text-red-500' },
              { label: 'Active Campaigns', value: stats.activeCampaigns, icon: <Lightbulb className="w-5 h-5" />, color: 'bg-pink-500/10 text-pink-500' }
            ].map(({ label, value, icon, color }) => (
              <div key={label} className="bg-white dark:bg-[#13131A] border border-zinc-200 dark:border-zinc-900 rounded-2xl p-6 shadow-sm flex items-center space-x-4">
                <div className={`p-3 rounded-xl ${color}`}>{icon}</div>
                <div>
                  <span className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider block">{label}</span>
                  <span className="text-3xl font-black text-zinc-900 dark:text-white mt-1 block">{value}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="bg-white dark:bg-[#13131A] border border-zinc-200 dark:border-zinc-900 rounded-2xl p-6 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500 mb-6 font-mono">
              7-Day Submission Volume
            </h3>
            <div className="h-64 sm:h-80 w-full font-mono text-[10px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#888888', fontWeight: 600 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: '#888888', fontWeight: 600 }} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: 'currentColor', opacity: 0.05 }}
                    contentStyle={{ borderRadius: '10px', fontSize: '11px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="completions" fill="#7C3AED" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent completions */}
          <div className="bg-white dark:bg-[#13131A] border border-zinc-200 dark:border-zinc-900 rounded-2xl p-6 shadow-sm overflow-hidden">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500 mb-6 font-mono flex items-center space-x-2">
              <Clock className="w-4 h-4 text-[#7C3AED]" />
              <span>Recent Submissions</span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-900 text-zinc-400 uppercase font-black text-[10px] tracking-wider">
                    <th className="py-4 font-mono">User</th>
                    <th className="py-4 font-mono">Campaign</th>
                    <th className="py-4 font-mono">Task</th>
                    <th className="py-4 font-mono">Type</th>
                    <th className="py-4 font-mono">Time</th>
                    <th className="py-4 font-mono text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900/60 font-semibold text-zinc-700 dark:text-zinc-300">
                  {recentCompletions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-400 font-medium">No submissions yet.</td>
                    </tr>
                  ) : (
                    recentCompletions.map(comp => (
                      <tr key={comp.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                        <td className="py-4 pr-3 text-zinc-950 dark:text-zinc-100 font-bold">{comp.username}</td>
                        <td className="py-4 pr-3 max-w-[140px] truncate">{comp.campaignName}</td>
                        <td className="py-4 pr-3 max-w-[140px] truncate">{comp.taskName}</td>
                        <td className="py-4 pr-3">
                          <span className={`px-2 py-0.5 rounded uppercase text-[10px] font-black tracking-wider ${
                            comp.proof_type === 'screenshot' ? 'bg-[#7C3AED]/10 text-[#7C3AED]' : 'bg-emerald-500/10 text-emerald-500'
                          }`}>
                            {comp.proof_type}
                          </span>
                        </td>
                        <td className="py-4 pr-3 font-mono text-zinc-400 text-[10px]">{formatShortDate(comp.completed_at)}</td>
                        <td className="py-4 text-center">
                          {comp.is_flagged ? (
                            <span className="text-[10px] font-bold text-red-500 bg-red-400/10 border border-red-500/20 px-2 py-1 rounded" title={comp.flag_reason}>
                              Flagged ✓
                            </span>
                          ) : (
                            <button
                              id={`btn-flag-submission-${comp.id}`}
                              onClick={() => handleOpenFlagModal(comp)}
                              className="text-[10px] font-bold text-zinc-400 hover:text-red-500 border border-zinc-200/60 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:border-red-500/20 dark:hover:bg-red-500/10 px-2.5 py-1 rounded transition-colors cursor-pointer"
                            >
                              Flag
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Flag dialog */}
      {flaggingComp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div id="flagging-dialog" className="w-full max-w-md bg-white dark:bg-[#13131A] border border-zinc-200 dark:border-zinc-900 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-red-500"></div>
            <div className="flex items-start space-x-3.5 mb-4">
              <div className="p-2.5 bg-red-500/10 text-red-500 rounded-xl mt-0.5 flex-shrink-0">
                <Flag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-zinc-950 dark:text-white">Flag this submission?</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Participant <span className="font-bold text-zinc-800 dark:text-white">{flaggingComp.username}</span> will see this flag.
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-2">
                  Reason for flag *
                </label>
                <textarea
                  id="flag-reason-textarea"
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  required
                  placeholder="Incomplete browser viewport. Please recapture the full output..."
                  rows={4}
                  className="w-full bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 px-3.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-red-500"
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setFlaggingComp(null)}
                  className="text-xs font-semibold px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isFlaggingSubmitting || !flagReason.trim()}
                  onClick={handleConfirmFlag}
                  className="text-xs font-extrabold uppercase px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white shadow shadow-red-500/15 disabled:opacity-40 cursor-pointer"
                >
                  {isFlaggingSubmitting ? 'Flagging...' : 'Confirm Flag'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
