import { useState } from 'react';
import { AlertTriangle, X, Send, CheckCircle } from 'lucide-react';

interface ErrorReportButtonProps {
  participantId?: string;
  page: string;
}

export default function ErrorReportButton({ participantId, page }: ErrorReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!description.trim()) { setError('Please describe the issue.'); return; }
    setIsSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/error-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participant_id: participantId || null, page, description: description.trim() })
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed to submit.'); return; }
      setSubmitted(true);
      setTimeout(() => { setIsOpen(false); setSubmitted(false); setDescription(''); }, 2500);
    } catch { setError('Network error. Please try again.'); }
    finally { setIsSubmitting(false); }
  };

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => { setIsOpen(true); setSubmitted(false); setError(''); setDescription(''); }}
        title="Report an issue"
        className="fixed bottom-6 right-6 z-40 w-11 h-11 bg-zinc-800 dark:bg-zinc-900 border border-zinc-700 dark:border-zinc-700 rounded-full flex items-center justify-center text-zinc-400 hover:text-amber-400 hover:border-amber-500/40 transition-all shadow-lg shadow-black/20 cursor-pointer"
      >
        <AlertTriangle className="w-4 h-4" />
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#13131A] rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 relative">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-amber-500/10 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-extrabold text-zinc-900 dark:text-white text-sm">Report an Issue</h3>
                  <p className="text-[10px] text-zinc-400 mt-0.5">We'll look into it — thanks for helping us improve.</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {submitted ? (
              <div className="py-8 flex flex-col items-center space-y-3 text-center">
                <CheckCircle className="w-10 h-10 text-[#39FF14]" />
                <p className="font-bold text-zinc-900 dark:text-white text-sm">Report submitted!</p>
                <p className="text-xs text-zinc-400">Our team will investigate. Thank you.</p>
              </div>
            ) : (
              <>
                <div className="mb-1">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-2">
                    Describe the problem *
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Screenshot upload fails when the file is a PNG from my phone..."
                    rows={4}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 px-3.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-amber-500 resize-none"
                  />
                  <p className="text-[10px] text-zinc-400 mt-1">Page: <span className="font-mono">{page}</span></p>
                </div>

                {error && (
                  <p className="text-red-500 text-xs mb-3 font-medium">{error}</p>
                )}

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="flex-1 py-2.5 border border-zinc-200 dark:border-zinc-800 text-zinc-500 rounded-xl text-xs font-semibold cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !description.trim()}
                    className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer disabled:opacity-40 flex items-center justify-center space-x-1.5 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Sending...' : 'Submit Report'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
