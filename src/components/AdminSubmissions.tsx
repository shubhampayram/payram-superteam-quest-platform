import { useEffect, useState } from 'react';
import { Campaign, Task, TaskCompletion, Participant } from '../types.ts';
import { getCountryFlag } from '../lib/countries.ts';
import { exportSubmissionsCSV, SubmissionRow } from '../lib/csv-export.ts';
import {
  FileDown, Search, Flag, Eye, ShieldX, ShieldCheck, X,
  Loader2, ArrowUpRight, AlertCircle
} from 'lucide-react';

interface AdminSubmissionsProps {
  adminToken: string;
}

export default function AdminSubmissions({ adminToken }: AdminSubmissionsProps) {
  const [completions, setCompletions] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchUser, setSearchUser] = useState('');
  const [filterCampaign, setFilterCampaign] = useState('all');
  const [filterProofType, setFilterProofType] = useState('all');
  const [filterFlagged, setFilterFlagged] = useState('all');
  const [filterCountry, setFilterCountry] = useState('all');

  const [previewCompletion, setPreviewCompletion] = useState<any | null>(null);
  const [isFlagging, setIsFlagging] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [isSubmittingFlag, setIsSubmittingFlag] = useState(false);

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`
  };

  const loadSubmissionsData = async () => {
    try {
      setLoading(true);
      setError('');

      const [compRes, partRes, campRes] = await Promise.all([
        fetch('/api/completions', { headers: authHeaders }),
        fetch('/api/participants', { headers: authHeaders }),
        fetch('/api/campaigns', { headers: authHeaders })
      ]);

      if (!compRes.ok) {
        setError('Session expired or unauthorized. Please log out and log in again.');
        return;
      }

      const allComps: TaskCompletion[] = await compRes.json();
      const allParts: Participant[] = await partRes.json();
      const allCamps: Campaign[] = await campRes.json();

      setCountries(Array.from(new Set(allParts.map(p => p.country))).sort());
      setCampaigns(allCamps);

      const taskLists = await Promise.all(
        allCamps.map(c =>
          fetch(`/api/campaigns/${c.id}/tasks`)
            .then(r => r.json())
            .catch(() => [])
        )
      );
      const allTasks: Task[] = taskLists.flat();

      const full = allComps.map(c => {
        const participant = allParts.find(p => p.id === c.participant_id);
        const task = allTasks.find(t => t.id === c.task_id);
        const campaign = allCamps.find(camp => camp.id === c.campaign_id);
        return {
          ...c,
          username: participant?.superteam_username ?? 'Unknown',
          email: participant?.email ?? 'Unknown',
          country: participant?.country ?? 'Unknown',
          twitter: participant?.twitter_handle ?? '',
          taskName: task?.label ?? 'Unknown Task',
          campaignName: campaign?.title ?? 'Unknown Campaign'
        };
      });

      full.sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());
      setCompletions(full);
    } catch {
      setError('Network error loading submissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSubmissionsData(); }, []);

  const filteredCompletions = completions.filter(item => {
    const matchesUser = item.username.toLowerCase().includes(searchUser.toLowerCase());
    const matchesCampaign = filterCampaign === 'all' || item.campaign_id === filterCampaign;
    const matchesProof = filterProofType === 'all' || item.proof_type === filterProofType;
    const matchesCountry = filterCountry === 'all' || item.country === filterCountry;
    let matchesFlag = true;
    if (filterFlagged === 'flagged') matchesFlag = item.is_flagged === true;
    else if (filterFlagged === 'clean') matchesFlag = item.is_flagged === false;
    return matchesUser && matchesCampaign && matchesProof && matchesCountry && matchesFlag;
  });

  const handleFlagAction = async (item: any, flaggingState: boolean) => {
    setIsSubmittingFlag(true);
    try {
      const res = await fetch(`/api/completions/${item.id}/flag`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          is_flagged: flaggingState,
          flag_reason: flaggingState ? (flagReason.trim() || 'Please verify and re-submit.') : null
        })
      });

      if (res.ok) {
        const updated = await res.json();
        // Optimistic update — no page reload needed
        setCompletions(prev =>
          prev.map(c =>
            c.id === item.id
              ? { ...c, is_flagged: flaggingState, flag_reason: updated.flag_reason }
              : c
          )
        );
        setPreviewCompletion((prev: any) =>
          prev?.id === item.id
            ? { ...prev, is_flagged: flaggingState, flag_reason: updated.flag_reason }
            : prev
        );
        setFlagReason('');
        setIsFlagging(false);
      }
    } finally {
      setIsSubmittingFlag(false);
    }
  };

  // Client-side CSV export — no API needed
  const handleExportCSV = () => {
    const rows: SubmissionRow[] = filteredCompletions.map(c => ({
      username: c.username,
      email: c.email,
      country: c.country,
      twitter: c.twitter,
      taskName: c.taskName,
      campaignName: c.campaignName,
      proof_type: c.proof_type,
      proof_url: c.proof_type === 'screenshot' ? (c.proof_screenshot_url ?? '') : (c.proof_link ?? ''),
      completed_at: c.completed_at,
      is_flagged: c.is_flagged,
      flag_reason: c.flag_reason ?? ''
    }));
    exportSubmissionsCSV(rows);
  };

  const formatFullDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' ' +
    new Date(iso).toLocaleTimeString('en-US', { hour12: false, hour: 'numeric', minute: 'numeric' }) +
    ' UTC';

  return (
    <div className="space-y-6">

      {/* Filters */}
      <div className="bg-white dark:bg-[#13131A] border border-zinc-200 dark:border-zinc-900 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500 font-mono">Submission Review Desk</h3>
            <p className="text-xs text-zinc-400 mt-1">Audit proof URLs, preview screenshots and manage verification compliance.</p>
          </div>
          <button
            id="btn-submissions-export-csv"
            onClick={handleExportCSV}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-900">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-zinc-400" />
            <input
              id="submission-search-user"
              type="text"
              placeholder="Search username..."
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-xl py-2.5 pl-9 pr-3 text-xs focus:outline-none"
            />
          </div>

          <select
            id="submission-filter-campaign"
            value={filterCampaign}
            onChange={(e) => setFilterCampaign(e.target.value)}
            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-xl py-2.5 px-3 text-xs text-zinc-600 dark:text-zinc-300 focus:outline-none"
          >
            <option value="all">⚡ All Campaigns</option>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>

          <select
            id="submission-filter-proof"
            value={filterProofType}
            onChange={(e) => setFilterProofType(e.target.value)}
            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-xl py-2.5 px-3 text-xs text-zinc-600 dark:text-zinc-300 focus:outline-none"
          >
            <option value="all">📁 All Proof Types</option>
            <option value="screenshot">Screenshot</option>
            <option value="link">Conversation Link</option>
          </select>

          <select
            id="submission-filter-flagged"
            value={filterFlagged}
            onChange={(e) => setFilterFlagged(e.target.value)}
            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-xl py-2.5 px-3 text-xs text-zinc-600 dark:text-zinc-300 focus:outline-none"
          >
            <option value="all">🚩 All Flags</option>
            <option value="flagged">Flagged Only</option>
            <option value="clean">Clean / Approved</option>
          </select>

          <select
            id="submission-filter-country"
            value={filterCountry}
            onChange={(e) => setFilterCountry(e.target.value)}
            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-xl py-2.5 px-3 text-xs text-zinc-600 dark:text-zinc-300 focus:outline-none"
          >
            <option value="all">🗺️ All Countries</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#13131A] border border-zinc-200 dark:border-zinc-900 rounded-2xl p-6 shadow-sm overflow-hidden text-xs">
        {loading ? (
          <div className="py-20 flex flex-col items-center space-y-3 text-zinc-400">
            <Loader2 className="w-6 h-6 animate-spin text-[#7C3AED]" />
            <span>Compiling submission index...</span>
          </div>
        ) : filteredCompletions.length === 0 ? (
          <p className="py-20 text-center text-zinc-400">No submissions match the selected filters.</p>
        ) : (
          <div className="overflow-x-auto font-semibold">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-900 font-black uppercase text-[10px] text-zinc-400 tracking-wider">
                  <th className="py-4 font-mono">Participant</th>
                  <th className="py-4 font-mono">Email / X</th>
                  <th className="py-4 font-mono">Campaign</th>
                  <th className="py-4 font-mono">Task</th>
                  <th className="py-4 font-mono">Proof</th>
                  <th className="py-4 font-mono">Status</th>
                  <th className="py-4 font-mono text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900/45 text-zinc-700 dark:text-zinc-300">
                {filteredCompletions.map(comp => (
                  <tr key={comp.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10 transition-colors">
                    <td className="py-4 pr-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm select-none">{getCountryFlag(comp.country)}</span>
                        <div>
                          <p className="font-extrabold text-zinc-950 dark:text-zinc-100">{comp.username}</p>
                          <p className="text-[10px] text-zinc-500">{comp.country}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pr-3">
                      <p className="text-zinc-600 dark:text-zinc-300">{comp.email}</p>
                      <p className="text-[10px] font-mono text-[#7C3AED]">{comp.twitter || '@no_twitter'}</p>
                    </td>
                    <td className="py-4 pr-3 max-w-[130px] truncate">{comp.campaignName}</td>
                    <td className="py-4 pr-3 max-w-[130px] truncate">{comp.taskName}</td>
                    <td className="py-4 pr-3">
                      <span className={`px-2 py-0.5 border rounded uppercase text-[9px] font-black tracking-wider ${
                        comp.proof_type === 'screenshot'
                          ? 'bg-[#7C3AED]/5 text-[#7C3AED] border-[#7C3AED]/20'
                          : 'bg-emerald-500/5 text-emerald-500 border-emerald-500/20'
                      }`}>
                        {comp.proof_type}
                      </span>
                    </td>
                    <td className="py-4 pr-3">
                      {comp.is_flagged ? (
                        <span className="text-[10px] text-red-500 bg-red-500/10 border border-red-500/25 px-2 py-0.5 rounded font-bold" title={comp.flag_reason}>
                          Flagged
                        </span>
                      ) : (
                        <span className="text-[10px] text-green-500 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded font-bold">
                          Approved
                        </span>
                      )}
                    </td>
                    <td className="py-4 text-right">
                      <button
                        id={`btn-submissions-view-proof-${comp.id}`}
                        onClick={() => setPreviewCompletion(comp)}
                        className="px-2.5 py-1.5 bg-[#7C3AED]/5 hover:bg-[#7C3AED]/10 text-[#7C3AED] dark:text-[#39FF14] dark:bg-zinc-900 rounded border border-zinc-200/50 dark:border-zinc-800 cursor-pointer text-xs font-bold inline-flex items-center space-x-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Proof</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Proof Preview Modal */}
      {previewCompletion && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div id="proof-view-modal" className="w-full max-w-2xl bg-white dark:bg-[#13131A] rounded-2xl border border-zinc-200 dark:border-zinc-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

            <div className="p-5 border-b border-zinc-100 dark:border-zinc-900 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Proof validation console</span>
                <h4 className="font-extrabold text-[#7C3AED] text-base mt-0.5">{previewCompletion.username}'s submission</h4>
              </div>
              <button
                id="btn-close-proof-modal"
                onClick={() => { setPreviewCompletion(null); setIsFlagging(false); setFlagReason(''); }}
                className="p-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-4 text-xs bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200/50 dark:border-zinc-900/50">
                <div><p className="text-[10px] text-zinc-400 uppercase font-bold">Campaign</p><p className="font-extrabold text-zinc-800 dark:text-zinc-200">{previewCompletion.campaignName}</p></div>
                <div><p className="text-[10px] text-zinc-400 uppercase font-bold">Task</p><p className="font-extrabold text-zinc-800 dark:text-zinc-200">{previewCompletion.taskName}</p></div>
                <div className="mt-2.5">
                  <p className="text-[10px] text-zinc-400 uppercase font-bold">Country</p>
                  <p className="font-extrabold text-zinc-800 dark:text-zinc-200 flex items-center space-x-1.5">
                    <span>{getCountryFlag(previewCompletion.country)}</span>
                    <span>{previewCompletion.country}</span>
                  </p>
                </div>
                <div className="mt-2.5"><p className="text-[10px] text-zinc-400 uppercase font-bold">Timestamp</p><p className="font-mono text-[10px] text-zinc-400 font-bold">{formatFullDate(previewCompletion.completed_at)}</p></div>
              </div>

              {previewCompletion.proof_type === 'screenshot' ? (
                <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800/50 flex flex-col items-center">
                  <p className="text-[9px] font-bold text-zinc-500 font-mono mb-2">UPLOADED SCREENSHOT</p>
                  {previewCompletion.proof_screenshot_url ? (
                    <img
                      src={previewCompletion.proof_screenshot_url}
                      alt="Verification screenshot"
                      className="max-h-72 w-full object-contain rounded border border-zinc-800 shadow"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <p className="text-zinc-400 py-16 text-center text-xs">No screenshot recorded.</p>
                  )}
                </div>
              ) : (
                <div className="p-5 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-[#7C3AED]/20 flex items-center justify-between">
                  <div className="space-y-1 pr-6 flex-1">
                    <p className="text-[10px] text-[#7C3AED] dark:text-[#39FF14] font-bold uppercase tracking-wider">Conversation Link</p>
                    <p className="text-xs font-mono text-zinc-800 dark:text-zinc-200 break-all select-all font-bold mt-1.5">{previewCompletion.proof_link}</p>
                  </div>
                  <a
                    href={previewCompletion.proof_link || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-shrink-0 bg-[#7C3AED] hover:opacity-85 text-white font-extrabold text-xs px-4 py-2.5 rounded-lg inline-flex items-center space-x-1 cursor-pointer"
                  >
                    <span>Open</span>
                    <ArrowUpRight className="w-4 h-4 flex-shrink-0" />
                  </a>
                </div>
              )}

              {previewCompletion.is_flagged && (
                <div className="p-4 bg-red-500/10 border border-red-500/25 text-red-500 rounded-xl text-xs flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-extrabold mb-0.5">Submission Flagged</h5>
                    <p className="text-red-400 leading-normal">{previewCompletion.flag_reason}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-zinc-100 dark:border-zinc-900 bg-zinc-50 dark:bg-zinc-900/40 flex flex-col space-y-4">
              {isFlagging ? (
                <div className="space-y-3.5 bg-white dark:bg-zinc-950 p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                  <label className="block text-[10px] font-black uppercase text-zinc-400">Reason for flag</label>
                  <textarea
                    placeholder="Incomplete viewport — please recapture the full output..."
                    value={flagReason}
                    onChange={(e) => setFlagReason(e.target.value)}
                    rows={3}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs focus:outline-none"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setIsFlagging(false)}
                      className="px-3 py-1.5 border text-zinc-400 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSubmittingFlag || !flagReason.trim()}
                      onClick={() => handleFlagAction(previewCompletion, true)}
                      className="px-3.5 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold uppercase cursor-pointer disabled:opacity-40"
                    >
                      {isSubmittingFlag ? 'Flagging...' : 'Confirm Flag'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center gap-4">
                  <div>
                    {previewCompletion.is_flagged ? (
                      <button
                        id="btn-modal-unflag-direct"
                        onClick={() => handleFlagAction(previewCompletion, false)}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase inline-flex items-center space-x-1 cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Approve Submission</span>
                      </button>
                    ) : (
                      <button
                        id="btn-modal-flag-direct"
                        onClick={() => setIsFlagging(true)}
                        className="bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase inline-flex items-center space-x-1 cursor-pointer"
                      >
                        <ShieldX className="w-4 h-4" />
                        <span>Flag Submission</span>
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setPreviewCompletion(null); setIsFlagging(false); setFlagReason(''); }}
                    className="text-xs font-semibold text-zinc-500 hover:text-zinc-800 px-3 py-2 border rounded-xl border-zinc-200 dark:border-zinc-800 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
