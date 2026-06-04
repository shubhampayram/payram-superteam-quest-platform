import { useEffect, useState } from 'react';
import { Participant, TaskCompletion, Campaign, Task } from '../types.ts';
import { getCountryFlag } from '../lib/countries.ts';
import { exportUsersCSV, UserRow } from '../lib/csv-export.ts';
import {
  Search, Eye, X, ArrowUpRight, Loader2, FileDown, AlertCircle
} from 'lucide-react';

interface AdminUsersProps {
  adminToken: string;
}

export default function AdminUsers({ adminToken }: AdminUsersProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCountry, setFilterCountry] = useState('all');
  const [countries, setCountries] = useState<string[]>([]);

  const [activeUserSession, setActiveUserSession] = useState<any | null>(null);

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`
  };

  const loadUsersData = async () => {
    try {
      setLoading(true);
      setError('');

      const [partRes, compRes, campRes] = await Promise.all([
        fetch('/api/participants', { headers: authHeaders }),
        fetch('/api/completions', { headers: authHeaders }),
        fetch('/api/campaigns', { headers: authHeaders })
      ]);

      if (!partRes.ok) {
        setError('Session expired or unauthorized. Please log out and log in again.');
        return;
      }

      const allParts: Participant[] = await partRes.json();
      const allComps: TaskCompletion[] = await compRes.json();
      const allCamps: Campaign[] = await campRes.json();

      setParticipants(allParts);
      setCompletions(allComps);
      setCampaigns(allCamps);
      setCountries(Array.from(new Set(allParts.map(p => p.country))).sort());

      const taskLists = await Promise.all(
        allCamps.map(c =>
          fetch(`/api/campaigns/${c.id}/tasks`)
            .then(r => r.json())
            .catch(() => [])
        )
      );
      setTasks(taskLists.flat());
    } catch {
      setError('Network error loading users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsersData(); }, []);

  const filteredUsers = participants.filter(user => {
    const term = searchQuery.toLowerCase();
    return (
      (user.superteam_username.toLowerCase().includes(term) || user.email.toLowerCase().includes(term)) &&
      (filterCountry === 'all' || user.country === filterCountry)
    );
  });

  const getCompletionsCount = (userId: string) =>
    completions.filter(c => c.participant_id === userId).length;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

  const handleOpenUserActivity = (user: Participant) => {
    const userComps = completions.filter(c => c.participant_id === user.id).map(c => ({
      ...c,
      campaignTitle: campaigns.find(x => x.id === c.campaign_id)?.title ?? 'Deleted Campaign',
      taskLabel: tasks.find(x => x.id === c.task_id)?.label ?? 'Deleted Task'
    }));
    setActiveUserSession({ user, completions: userComps });
  };

  // Client-side CSV export for users
  const handleExportUsersCSV = () => {
    const rows: UserRow[] = filteredUsers.map(u => ({
      superteam_username: u.superteam_username,
      email: u.email,
      country: u.country,
      twitter_handle: u.twitter_handle ?? '',
      created_at: u.created_at,
      completions_count: getCompletionsCount(u.id)
    }));
    exportUsersCSV(rows);
  };

  return (
    <div className="space-y-6">

      {/* Search and Filter */}
      <div className="bg-white dark:bg-[#13131A] border border-zinc-200 dark:border-zinc-900 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500 font-mono">Participant Directory</h3>
            <p className="text-xs text-zinc-400 mt-1">View and manage all registered participants.</p>
          </div>
          <button
            onClick={handleExportUsersCSV}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer flex items-center space-x-1.5"
          >
            <FileDown className="w-4 h-4 text-[#7C3AED]" />
            <span>Export CSV</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3.5 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-400" />
            <input
              id="users-filter-search"
              type="text"
              placeholder="Search by username or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-xl py-3 pl-11 pr-4 text-xs focus:outline-none"
            />
          </div>
          <div className="w-full md:w-64">
            <select
              id="users-filter-country"
              value={filterCountry}
              onChange={(e) => setFilterCountry(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-xl py-3 px-3 text-xs text-zinc-600 dark:text-zinc-300 focus:outline-none"
            >
              <option value="all">🗺️ All Countries</option>
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#13131A] border border-zinc-200 dark:border-zinc-900 rounded-2xl p-6 shadow-sm overflow-hidden text-xs">
        {loading ? (
          <div className="py-20 flex flex-col items-center space-y-3 text-zinc-400">
            <Loader2 className="w-6 h-6 animate-spin text-[#7C3AED]" />
            <span>Loading user directory...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <p className="py-16 text-center text-zinc-400">No participants match the selected filters.</p>
        ) : (
          <div className="overflow-x-auto font-semibold">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-900 font-black text-[10px] tracking-wider text-zinc-400 uppercase">
                  <th className="py-4 font-mono">Username</th>
                  <th className="py-4 font-mono">Email</th>
                  <th className="py-4 font-mono">Country</th>
                  <th className="py-4 font-mono">Twitter</th>
                  <th className="py-4 font-mono">Joined</th>
                  <th className="py-4 font-mono text-center">Completions</th>
                  <th className="py-4 font-mono text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900/45 text-zinc-700 dark:text-zinc-300">
                {filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10 transition-colors">
                    <td className="py-4 pr-3 text-zinc-950 dark:text-zinc-100 font-extrabold text-sm">{user.superteam_username}</td>
                    <td className="py-4 pr-3 font-medium text-zinc-600 dark:text-zinc-300">{user.email}</td>
                    <td className="py-4 pr-3">
                      <span className="flex items-center space-x-1.5">
                        <span className="text-sm">{getCountryFlag(user.country)}</span>
                        <span>{user.country}</span>
                      </span>
                    </td>
                    <td className="py-4 pr-3 text-[#7C3AED] dark:text-[#39FF14] font-mono font-bold">
                      {user.twitter_handle || '@no_handle'}
                    </td>
                    <td className="py-4 pr-3 text-zinc-400 font-mono text-[10px]">{formatDate(user.created_at)}</td>
                    <td className="py-4 pr-3 text-center">
                      <span className="bg-[#7C3AED]/10 text-[#7C3AED] dark:bg-[#39FF14]/10 dark:text-[#39FF14] px-2.5 py-1 rounded font-black font-mono">
                        {getCompletionsCount(user.id)}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <button
                        id={`btn-user-activity-slide-${user.id}`}
                        onClick={() => handleOpenUserActivity(user)}
                        className="px-2.5 py-1.5 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 cursor-pointer rounded inline-flex items-center space-x-1 font-bold"
                      >
                        <Eye className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Activity</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Activity Slide-over */}
      {activeUserSession && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-end">
          <div id="user-slide-over-panel" className="bg-white dark:bg-[#13131A] w-full max-w-lg h-full border-l border-zinc-200 dark:border-zinc-900 shadow-2xl p-8 overflow-y-auto flex flex-col justify-between">

            <div className="space-y-6">
              <div className="flex justify-between items-center pb-6 border-b border-zinc-100 dark:border-zinc-900">
                <div>
                  <span className="text-[10px] font-black uppercase text-zinc-400 font-mono">Participant dossier</span>
                  <h4 className="font-extrabold text-[#7C3AED] text-xl mt-0.5">{activeUserSession.user.superteam_username}</h4>
                </div>
                <button
                  id="btn-close-activity-slide"
                  onClick={() => setActiveUserSession(null)}
                  className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Bio */}
              <div className="space-y-3.5 text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-100 dark:border-zinc-900 font-medium">
                {[
                  { label: 'Email', value: activeUserSession.user.email },
                  { label: 'Twitter', value: activeUserSession.user.twitter_handle || 'None', className: 'text-[#7C3AED] font-mono' },
                  { label: 'Country', value: `${getCountryFlag(activeUserSession.user.country)} ${activeUserSession.user.country}` },
                  { label: 'Joined', value: formatDate(activeUserSession.user.created_at), className: 'font-mono text-[10px] text-zinc-400' }
                ].map(({ label, value, className }) => (
                  <div key={label} className="flex justify-between pt-2 border-t border-zinc-200/40 dark:border-zinc-800/40 first:border-0 first:pt-0">
                    <span className="text-zinc-400">{label}</span>
                    <span className={`font-bold text-zinc-900 dark:text-zinc-100 ${className ?? ''}`}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Activity Timeline */}
              <div className="space-y-4">
                <h5 className="font-black text-xs uppercase tracking-wider text-zinc-400 font-mono">Submission history</h5>

                {activeUserSession.completions.length === 0 ? (
                  <p className="text-xs text-zinc-400 py-10 text-center bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-dashed">
                    No quest solutions submitted yet.
                  </p>
                ) : (
                  <div className="relative border-l border-zinc-200 dark:border-zinc-800 pl-4 ml-2.5 space-y-6">
                    {activeUserSession.completions.map((activity: any) => (
                      <div key={activity.id} className="relative">
                        <div className="absolute -left-[21px] top-0.5 w-2.5 h-2.5 rounded-full bg-[#7C3AED] ring-4 ring-white dark:ring-[#13131A]"></div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-mono text-zinc-400">{formatDate(activity.completed_at)}</p>
                          <h6 className="font-extrabold text-[#7C3AED] text-sm leading-snug">{activity.taskLabel}</h6>
                          <p className="text-[10px] text-zinc-400 truncate">{activity.campaignTitle}</p>
                          <div className="pt-2">
                            {activity.proof_type === 'screenshot' ? (
                              <a
                                href={activity.proof_screenshot_url || '#'}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center space-x-1 bg-zinc-100 dark:bg-zinc-900 px-2.5 py-1 rounded border dark:border-zinc-800 text-[10px] text-zinc-500 hover:text-indigo-600 transition-colors cursor-pointer"
                              >
                                <span>View Screenshot</span>
                                <ArrowUpRight className="w-3 h-3 flex-shrink-0" />
                              </a>
                            ) : (
                              <a
                                href={activity.proof_link || '#'}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center space-x-1 bg-zinc-100 dark:bg-zinc-900 px-2.5 py-1 rounded border dark:border-zinc-800 text-[10px] text-[#7C3AED] transition-colors cursor-pointer max-w-xs truncate"
                              >
                                <span className="truncate max-w-[200px] block">{activity.proof_link}</span>
                                <ArrowUpRight className="w-3 h-3 flex-shrink-0" />
                              </a>
                            )}
                          </div>
                          {activity.is_flagged && (
                            <p className="text-[10px] text-red-500 italic mt-1 font-semibold">
                              Flagged: "{activity.flag_reason}"
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-zinc-100 dark:border-zinc-900">
              <button
                id="btn-slideover-close-bottom"
                onClick={() => setActiveUserSession(null)}
                className="w-full bg-zinc-50 dark:bg-zinc-900 hover:opacity-85 text-zinc-600 dark:text-zinc-300 font-bold py-3 text-xs rounded-xl border border-zinc-200/50 dark:border-zinc-800 cursor-pointer text-center"
              >
                Close dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
