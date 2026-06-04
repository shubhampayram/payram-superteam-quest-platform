export const LLM_BASE_URLS: Record<string, string> = {
  chatgpt: 'https://chat.openai.com/?q=',
  perplexity: 'https://www.perplexity.ai/?q=',
  gemini: 'https://gemini.google.com/app?q=',
  claude: 'https://claude.ai/new?q='
};

export function buildLLMUrl(target: string, prompt: string): string {
  const base = LLM_BASE_URLS[target] ?? 'https://www.google.com/search?q=';
  return base + encodeURIComponent(prompt);
}
