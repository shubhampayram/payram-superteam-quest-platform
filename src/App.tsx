import { useState, useEffect } from 'react';
import HomeView from './components/HomeView.tsx';
import CampaignsView from './components/CampaignsView.tsx';
import TasksView from './components/TasksView.tsx';
import AdminLogin from './components/AdminLogin.tsx';
import AdminDashboard from './components/AdminDashboard.tsx';
import AdminCampaigns from './components/AdminCampaigns.tsx';
import AdminSubmissions from './components/AdminSubmissions.tsx';
import AdminUsers from './components/AdminUsers.tsx';
import { Campaign, Participant } from './types.ts';
import { LogOut, LayoutDashboard, Flag, Users, Compass } from 'lucide-react';
import { motion } from 'motion/react';

type ScreenType = 'home' | 'campaigns' | 'tasks' | 'admin_login' | 'admin_dashboard';
type AdminTab = 'dashboard' | 'campaigns' | 'submissions' | 'users';

// localStorage keys
const PARTICIPANT_KEY = 'payram_participant_id';
const ADMIN_SESSION_KEY = 'payram-admin-session';

export default function App() {
  const [screen, setScreen] = useState<ScreenType>('home');
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTab>('dashboard');
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [admin, setAdmin] = useState<{ id: string; email: string; token: string } | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      // 1. Restore participant by stored ID
      const storedId = localStorage.getItem(PARTICIPANT_KEY);
      if (storedId) {
        try {
          const res = await fetch(`/api/participants/${storedId}`);
          if (res.ok) {
            const p: Participant = await res.json();
            setParticipant(p);
            setScreen('campaigns');
          } else {
            localStorage.removeItem(PARTICIPANT_KEY);
          }
        } catch {
          localStorage.removeItem(PARTICIPANT_KEY);
        }
      }

      // 2. Restore admin session (token validated on first API call)
      const storedAdmin = localStorage.getItem(ADMIN_SESSION_KEY);
      if (storedAdmin) {
        try {
          const parsed = JSON.parse(storedAdmin);
          if (parsed?.token) {
            setAdmin(parsed);
            setScreen('admin_dashboard');
          }
        } catch {
          localStorage.removeItem(ADMIN_SESSION_KEY);
        }
      }

      setLoadingSession(false);
    }
    restoreSession();
  }, []);

  const handleEnterParticipant = (p: Participant) => {
    localStorage.setItem(PARTICIPANT_KEY, p.id);
    setParticipant(p);
    setScreen('campaigns');
  };

  const handleLogoutParticipant = () => {
    localStorage.removeItem(PARTICIPANT_KEY);
    setParticipant(null);
    setSelectedCampaign(null);
    setScreen('home');
  };

  const handleSelectCampaign = (camp: Campaign) => {
    setSelectedCampaign(camp);
    setScreen('tasks');
  };

  const handleAdminSuccess = (adminUser: { id: string; email: string; token: string }) => {
    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(adminUser));
    setAdmin(adminUser);
    setScreen('admin_dashboard');
    setActiveAdminTab('dashboard');
  };

  const handleAdminLogout = () => {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    setAdmin(null);
    setScreen('admin_login');
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] dark:bg-[#0A0A0F] text-zinc-900 dark:text-zinc-100 transition-colors duration-200">

      {screen === 'home' && (
        <HomeView
          onEnterPlatform={handleEnterParticipant}
          onGoToAdmin={() => setScreen('admin_login')}
        />
      )}

      {screen === 'campaigns' && participant && (
        <CampaignsView
          participant={participant}
          onSelectCampaign={handleSelectCampaign}
          onLogout={handleLogoutParticipant}
        />
      )}

      {screen === 'tasks' && participant && selectedCampaign && (
        <TasksView
          participant={participant}
          campaign={selectedCampaign}
          onBack={() => setScreen('campaigns')}
          onLogout={handleLogoutParticipant}
        />
      )}

      {screen === 'admin_login' && (
        <AdminLogin
          onLoginSuccess={handleAdminSuccess}
          onGoBack={() => setScreen('home')}
        />
      )}

      {screen === 'admin_dashboard' && admin && (
        <div className="min-h-screen flex flex-col">
          <nav className="border-b border-zinc-200 dark:border-zinc-900 bg-white dark:bg-[#13131A] sticky top-0 z-20">
            <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center flex-wrap gap-4">

              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 bg-gradient-to-tr from-[#7C3AED] via-[#FF007F] to-[#39FF14] rounded-xl flex items-center justify-center transform rotate-6">
                  <span className="text-white font-black text-sm">P</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="font-extrabold text-md text-zinc-950 dark:text-white leading-none">PayRam Console</span>
                  <span className="text-[10px] font-black uppercase tracking-wider text-pink-500 bg-pink-500/10 border border-pink-500/15 px-2 py-0.5 rounded-md mt-0.5">
                    Admin
                  </span>
                </div>
              </div>

              <div className="flex items-center bg-zinc-100 dark:bg-zinc-900/60 p-1 rounded-xl shrink-0">
                {(
                  [
                    { tab: 'dashboard' as AdminTab, icon: <LayoutDashboard className="w-4 h-4" />, label: 'Dashboard' },
                    { tab: 'campaigns' as AdminTab, icon: <Compass className="w-4 h-4" />, label: 'Campaigns' },
                    { tab: 'submissions' as AdminTab, icon: <Flag className="w-4 h-4" />, label: 'Submissions' },
                    { tab: 'users' as AdminTab, icon: <Users className="w-4 h-4" />, label: 'Users' }
                  ]
                ).map(({ tab, icon, label }) => (
                  <button
                    key={tab}
                    onClick={() => setActiveAdminTab(tab)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                      activeAdminTab === tab
                        ? 'bg-white dark:bg-zinc-950 text-[#7C3AED] dark:text-[#39FF14] shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                  >
                    {icon}
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center space-x-4">
                <button
                  onClick={handleAdminLogout}
                  className="px-4 py-2 text-xs font-bold bg-[#13131A] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-650 dark:text-zinc-300 transition-colors flex items-center space-x-1 cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-red-500" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </nav>

          <main className="max-w-7xl w-full mx-auto px-6 py-10 flex-1">
            <motion.div
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {activeAdminTab === 'dashboard' && (
                <AdminDashboard admin={admin} adminToken={admin.token} />
              )}
              {activeAdminTab === 'campaigns' && (
                <AdminCampaigns adminToken={admin.token} />
              )}
              {activeAdminTab === 'submissions' && (
                <AdminSubmissions adminToken={admin.token} />
              )}
              {activeAdminTab === 'users' && (
                <AdminUsers adminToken={admin.token} />
              )}
            </motion.div>
          </main>

          <footer className="border-t border-zinc-200 dark:border-zinc-900 py-6 text-center text-xs text-zinc-400">
            PayRam Workspace Administration Console
          </footer>
        </div>
      )}
    </div>
  );
}
