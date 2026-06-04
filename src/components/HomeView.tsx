import React, { useState } from 'react';
import { countryList } from '../lib/countries.ts';
import ThemeToggle from './ThemeToggle.tsx';
import { Search, ChevronDown, Check, User, Mail, Globe, Twitter, AlertCircle, Send, Linkedin, MessageSquare } from 'lucide-react';

// ── Update these with your real social media URLs ────────────────────────────
const SOCIAL_LINKS = [
  { label: 'Twitter / X',  href: 'https://twitter.com/payram',                icon: <Twitter className="w-4 h-4" />,      hoverColor: 'hover:text-[#1DA1F2]' },
  { label: 'Telegram',     href: 'https://t.me/payram',                       icon: <Send className="w-4 h-4" />,          hoverColor: 'hover:text-[#26A5E4]' },
  { label: 'Discord',      href: 'https://discord.gg/payram',                 icon: <MessageSquare className="w-4 h-4" />, hoverColor: 'hover:text-[#5865F2]' },
  { label: 'LinkedIn',     href: 'https://linkedin.com/company/payram',       icon: <Linkedin className="w-4 h-4" />,      hoverColor: 'hover:text-[#0A66C2]' }
];

interface HomeViewProps {
  onEnterPlatform: (participant: any) => void;
  onGoToAdmin: () => void;
}

