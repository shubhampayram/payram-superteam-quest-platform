import React, { useState, useEffect, useRef } from 'react';
import { Campaign, Task, TaskCompletion } from '../types.ts';
import ThemeToggle from './ThemeToggle.tsx';
import { buildLLMUrl } from '../lib/llm-utils.ts';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Copy, Check, Upload, Link2, LogOut, AlertCircle,
  FileText, RefreshCcw, ExternalLink, Calendar, X
} from 'lucide-react';

interface TasksViewProps {
  participant: {
    id: string;
    superteam_username: string;
    email: string;
    country: string;
  };
  campaign: Campaign;
  onBack: () => void;
  onLogout: () => void;
}

export default function TasksView({ participant, campaign, onBack, onLogout }: TasksViewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeTaskForModal, setActiveTaskForModal] = useState<Task | null>(null);
  const [modalTab, setModalTab] = useState<'screenshot' | 'link'>('screenshot');
  const [pasteLink, setPasteLink] = useState('');
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);

  const [blogUrls, setBlogUrls] = useState<Record<string, string>>({});
  const [blogErrors, setBlogErrors] = useState<Record<string, string>>({});

  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadCampaignTasksAndCompletions = async () => {
    try {
      setLoading(true);
      setError('');

      const [tasksRes, completionsRes] = await Promise.all([
        fetch(`/api/campaigns/${campaign.id}/tasks`),
        fetch(`/api/completions?participant_id=${participant.id}`)
      ]);

      if (!tasksRes.ok || !completionsRes.ok) throw new Error('Failed to load');

      const allTasks: Task[] = await tasksRes.json();
      const userCompletions: TaskCompletion[] = await completionsRes.json();

      setTasks(allTasks);
      setCompletions(userCompletions.filter(c => c.campaign_id === campaign.id));
    } catch {
      setError('Failed to load tasks. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaignTasksAndCompletions();
  }, [campaign.id, participant.id]);

  const totalTasks = tasks.length;
  const completedCount = completions.length;
  const isAllTasksCompleted = totalTasks > 0 && completedCount === totalTasks;
  const progressPercent = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;

  const handleOpenLLM = (task: Task) => {
    window.open(buildLLMUrl(task.llm_target, task.llm_prompt), '_blank');
    setActiveTaskForModal(task);
    setModalTab('screenshot');
    setPasteLink('');
    setScreenshotBase64(null);
    setScreenshotName('');
    setUploadError('');
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const processImageFile = (file: File) => {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Only PNG, JPG, JPEG and WEBP files are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File is too large. Maximum allowed size is 5MB.');
      return;
    }
    setUploadError('');
    setScreenshotName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => setScreenshotBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) processImageFile(e.dataTransfer.files[0]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) processImageFile(e.target.files[0]);
  };

  const handleSubmitProof = async () => {
    if (!activeTaskForModal) return;
    if (modalTab === 'link') {
      if (!pasteLink.trim().startsWith('https://')) {
        setUploadError('Link must start with https://');
        return;
      }
    } else {
      if (!screenshotBase64) {
        setUploadError('Please upload a screenshot first.');
        return;
      }
    }

    setIsSubmittingProof(true);
    try {
      const response = await fetch('/api/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant_id: participant.id,
          task_id: activeTaskForModal.id,
          campaign_id: campaign.id,
          proof_type: modalTab,
          proof_link: modalTab === 'link' ? pasteLink : null,
          imageBase64: modalTab === 'screenshot' ? screenshotBase64 : null
        })
      });

      const data = await response.json();
      if (!response.ok) {
        setUploadError(data.error || 'Submission failed. Please try again.');
        return;
      }

      setActiveTaskForModal(null);
      await loadCampaignTasksAndCompletions();
    } catch {
      setUploadError('Network error. Please check your connection and retry.');
    } finally {
      setIsSubmittingProof(false);
    }
  };

  const handleSubmitBlogTask = async (task: Task) => {
    const blogUrl = blogUrls[task.id] || '';
    if (!blogUrl.trim().startsWith('https://')) {
      setBlogErrors(prev => ({ ...prev, [task.id]: 'Blog URL must start with https://' }));
      return;
    }
    setBlogErrors(prev => ({ ...prev, [task.id]: '' }));

    try {
      const response = await fetch('/api/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant_id: participant.id,
          task_id: task.id,
          campaign_id: campaign.id,
          proof_type: 'link',
          proof_link: blogUrl,
          imageBase64: null
        })
      });
      const data = await response.json();
      if (!response.ok) {
        setBlogErrors(prev => ({ ...prev, [task.id]: data.error || 'Submission failed.' }));
        return;
      }
      await loadCampaignTasksAndCompletions();
    } catch {
      setBlogErrors(prev => ({ ...prev, [task.id]: 'Network error. Please retry.' }));
    }
  };

  const handleCopyPrompt = (text: string, taskId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTaskId(taskId);
    setTimeout(() => setCopiedTaskId(null), 2000);
  };

  const getPlatformColors = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'chatgpt':
        return { bg: 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20', label: 'ChatGPT' };
      case 'perplexity':
        return { bg: 'bg-blue-500/10 text-blue-500 border-blue-500/20', label: 'Perplexity' };
      case 'gemini':
        return { bg: 'bg-amber-500/10 text-amber-500 border-amber-500/20', label: 'Gemini' };
      case 'claude':
        return { bg: 'bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20', label: 'Claude' };
      default:
        return { bg: 'bg-[#7C3AED]/10 text-[#7C3AED] border-[#7C3AED]/20', label: 'LLM Search' };
    }
  };

  const formatUTC = (isoString: string) => {
    const d = new Date(isoString);
    return (
      d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' at ' +
      d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
      ' UTC'
    );
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] dark:bg-[#0A0A0F] text-zinc-900 dark:text-zinc-100 transition-colors duration-200">

      {isAllTasksCompleted && (
        <div id="amber-completion-banner" className="bg-amber-500 dark:bg-amber-600 border-b border-amber-600 px-6 py-4 flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 text-white shadow-md relative z-10">
          <div className="flex items-center space-x-3 text-center md:text-left">
            <span className="text-2xl animate-bounce">🎉</span>
            <div className="text-zinc-900 font-bold">
              <p className="text-sm">You completed all tasks in this campaign!</p>
              <p className="text-xs text-zinc-800 font-medium">Submit your proof on Solana Superteam to unlock your tokens.</p>
            </div>
          </div>
          <a
            id="btn-superteam-claim"
            href={campaign.superteam_submission_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center space-x-1 bg-zinc-950 hover:bg-zinc-900 text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider shadow-md cursor-pointer"
          >
            <span>Submit on Superteam →</span>
          </a>
        </div>
      )}

      <nav className="border-b border-zinc-200 dark:border-zinc-900 bg-white/80 dark:bg-[#0A0A0F]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <button
            id="btn-back-campaigns"
            onClick={onBack}
            className="flex items-center space-x-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer text-xs font-bold uppercase tracking-wider"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>All Campaigns</span>
          </button>

          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/60 px-4 py-2 rounded-xl">
              <div className="w-2.5 h-2.5 rounded-full bg-[#39FF14]"></div>
              <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                {participant.superteam_username}
              </span>
              <button
                id="link-logout-tasks"
                onClick={onLogout}
                className="text-[10px] uppercase font-bold text-pink-500 hover:text-pink-600 pl-2 border-l border-zinc-300 dark:border-zinc-800 flex items-center space-x-0.5 cursor-pointer"
              >
                <LogOut className="w-3 h-3 flex-shrink-0" />
                <span>Not you?</span>
              </button>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-10 text-center md:text-left bg-white dark:bg-[#13131A] rounded-2xl border border-zinc-200 dark:border-zinc-900 p-8 shadow-sm">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-zinc-950 dark:text-white">
            {campaign.title}
          </h2>
          <p className="text-xs font-medium text-zinc-500 mt-2 leading-relaxed max-w-2xl">
            {campaign.description}
          </p>
          <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-900 space-y-3.5 max-w-sm">
            <div className="flex justify-between text-xs font-bold uppercase">
              <span className="text-zinc-400">Completion Status</span>
              <span className="text-[#7C3AED] dark:text-[#39FF14] font-bold">
                {completedCount} of {totalTasks} Completed
              </span>
            </div>
            <div className="w-full bg-zinc-100 dark:bg-zinc-900/60 h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#7C3AED] h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <RefreshCcw className="w-8 h-8 text-[#7C3AED] animate-spin" />
            <p className="text-xs font-medium text-zinc-500">Loading tasks...</p>
          </div>
        ) : tasks.length === 0 ? (
          <p className="text-center text-zinc-400 text-xs py-12 border border-dashed rounded-xl">
            No tasks found for this campaign. Contact a PayRam admin.
          </p>
        ) : (
          <div className="space-y-6">
            {tasks.map((task) => {
              const comp = completions.find(c => c.task_id === task.id);
              const isCompleted = !!comp;

              if (task.type === 'llm_search') {
                const platColors = getPlatformColors(task.llm_target);

                if (isCompleted) {
                  return (
                    <div
                      key={task.id}
                      id={`task-llm-comp-${task.id}`}
                      className="border-l-4 border-[#39FF14] bg-white dark:bg-[#13131A] rounded-2xl border border-zinc-200 dark:border-zinc-900 p-6 flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2.5">
                          <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${platColors.bg}`}>
                            {platColors.label} Search
                          </span>
                          <span className="text-xs font-bold text-[#39FF14] bg-[#39FF14]/10 px-2 py-0.5 rounded-md flex items-center space-x-0.5">
                            <Check className="w-3 h-3" />
                            <span>Completed ✓</span>
                          </span>
                        </div>
                        <h4 className="font-extrabold text-lg text-zinc-950 dark:text-zinc-100">{task.label}</h4>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{task.description}</p>
                        <div className="flex flex-wrap gap-2.5 pt-1">
                          <p className="text-[10px] font-medium text-zinc-400">
                            Completed {formatUTC(comp!.completed_at)}
                          </p>
                          <span className="text-[10px] uppercase font-bold text-[#7C3AED] dark:text-[#39FF14] bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 rounded border border-zinc-200/40 dark:border-zinc-800">
                            Proof: {comp!.proof_type === 'screenshot' ? 'Screenshot' : 'Link'}
                          </span>
                          {comp!.is_flagged && (
                            <span className="text-[10px] font-bold text-red-500 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded">
                              Flagged: {comp!.flag_reason}
                            </span>
                          )}
                        </div>
                      </div>
                      <button disabled className="bg-zinc-100 dark:bg-zinc-900 text-zinc-400 px-5 py-3 rounded-xl text-xs font-bold cursor-not-allowed border border-zinc-200/50 dark:border-zinc-800">
                        Done ✓
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={task.id}
                    id={`task-llm-incomp-${task.id}`}
                    className="bg-white dark:bg-[#13131A] rounded-2xl border border-zinc-200 dark:border-zinc-900 p-6 flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0 hover:border-zinc-300 dark:hover:border-zinc-800 transition-colors"
                  >
                    <div className="space-y-2 flex-1 pr-6">
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${platColors.bg}`}>
                        {platColors.label} Search
                      </span>
                      <h4 className="font-extrabold text-lg text-zinc-950 dark:text-zinc-100 pt-1">{task.label}</h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-normal">{task.description}</p>
                    </div>
                    <button
                      id={`btn-open-llm-${task.id}`}
                      onClick={() => handleOpenLLM(task)}
                      className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-5 py-3.5 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center space-x-1 flex-shrink-0 cursor-pointer shadow-sm shadow-[#7C3AED]/15"
                    >
                      <span>Open in {platColors.label} →</span>
                    </button>
                  </div>
                );
              }

              if (task.type === 'blog') {
                if (isCompleted) {
                  return (
                    <div
                      key={task.id}
                      id={`task-blog-comp-${task.id}`}
                      className="border-l-4 border-[#39FF14] bg-white dark:bg-[#13131A] rounded-2xl border border-zinc-200 dark:border-zinc-900 p-6 flex flex-col space-y-4"
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">
                            Blog Campaign
                          </span>
                          <span className="text-xs font-bold text-[#39FF14] bg-[#39FF14]/10 px-2 py-0.5 rounded ml-2.5 inline-flex items-center space-x-0.5">
                            <Check className="w-3 h-3" />
                            <span>Submitted ✓</span>
                          </span>
                        </div>
                        <p className="text-[10px] font-medium text-zinc-400">{formatUTC(comp!.completed_at)}</p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-extrabold text-lg text-zinc-950 dark:text-zinc-100">{task.label}</h4>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{task.description}</p>
                        <div className="pt-3">
                          <a
                            href={comp!.proof_link || '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center space-x-1.5 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-[#7C3AED] dark:text-[#39FF14] px-4 py-2.5 rounded-xl transition-all cursor-pointer"
                          >
                            <FileText className="w-4 h-4 flex-shrink-0" />
                            <span>View Submitted Article</span>
                            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 text-zinc-500" />
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={task.id}
                    id={`task-blog-incomp-${task.id}`}
                    className="bg-white dark:bg-[#13131A] rounded-2xl border border-zinc-200 dark:border-zinc-900 p-6 flex flex-col space-y-6"
                  >
                    <div className="space-y-2">
                      <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">
                        Blog Initiative Quest
                      </span>
                      <h4 className="font-extrabold text-lg text-zinc-950 dark:text-zinc-100 pt-1">{task.label}</h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{task.description}</p>
                    </div>

                    <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-xl p-5">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold text-[#7C3AED] uppercase tracking-wider">Required Topic Prompt</span>
                        <button
                          id={`btn-copy-prompt-${task.id}`}
                          onClick={() => handleCopyPrompt(task.blog_prompt, task.id)}
                          className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white p-1 rounded transition-colors flex items-center space-x-1 text-xs font-semibold cursor-pointer"
                        >
                          {copiedTaskId === task.id ? (
                            <><Check className="w-3.5 h-3.5 text-[#39FF14]" /><span className="text-[#39FF14]">Copied!</span></>
                          ) : (
                            <><Copy className="w-3.5 h-3.5" /><span>Copy</span></>
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-zinc-700 dark:text-zinc-300 font-mono leading-relaxed select-all">
                        {task.blog_prompt}
                      </p>
                    </div>

                    {task.blog_platforms_whitelist && task.blog_platforms_whitelist.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] uppercase font-bold text-zinc-500">Accepted Publishing Channels</p>
                        <div className="flex flex-wrap gap-2">
                          {task.blog_platforms_whitelist.map(plat => (
                            <span key={plat} className="text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 px-2.5 py-1 rounded-md border border-zinc-200/30 dark:border-zinc-800">
                              {plat}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-4 border-t border-zinc-100 dark:border-zinc-900 space-y-4">
                      <div>
                        <label className="block text-xs font-bold uppercase text-zinc-500 mb-2">
                          Paste your published article URL
                        </label>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <input
                            id={`input-blog-url-${task.id}`}
                            type="text"
                            placeholder="https://medium.com/@username/payram-article..."
                            value={blogUrls[task.id] || ''}
                            onChange={(e) => setBlogUrls(prev => ({ ...prev, [task.id]: e.target.value }))}
                            className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3 px-4 text-xs focus:outline-none focus:border-[#7C3AED]"
                          />
                          <button
                            id={`btn-submit-blog-${task.id}`}
                            onClick={() => handleSubmitBlogTask(task)}
                            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-extrabold text-xs uppercase px-5 py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center"
                          >
                            Submit Blog URL
                          </button>
                        </div>
                        {blogErrors[task.id] && (
                          <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center space-x-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>{blogErrors[task.id]}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>
        )}
      </main>

      {/* Proof submission modal */}
      <AnimatePresence>
        {activeTaskForModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="bg-white dark:bg-[#13131A] w-full max-w-lg rounded-t-3xl border-t border-zinc-200 dark:border-zinc-800 p-8 shadow-2xl"
            >
              <div className="w-12 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full mx-auto mb-6"></div>

              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-extrabold text-2xl text-zinc-950 dark:text-white">Submit your proof</h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Complete the search in <span className="font-bold text-[#39FF14]">{getPlatformColors(activeTaskForModal.llm_target).label}</span>, then submit below.
                  </p>
                </div>
                <button
                  id="btn-close-modal"
                  onClick={() => setActiveTaskForModal(null)}
                  className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 p-1.5 rounded-xl mb-6">
                <button
                  id="tab-proof-screenshot"
                  onClick={() => setModalTab('screenshot')}
                  className={`py-2 rounded-lg text-xs font-black transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                    modalTab === 'screenshot'
                      ? 'bg-white dark:bg-zinc-950 text-[#7C3AED] dark:text-[#39FF14] shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-600'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Screenshot</span>
                </button>
                <button
                  id="tab-proof-link"
                  onClick={() => setModalTab('link')}
                  className={`py-2 rounded-lg text-xs font-black transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                    modalTab === 'link'
                      ? 'bg-white dark:bg-zinc-950 text-[#7C3AED] dark:text-[#39FF14] shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-600'
                  }`}
                >
                  <Link2 className="w-4 h-4" />
                  <span>Paste Link</span>
                </button>
              </div>

              {uploadError && (
                <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{uploadError}</span>
                </div>
              )}

              {modalTab === 'screenshot' && (
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center flex flex-col items-center justify-center space-y-3 cursor-pointer transition-colors ${
                    dragActive
                      ? 'border-[#7C3AED] bg-[#7C3AED]/5'
                      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {screenshotBase64 ? (
                    <div className="space-y-3">
                      <img src={screenshotBase64} alt="Preview" className="max-h-32 mx-auto rounded-lg object-contain border border-zinc-200 dark:border-zinc-800 shadow" referrerPolicy="no-referrer" />
                      <p className="text-xs font-bold text-zinc-500 max-w-[200px] truncate">{screenshotName}</p>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setScreenshotBase64(null); setScreenshotName(''); }}
                        className="bg-red-500/15 text-red-400 text-[10px] uppercase font-bold py-1 px-3 rounded-md hover:bg-red-500/20 transition-colors mx-auto block"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#7C3AED]/20 to-pink-500/10 flex items-center justify-center">
                        <Upload className="w-5 h-5 text-[#7C3AED]" />
                      </div>
                      <div>
                        <p className="text-xs font-extrabold text-zinc-700 dark:text-zinc-200">
                          Drag & Drop or <span className="text-[#7C3AED]">browse files</span>
                        </p>
                        <p className="text-[10px] text-zinc-400 mt-1">PNG, JPG or WEBP — max 5MB</p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {modalTab === 'link' && (
                <div className="space-y-2.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
                    Conversation Share URL
                  </label>
                  <input
                    id="input-proof-link-text"
                    type="text"
                    placeholder="https://chat.openai.com/share/..."
                    value={pasteLink}
                    onChange={(e) => setPasteLink(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3 px-4 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-[#7C3AED]"
                  />
                  <p className="text-[10px] text-zinc-400 leading-normal">
                    Use the share link from {getPlatformColors(activeTaskForModal.llm_target).label}. Keep the conversation public so admins can verify it.
                  </p>
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-900 flex flex-col space-y-4">
                <button
                  id="btn-confirm-completion"
                  type="button"
                  disabled={isSubmittingProof}
                  onClick={handleSubmitProof}
                  className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white py-3.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingProof ? 'Uploading...' : 'Mark as Complete ✓'}
                </button>
                <button
                  id="btn-modal-cancel"
                  type="button"
                  onClick={() => setActiveTaskForModal(null)}
                  className="text-center text-xs font-semibold text-zinc-400 hover:text-zinc-600 cursor-pointer"
                >
                  I'll do this later
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
