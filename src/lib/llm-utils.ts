import type { LLMTarget } from '../types.ts';

export interface LLMInfo {
  label: string;
  baseUrl: string;
  /** When true: appends encodeURIComponent(prompt) to baseUrl.
   *  When false: opens baseUrl only; prompt is auto-copied to clipboard. */
  supportsUrlPrompt: boolean;
  badgeClass: string; // Tailwind classes for the badge chip
  chartColor: string; // Hex for recharts bars
}

export const LLM_CONFIG: Record<string, LLMInfo> = {
  chatgpt: {
    label: 'ChatGPT',
    baseUrl: 'https://chat.openai.com/?q=',
    supportsUrlPrompt: true,
    badgeClass: 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20',
    chartColor: '#10B981'
  },
  perplexity: {
    label: 'Perplexity',
    baseUrl: 'https://www.perplexity.ai/?q=',
    supportsUrlPrompt: true,
    badgeClass: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    chartColor: '#3B82F6'
  },
  gemini: {
    label: 'Gemini',
    baseUrl: 'https://gemini.google.com/app?q=',
    supportsUrlPrompt: true,
    badgeClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    chartColor: '#F59E0B'
  },
  claude: {
    label: 'Claude',
    baseUrl: 'https://claude.ai/new?q=',
    supportsUrlPrompt: true,
    badgeClass: 'bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20',
    chartColor: '#F97316'
  },
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://chat.deepseek.com/',
    supportsUrlPrompt: false,
    badgeClass: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
    chartColor: '#06B6D4'
  },
  grok: {
    label: 'Grok',
    baseUrl: 'https://grok.com/',
    supportsUrlPrompt: false,
    badgeClass: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
    chartColor: '#8B5CF6'
  },
  copilot: {
    label: 'Copilot',
    baseUrl: 'https://copilot.microsoft.com/chat?q=',
    supportsUrlPrompt: true,
    badgeClass: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
    chartColor: '#0EA5E9'
  },
  meta: {
    label: 'Meta AI',
    baseUrl: 'https://www.meta.ai/',
    supportsUrlPrompt: false,
    badgeClass: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    chartColor: '#6366F1'
  }
};

const FALLBACK: LLMInfo = {
  label: 'LLM Search',
  baseUrl: 'https://www.google.com/search?q=',
  supportsUrlPrompt: true,
  badgeClass: 'bg-[#7C3AED]/10 text-[#7C3AED] border-[#7C3AED]/20',
  chartColor: '#7C3AED'
};

export function getLLMInfo(target: string): LLMInfo {
  return LLM_CONFIG[target] ?? FALLBACK;
}

export function buildLLMUrl(target: string, prompt: string): string {
  const info = getLLMInfo(target);
  if (info.supportsUrlPrompt) return info.baseUrl + encodeURIComponent(prompt);
  return info.baseUrl; // open base URL; caller must copy prompt to clipboard
}

export const LLM_TARGETS = Object.keys(LLM_CONFIG) as LLMTarget[];