export default function HomeView({ onEnterPlatform, onGoToAdmin }: HomeViewProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('');
  const [twitter, setTwitter] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredCountries = countryList.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const validate = () => {
    const tempErrors: { [key: string]: string } = {};
    if (!username.trim()) tempErrors.username = 'Superteam Username is required.';
    else if (username.length < 3) tempErrors.username = 'Username must be at least 3 characters.';
    if (!email.trim()) tempErrors.email = 'Email address is required.';
    else if (!/\S+@\S+\.\S+/.test(email)) tempErrors.email = 'Please provide a valid email format.';
    if (!country) tempErrors.country = 'Please select your country of residence.';
    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ superteam_username: username.trim(), email: email.trim(), country, twitter_handle: twitter.trim() || null })
      });
      if (!response.ok) {
        const errText = await response.json();
        setErrors({ general: errText.error || 'Server registration failed. Please try again.' });
        return;
      }
      const participant = await response.json();
      onEnterPlatform(participant);
    } catch {
      setErrors({ general: 'Network connection error. Server could not be reached.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] dark:bg-[#0A0A0F] text-zinc-900 dark:text-zinc-100 transition-colors duration-200 flex flex-col">
      {/* Header */}
      <header className="max-w-7xl mx-auto w-full px-6 py-5 flex justify-between items-center">
        <div className="flex items-center space-x-2 select-none" id="payram-logo-header">
          <div className="w-10 h-10 bg-gradient-to-tr from-[#7C3AED] via-[#FF007F] to-[#39FF14] rounded-xl flex items-center justify-center shadow-lg transform rotate-3 hover:rotate-6 transition-transform">
            <span className="text-white font-black text-xl tracking-tight">P</span>
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-zinc-800 to-zinc-950 dark:from-white dark:to-zinc-300 bg-clip-text text-transparent">PayRam</span>
            <span className="text-[10px] font-bold text-[#7C3AED] dark:text-[#39FF14] uppercase tracking-wider">Quest Hub</span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button
            id="btn-admin-gate"
            onClick={onGoToAdmin}
            className="text-xs font-semibold px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:border dark:border-zinc-800 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors cursor-pointer"
          >
            Admin Gate Access
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto w-full px-6 py-12 md:py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center flex-1">
        {/* Left: hero */}
        <div className="lg:col-span-7 space-y-6" id="welcome-hero-banner">
          <div className="inline-flex items-center space-x-2 bg-[#7C3AED]/10 border border-[#7C3AED]/20 px-3.5 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-[#39FF14] animate-pulse" />
            <span className="text-xs font-extrabold text-[#7C3AED] dark:text-zinc-300 uppercase tracking-widest">Live SOL and USDC Quests</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight bg-gradient-to-r from-zinc-900 to-zinc-750 dark:from-white dark:via-zinc-100 dark:to-zinc-300 bg-clip-text text-transparent">
            Complete Quests.<br />
            <span className="bg-gradient-to-r from-[#7C3AED] via-[#FF007F] to-[#39FF14] bg-clip-text text-transparent">Get Rewarded.</span>
          </h1>

          <p className="text-zinc-600 dark:text-zinc-400 text-lg md:text-xl max-w-xl font-normal leading-relaxed">
            Join the exclusive PayRam community quests, complete tasks with cutting-edge LLMs and content publishing, and qualify for high-tier incentives directly on Superteam.
          </p>

          {/* Social proof stats */}
          <div className="grid grid-cols-3 gap-6 pt-6 max-w-lg border-t border-zinc-200 dark:border-zinc-800/60">
            <div>
              <p className="text-2xl md:text-3xl font-black text-[#7C3AED] dark:text-[#39FF14]">3K+</p>
              <p className="text-xs text-zinc-500 font-medium uppercase mt-1">Verified Users</p>
            </div>
            <div>
              <p className="text-2xl md:text-3xl font-black text-pink-500">$50,000</p>
              <p className="text-xs text-zinc-500 font-medium uppercase mt-1">Pool Distributed</p>
            </div>
            <div>
              <p className="text-2xl md:text-3xl font-black text-[#7C3AED]">100%</p>
              <p className="text-xs text-zinc-500 font-medium uppercase mt-1">On-Chain Delivery</p>
            </div>
          </div>

          {/* Social media links */}
          <div className="flex items-center space-x-4 pt-2">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Follow us</p>
            {SOCIAL_LINKS.map(({ label, href, icon, hoverColor }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                title={label}
                className={`text-zinc-400 ${hoverColor} transition-colors`}
              >
                {icon}
              </a>
            ))}
          </div>
        </div>

        {/* Right: entry card */}
        <div className="lg:col-span-5">
          <div id="participant-entry-card" className="border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-[#13131A] rounded-3xl p-8 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#7C3AED]/20 to-transparent blur-2xl" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-[#39FF14]/5 to-transparent blur-2xl" />

            <h2 className="text-2xl font-extrabold mb-2 tracking-tight text-zinc-900 dark:text-white">Get Started In Seconds</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">No account creation required. Use your Superteam identifier.</p>

            {errors.general && (
              <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{errors.general}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 flex justify-between">
                  <span>Superteam Username *</span>
                  <span className="text-zinc-400 font-normal normal-case">Match Superteam profile</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-400" />
                  <input id="input-superteam-username" type="text" required placeholder="your-username" value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]" />
                </div>
                {errors.username && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.username}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Email Address *</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-400" />
                  <input id="input-superteam-email" type="email" required placeholder="user@example.com" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]" />
                </div>
                {errors.email && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.email}</p>}
              </div>

              {/* Country */}
              <div className="relative">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Country of Residence *</label>
                <button id="dropdown-country" type="button" onClick={() => setIsOpen(!isOpen)}
                  className="w-full bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl py-3 px-4 text-left text-sm text-zinc-700 dark:text-zinc-300 flex justify-between items-center cursor-pointer">
                  <span className="flex items-center space-x-2">
                    <Globe className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                    <span>{country || 'Select a Country'}</span>
                  </span>
                  <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                  <div className="absolute z-30 mt-2 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl p-2.5 space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
                      <input type="text" placeholder="Search countries..." value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg py-1.5 pl-9 pr-3 text-xs focus:outline-none" />
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-0.5">
                      {filteredCountries.length === 0 ? (
                        <p className="text-zinc-400 text-xs p-3 text-center">No results found</p>
                      ) : filteredCountries.map((item) => (
                        <button key={item.code} type="button"
                          onClick={() => { setCountry(item.name); setIsOpen(false); setSearchQuery(''); }}
                          className="w-full flex items-center justify-between text-xs px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-left cursor-pointer">
                          <span className="flex items-center space-x-2.5 font-medium">
                            <span className="text-base">{item.flag}</span>
                            <span>{item.name}</span>
                          </span>
                          {country === item.name && <Check className="w-3.5 h-3.5 text-[#39FF14]" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {errors.country && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.country}</p>}
              </div>

              {/* Twitter */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 flex justify-between">
                  <span>Twitter/X Handle <span className="text-zinc-400 font-normal lowercase">(optional)</span></span>
                </label>
                <div className="relative">
                  <Twitter className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-400" />
                  <input id="input-twitter-handle" type="text" placeholder="@handle" value={twitter}
                    onChange={(e) => setTwitter(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]" />
                </div>
              </div>

              <button id="btn-platform-enter" type="submit" disabled={isSubmitting}
                className="w-full mt-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-extrabold text-sm uppercase tracking-wider py-4 rounded-xl shadow-lg shadow-[#7C3AED]/20 transition-all active:scale-[0.99] flex items-center justify-center cursor-pointer disabled:opacity-50">
                {isSubmitting ? 'Connecting...' : 'Enter Platform →'}
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Footer with social links */}
      <footer className="border-t border-zinc-200 dark:border-zinc-900 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-zinc-400">PayRam Community Quest Hub © 2026</p>

          <div className="flex items-center space-x-5">
            {SOCIAL_LINKS.map(({ label, href, icon, hoverColor }) => (
              <a key={label} href={href} target="_blank" rel="noreferrer" title={label}
                className={`text-zinc-400 ${hoverColor} transition-colors`}>
                {icon}
              </a>
            ))}
          </div>

          <p className="text-xs text-zinc-500">Powered by Solana · Deployable with Supabase</p>
        </div>
      </footer>
    </div>
  );
}
