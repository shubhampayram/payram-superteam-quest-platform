import { useEffect, useState } from 'react';
import { Campaign, Task, TaskCompletion } from '../types.ts';
import ThemeToggle from './ThemeToggle.tsx';
import { motion } from 'motion/react';
import { Calendar, Award, Compass, LogOut, Loader2, ArrowRight, AlertCircle } from 'lucide-react';

interface CampaignsViewProps {
  participant: {
    id: string;
    superteam_username: string;
    email: string;
    country: string;
  };
  onSelectCampaign: (campaign: Campaign) => void;
  onLogout: () => void;
}

export default function CampaignsView({ participant, onSelectCampaign, onLogout }: CampaignsViewProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [campaignTasksCounts, setCampaignTasksCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError('');

        const [campaignsRes, completionsRes] = await Promise.all([
          fetch('/api/campaigns'),
          fetch(`/api/completions?participant_id=${participant.id}`)
        ]);

        if (!campaignsRes.ok || !completionsRes.ok) {
          throw new Error('Failed to fetch data');
        }

        const allCampaigns: Campaign[] = await campaignsRes.json();
        const userCompletions: TaskCompletion[] = await completionsRes.json();

        const activeCampaigns = allCampaigns.filter(c => c.status === 'active');
        setCampaigns(activeCampaigns);
        setCompletions(userCompletions);

        // Parallel task count fetches — much faster than sequential
        const taskCountResults = await Promise.all(
          activeCampaigns.map(camp =>
            fetch(`/api/campaigns/${camp.id}/tasks`)
              .then(r => r.json())
              .then((tasks: Task[]) => ({ id: camp.id, count: tasks.length }))
              .catch(() => ({ id: camp.id, count: 0 }))
          )
        );

        const counts: Record<string, number> = {};
        taskCountResults.forEach(({ id, count }) => { counts[id] = count; });
        setCampaignTasksCounts(counts);
      } catch {
        setError('Failed to load campaigns. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [participant.id]);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="min-h-screen bg-[#F9FAFB] dark:bg-[#0A0A0F] text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      <nav className="border-b border-zinc-200 dark:border-zinc-900 bg-white/80 dark:bg-[#0A0A0F]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2 select-none" id="navbar-logo-main">
            <div className="w-8 h-8 bg-gradient-to-tr from-[#7C3AED] via-[#FF007F] to-[#39FF14] rounded-lg flex items-center justify-center transform rotate-3">
              <span className="text-white font-black text-sm">P</span>
            </div>
            <span className="font-extrabold text-md tracking-tight bg-gradient-to-r from-zinc-800 to-zinc-950 dark:from-white dark:to-zinc-300 bg-clip-text text-transparent">
              PayRam Hub
            </span>
          </div>

          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/60 px-4 py-2 rounded-xl">
              <div className="w-2.5 h-2.5 rounded-full bg-[#39FF14]"></div>
              <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                {participant.superteam_username}
              </span>
              <button
                id="link-not-you"
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

      <main className="max-w-7xl mx-auto px-6 py-12">
        <header className="mb-10 text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-zinc-950 dark:text-white" id="heading-active-campaigns">
            Active Campaigns
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-xl">
            Choose a campaign, complete tasks, and submit on Superteam to unlock your tokens.
          </p>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <Loader2 className="w-8 h-8 text-[#7C3AED] animate-spin" />
            <p className="text-xs font-medium text-zinc-500">Loading campaign stats and submissions...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div id="campaigns-empty-state" className="text-center py-20 bg-white dark:bg-[#13131A] rounded-2xl border border-zinc-200 dark:border-zinc-900 shadow-sm max-w-md mx-auto">
            <Compass className="w-12 h-12 text-[#7C3AED] mx-auto mb-4" />
            <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-200">No active campaigns right now.</h3>
            <p className="text-xs text-zinc-400 mt-2">Check back soon! New quests are added weekly.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {campaigns.map((camp) => {
              const totalTasks = campaignTasksCounts[camp.id] ?? 0;
              const completedTasksCount = completions.filter(comp => comp.campaign_id === camp.id).length;
              const isAllCompleted = totalTasks > 0 && completedTasksCount === totalTasks;
              const progressPercentage = totalTasks > 0 ? (completedTasksCount / totalTasks) * 100 : 0;

              return (
                <motion.div
                  key={camp.id}
                  id={`campaign-card-${camp.id}`}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="bg-white dark:bg-[#13131A] rounded-2xl border border-zinc-200 dark:border-zinc-900 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
                >
                  <div className="h-1.5 w-full bg-gradient-to-r from-[#7C3AED] to-pink-500"></div>

                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-extrabold text-xl tracking-tight text-zinc-950 dark:text-white leading-tight">
                          {camp.title}
                        </h3>
                        <div className="flex items-center space-x-1.5 text-zinc-400 mt-2">
                          <Calendar className="w-3.5 h-3.5" />
                          <span className="text-xs font-semibold">
                            {formatDate(camp.start_date)} – {formatDate(camp.end_date)}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs font-normal text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-sm">
                        {camp.description}
                      </p>
                    </div>

                    <div className="mt-6 pt-5 border-t border-zinc-100 dark:border-zinc-900 space-y-3.5">
                      <div className="flex justify-between text-xs font-extrabold uppercase">
                        <span className="text-zinc-500">Progress</span>
                        <span className="text-[#7C3AED] dark:text-[#39FF14]">
                          {completedTasksCount}/{totalTasks} Tasks
                        </span>
                      </div>
                      <div className="w-full bg-zinc-100 dark:bg-zinc-900 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-[#7C3AED] to-pink-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progressPercentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {isAllCompleted ? (
                    <a
                      id={`incentive-banner-${camp.id}`}
                      href={camp.superteam_submission_url}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-gradient-to-r from-[#39FF14]/15 to-[#39FF14]/5 hover:from-[#39FF14]/20 border-t border-[#39FF14]/30 px-6 py-4 flex items-center justify-between text-xs transition-colors group cursor-pointer"
                    >
                      <div className="flex items-start space-x-2.5">
                        <Award className="w-5 h-5 text-[#39FF14] flex-shrink-0 mt-0.5" />
                        <div className="text-left">
                          <p className="font-extrabold text-[#39FF14]">All Quests Completed! ✓</p>
                          <p className="text-[10px] text-zinc-400">Claim reward on Superteam →</p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-[#39FF14] group-hover:translate-x-1 transition-transform" />
                    </a>
                  ) : (
                    <div className="px-6 pb-6 pt-2">
                      <button
                        id={`btn-campaign-view-${camp.id}`}
                        onClick={() => onSelectCampaign(camp)}
                        className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-lg shadow-[#7C3AED]/10"
                      >
                        <span>View Tasks →</span>
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
