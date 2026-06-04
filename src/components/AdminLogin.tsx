import React, { useState } from 'react';
import { Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';
import ThemeToggle from './ThemeToggle.tsx';

interface AdminLoginProps {
  onLoginSuccess: (admin: { id: string; email: string; token: string }) => void;
  onGoBack: () => void;
}

export default function AdminLogin({ onLoginSuccess, onGoBack }: AdminLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMsg(data.error || 'Invalid credentials.');
        return;
      }

      onLoginSuccess(data.user);
    } catch {
      setErrorMsg('Server connection failure. Please confirm the server is running.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] dark:bg-[#0A0A0F] text-zinc-900 dark:text-zinc-100 flex flex-col justify-between transition-colors duration-200">
      <header className="max-w-7xl w-full mx-auto px-6 py-5 flex justify-between items-center">
        <button
          onClick={onGoBack}
          className="text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
        >
          ← Exit to participant hub
        </button>
        <ThemeToggle />
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white dark:bg-[#13131A] rounded-2xl border border-zinc-200 dark:border-zinc-900 p-8 shadow-xl relative overflow-hidden">

          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#7C3AED] to-pink-500"></div>

          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-gradient-to-tr from-[#7C3AED] via-[#FF007F] to-[#39FF14] rounded-xl flex items-center justify-center shadow-lg transform rotate-6 mx-auto mb-4 scale-110">
              <span className="text-white font-black text-2xl">P</span>
            </div>
            <h2 className="text-xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
              PayRam Admin Terminal
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Verify campaigns, manage submission proofs, and review flags.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-6 p-3.5 bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 rounded-xl text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                Admin Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-400" />
                <input
                  id="input-admin-email"
                  type="email"
                  required
                  placeholder="admin@payram.co"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-900/65 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#7C3AED]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-400" />
                <input
                  id="input-admin-password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-900/65 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#7C3AED]"
                />
              </div>
            </div>

            <button
              id="btn-admin-login-submit"
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white py-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow-md shadow-[#7C3AED]/20 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Authorizing...</span>
                </>
              ) : (
                <span>Authorize Access →</span>
              )}
            </button>
          </form>
        </div>
      </div>

      <footer className="py-6 text-center text-xs text-zinc-400">
        Admin gateway — authorized access only.
      </footer>
    </div>
  );
}
