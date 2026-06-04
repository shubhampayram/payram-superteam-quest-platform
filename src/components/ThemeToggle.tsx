import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('payram-theme');
      if (stored) return stored === 'dark';
      return true; // Default to dark theme for premium tech feel
    }
    return true;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
      localStorage.setItem('payram-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
      localStorage.setItem('payram-theme', 'light');
    }
  }, [isDark]);

  return (
    <button
      id="btn-theme-toggle"
      onClick={() => setIsDark(!isDark)}
      className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shadow-sm cursor-pointer"
      title="Toggle high-contrast theme"
    >
      {isDark ? <Sun className="w-4 h-4 text-[#39FF14]" /> : <Moon className="w-4 h-4 text-[#7C3AED]" />}
    </button>
  );
}
