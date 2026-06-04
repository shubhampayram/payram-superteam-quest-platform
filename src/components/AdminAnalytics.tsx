import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import {
  FileDown, Loader2, AlertCircle, TrendingUp, Tag, Layers, Zap,
  CheckCircle, Flag, MessageSquare, RefreshCcw
} from 'lucide-react';
import type { AnalyticsData, LLMStat, CampaignStat, TaskStat, TagStat, ErrorReport } from '../types.ts';
import { getLLMInfo } from '../lib/llm-utils.ts';
import {
  exportLLMAnalyticsCSV, exportCampaignAnalyticsCSV,
  exportTaskAnalyticsCSV, exportTagAnalyticsCSV
} from '../lib/csv-export.ts';

interface AdminAnalyticsProps {
  adminToken: string;
}

type AnalyticsTab = 'llm' | 'campaigns' | 'tasks' | 'tags' | 'reports';

export default function AdminAnalytics({ adminToken }: AdminAnalyticsProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [errorReports, setErrorReports] = useState<ErrorReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('llm');

  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` };

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [analyticsRes, reportsRes] = await Promise.all([
        fetch('/api/admin/analytics', { headers: authHeaders }),
        fetch('/api/error-reports', { headers: authHeaders })
      ]);
      if (!analyticsRes.ok) { setError('Failed to load analytics.'); return; }
      setData(await analyticsRes.json());
      if (reportsRes.ok) setErrorReports(await reportsRes.json());
    } catch { setError('Network error loading analytics.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleResolveReport = async (id: string) => {
    try {
      await fetch(`/api/error-reports/${id}/resolve`, { method: 'PUT', headers: authHeaders });
      setErrorReports(prev => prev.map(r => r.id === id ? { ...r, is_resolved: true } : r));
    } catch { /* silent */ }
  };

  const TABS: { key: AnalyticsTab; label: string; icon: React.ReactNode }[] = [
    { key: 'llm', label: 'LLM Usage', icon: <Zap className="w-3.5 h-3.5" /> },
    { key: 'campaigns', label: 'Campaigns', icon: <Layers className="w-3.5 h-3.5" /> },
    { key: 'tasks', label: 'Tasks', icon: <CheckCircle className="w-3.5 h-3.5" /> },
    { key: 'tags', label: 'Tags', icon: <Tag className="w-3.5 h-3.5" /> },
    { key: 'reports', label: `Reports${errorReports.filter(r => !r.is_resolved).length > 0 ? ` (${errorReports.filter(r => !r.is_resolved).length})` : ''}`, icon: <MessageSquare className="w-3.5 h-3.5" /> }
  ];

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 space-y-4">
      <Loader2 className="w-10 h-10 text-[#7C3AED] animate-spin" />
      <p className="text-xs font-semibold text-zinc-500">Crunching platform analytics...</p>
    </div>
  );

  if (error) return (
    <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs flex items-center space-x-2">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      <span>{error}</span>
    </div>
  );

  if (!data) return null;

  const llmTotal = data.llmStats.reduce((s, r) => s + r.completions, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wider text-zinc-500 font-mono">Platform Analytics</h2>
          <p className="text-xs text-zinc-400 mt-1">LLM usage, campaign performance, task breakdown, tag distribution and error reports.</p>
        </div>
        <button onClick={loadData} className="flex items-center space-x-1.5 text-xs font-bold text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer">
          <RefreshCcw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total LLM Completions', value: llmTotal, color: 'text-[#7C3AED]' },
          { label: 'Active Campaigns', value: data.campaignStats.filter(c => c.status === 'active').length, color: 'text-[#39FF14]' },
          { label: 'Tags Created', value: data.tagStats.length, color: 'text-amber-500' },
          { label: 'Open Error Reports', value: errorReports.filter(r => !r.is_resolved).length, color: 'text-red-500' }
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white dark:bg-[#13131A] border border-zinc-200 dark:border-zinc-900 rounded-2xl p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">{label}</p>
            <p className={`text-3xl font-black mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex items-center bg-zinc-100 dark:bg-zinc-900/60 p-1 rounded-xl overflow-x-auto gap-0.5">
        {TABS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === key
                ? 'bg-white dark:bg-zinc-950 text-[#7C3AED] dark:text-[#39FF14] shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* ── LLM USAGE TAB ── */}
      {activeTab === 'llm' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#13131A] border border-zinc-200 dark:border-zinc-900 rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500 font-mono flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-[#7C3AED]" />
                <span>Completions by LLM Platform</span>
              </h3>
              <button
                onClick={() => exportLLMAnalyticsCSV(data.llmStats, llmTotal)}
                className="flex items-center space-x-1.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-2 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
              >
                <FileDown className="w-3.5 h-3.5 text-[#7C3AED]" />
                <span>Export CSV</span>
              </button>
            </div>

            {data.llmStats.length === 0 ? (
              <p className="py-12 text-center text-zinc-400 text-xs">No LLM completions yet.</p>
            ) : (
              <>
                <div className="h-64 w-full mb-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.llmStats} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#888', fontSize: 11, fontWeight: 600 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: '#888', fontSize: 11 }} allowDecimals={false} />
                      <Tooltip contentStyle={{ borderRadius: '10px', fontSize: '11px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                      <Bar dataKey="completions" radius={[6, 6, 0, 0]} barSize={36}>
                        {data.llmStats.map((entry) => (
                          <Cell key={entry.target} fill={getLLMInfo(entry.target).chartColor} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-semibold text-left">
                    <thead>
                      <tr className="border-b border-zinc-100 dark:border-zinc-900 text-zinc-400 uppercase text-[10px] font-black tracking-wider">
                        <th className="py-3 font-mono">LLM Platform</th>
                        <th className="py-3 font-mono text-right">Completions</th>
                        <th className="py-3 font-mono text-right">Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                      {data.llmStats.sort((a, b) => b.completions - a.completions).map(row => (
                        <tr key={row.target} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/30">
                          <td className="py-3">
                            <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${getLLMInfo(row.target).badgeClass}`}>
                              {row.label}
                            </span>
                          </td>
                          <td className="py-3 text-right font-black text-zinc-900 dark:text-zinc-100">{row.completions}</td>
                          <td className="py-3 text-right text-zinc-400">
                            {llmTotal > 0 ? ((row.completions / llmTotal) * 100).toFixed(1) + '%' : '—'}
                          </td>
                        </tr>
                      ))}
                      {/* Platforms with zero completions */}
                      {['chatgpt', 'perplexity', 'gemini', 'claude', 'deepseek', 'grok', 'copilot', 'meta']
                        .filter(t => !data.llmStats.find(s => s.target === t))
                        .map(t => {
                          const info = getLLMInfo(t);
                          return (
                            <tr key={t} className="opacity-40">
                              <td className="py-3">
                                <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${info.badgeClass}`}>
                                  {info.label}
                                </span>
                              </td>
                              <td className="py-3 text-right font-black text-zinc-900 dark:text-zinc-100">0</td>
                              <td className="py-3 text-right text-zinc-400">0%</td>
                            </tr>
                          );
                        })
                      }
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── CAMPAIGNS TAB ── */}
      {activeTab === 'campaigns' && (
        <div className="bg-white dark:bg-[#13131A] border border-zinc-200 dark:border-zinc-900 rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500 font-mono">Campaign Performance</h3>
            <button
              onClick={() => exportCampaignAnalyticsCSV(data.campaignStats)}
              className="flex items-center space-x-1.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-2 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 text-[#7C3AED]" />
              <span>Export CSV</span>
            </button>
          </div>

          {data.campaignStats.length === 0 ? (
            <p className="py-12 text-center text-zinc-400 text-xs">No campaigns yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-900 text-zinc-400 uppercase text-[10px] font-black tracking-wider">
                    <th className="py-3 font-mono">Campaign</th>
                    <th className="py-3 font-mono">Status</th>
                    <th className="py-3 font-mono text-right">Tasks</th>
                    <th className="py-3 font-mono text-right">Completions</th>
                    <th className="py-3 font-mono text-right">Participants</th>
                    <th className="py-3 font-mono text-right">Flagged</th>
                    <th className="py-3 font-mono">Completion Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900 font-semibold text-zinc-700 dark:text-zinc-300">
                  {data.campaignStats.map((row: CampaignStat) => {
                    const maxPossible = row.totalTasks * row.uniqueParticipants;
                    const rate = maxPossible > 0 ? Math.round((row.totalCompletions / maxPossible) * 100) : 0;
                    return (
                      <tr key={row.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/30">
                        <td className="py-3 pr-4 font-extrabold text-zinc-900 dark:text-zinc-100 max-w-[180px] truncate">{row.title}</td>
                        <td className="py-3 pr-4">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${row.status === 'active' ? 'text-[#39FF14] bg-[#39FF14]/10' : 'text-zinc-400 bg-zinc-100 dark:bg-zinc-900'}`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-right">{row.totalTasks}</td>
                        <td className="py-3 pr-4 text-right font-bold text-zinc-900 dark:text-zinc-100">{row.totalCompletions}</td>
                        <td className="py-3 pr-4 text-right">{row.uniqueParticipants}</td>
                        <td className="py-3 pr-4 text-right text-red-500">{row.flaggedCount}</td>
                        <td className="py-3 min-w-[120px]">
                          <div className="flex items-center space-x-2">
                            <div className="flex-1 bg-zinc-100 dark:bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-[#7C3AED] h-1.5 rounded-full" style={{ width: `${rate}%` }} />
                            </div>
                            <span className="text-[10px] font-black text-[#7C3AED] w-8 text-right">{rate}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TASKS TAB ── */}
      {activeTab === 'tasks' && (
        <div className="bg-white dark:bg-[#13131A] border border-zinc-200 dark:border-zinc-900 rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500 font-mono">Task Breakdown</h3>
            <button
              onClick={() => exportTaskAnalyticsCSV(data.taskStats)}
              className="flex items-center space-x-1.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-2 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 text-[#7C3AED]" />
              <span>Export CSV</span>
            </button>
          </div>

          {data.taskStats.length === 0 ? (
            <p className="py-12 text-center text-zinc-400 text-xs">No tasks yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-900 text-zinc-400 uppercase text-[10px] font-black tracking-wider">
                    <th className="py-3 font-mono">Task</th>
                    <th className="py-3 font-mono">Campaign</th>
                    <th className="py-3 font-mono">Platform</th>
                    <th className="py-3 font-mono text-right">Total</th>
                    <th className="py-3 font-mono text-right">📷</th>
                    <th className="py-3 font-mono text-right">🔗</th>
                    <th className="py-3 font-mono text-right">🚩</th>
                    <th className="py-3 font-mono">Tags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900 font-semibold text-zinc-700 dark:text-zinc-300">
                  {data.taskStats.sort((a, b) => b.totalCompletions - a.totalCompletions).map((row: TaskStat) => (
                    <tr key={row.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/30">
                      <td className="py-3 pr-4 max-w-[160px] truncate font-bold text-zinc-900 dark:text-zinc-100">{row.label}</td>
                      <td className="py-3 pr-4 max-w-[120px] truncate text-zinc-500">{row.campaignTitle}</td>
                      <td className="py-3 pr-4">
                        {row.type === 'llm_search' ? (
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${getLLMInfo(row.llm_target).badgeClass}`}>
                            {getLLMInfo(row.llm_target).label}
                          </span>
                        ) : (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border bg-indigo-500/10 text-indigo-500 border-indigo-500/20">Blog</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right font-black text-zinc-900 dark:text-zinc-100">{row.totalCompletions}</td>
                      <td className="py-3 pr-4 text-right">{row.screenshotCount}</td>
                      <td className="py-3 pr-4 text-right">{row.linkCount}</td>
                      <td className="py-3 pr-4 text-right text-red-500">{row.flaggedCount}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-1">
                          {row.tags.length === 0 ? <span className="text-zinc-300 dark:text-zinc-700">—</span> : row.tags.map(tag => (
                            <span key={tag} className="text-[9px] font-bold bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-800">{tag}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAGS TAB ── */}
      {activeTab === 'tags' && (
        <div className="bg-white dark:bg-[#13131A] border border-zinc-200 dark:border-zinc-900 rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500 font-mono">Tag Distribution</h3>
            <button
              onClick={() => exportTagAnalyticsCSV(data.tagStats)}
              className="flex items-center space-x-1.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-2 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 text-[#7C3AED]" />
              <span>Export CSV</span>
            </button>
          </div>

          {data.tagStats.length === 0 ? (
            <div className="py-16 text-center">
              <Tag className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-400 text-xs">No tags created yet. Create tags in the Campaigns tab and assign them to tasks.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-900 text-zinc-400 uppercase text-[10px] font-black tracking-wider">
                    <th className="py-3 font-mono">Tag</th>
                    <th className="py-3 font-mono text-right">Tasks</th>
                    <th className="py-3 font-mono text-right">Completions</th>
                    <th className="py-3 font-mono text-right">Flagged</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900 font-semibold text-zinc-700 dark:text-zinc-300">
                  {data.tagStats.sort((a, b) => b.completionsCount - a.completionsCount).map((row: TagStat) => (
                    <tr key={row.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/30">
                      <td className="py-3 pr-4">
                        <span className="inline-flex items-center space-x-1.5 text-xs font-bold px-2.5 py-1 rounded-full border"
                          style={{ backgroundColor: row.color + '20', color: row.color, borderColor: row.color + '40' }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: row.color }} />
                          <span>{row.name}</span>
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right">{row.tasksCount}</td>
                      <td className="py-3 pr-4 text-right font-black text-zinc-900 dark:text-zinc-100">{row.completionsCount}</td>
                      <td className="py-3 pr-4 text-right text-red-500">{row.flaggedCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── ERROR REPORTS TAB ── */}
      {activeTab === 'reports' && (
        <div className="bg-white dark:bg-[#13131A] border border-zinc-200 dark:border-zinc-900 rounded-2xl p-6 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500 font-mono mb-6 flex items-center space-x-2">
            <Flag className="w-4 h-4 text-amber-500" />
            <span>User Error Reports</span>
          </h3>

          {errorReports.length === 0 ? (
            <div className="py-16 text-center">
              <CheckCircle className="w-10 h-10 text-[#39FF14] mx-auto mb-3" />
              <p className="text-zinc-400 text-xs">No error reports submitted yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {errorReports.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(report => (
                <div key={report.id} className={`p-4 border rounded-xl text-xs ${report.is_resolved ? 'border-zinc-100 dark:border-zinc-900 opacity-50' : 'border-amber-500/20 bg-amber-500/5'}`}>
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 space-y-1">
                      <p className="font-bold text-zinc-900 dark:text-zinc-100 leading-relaxed">{report.description}</p>
                      <p className="text-zinc-400 font-mono">
                        Page: {report.page} · {new Date(report.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {report.participant_id && ` · ID: ${report.participant_id.slice(0, 8)}...`}
                      </p>
                    </div>
                    {!report.is_resolved && (
                      <button
                        onClick={() => handleResolveReport(report.id)}
                        className="flex-shrink-0 px-3 py-1.5 bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/20 rounded-lg text-[10px] font-black uppercase cursor-pointer hover:bg-[#39FF14]/20 transition-colors"
                      >
                        Resolve
                      </button>
                    )}
                    {report.is_resolved && (
                      <span className="text-[10px] font-black text-[#39FF14] bg-[#39FF14]/10 border border-[#39FF14]/20 px-2 py-1 rounded">Resolved</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
