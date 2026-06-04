/**
 * LOCAL DEVELOPMENT SERVER
 * Wraps the Vercel API app (api/index.ts) with the Vite dev middleware.
 * For production, Vercel deploys api/index.ts directly as a serverless function.
 *
 * If SUPABASE_URL is NOT set, falls back to the local JSON file server.
 */
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import express from 'express';
import { randomUUID } from 'crypto';
import { createServer as createViteServer } from 'vite';
import { Campaign, Task, Participant, TaskCompletion } from './src/types.js';

const PORT = 3000;

// ── If Supabase is configured, use the Vercel API app ────────────────────────
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('[Dev] Supabase configured — using api/index.ts');
  const { default: app } = await import('./api/index.ts');
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
  app.listen(PORT, '0.0.0.0', () => console.log(`Dev server (Supabase) at http://localhost:${PORT}`));
  process.exit(0); // handled above
}

// ── Local JSON file fallback (no Supabase needed) ────────────────────────────
console.log('[Dev] No Supabase config — using local JSON file database');

const DB_FILE = path.join(process.cwd(), 'server-db.json');
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const adminSessions = new Map<string, { email: string; expiresAt: number }>();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = auth.slice(7);
  const session = adminSessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    adminSessions.delete(token);
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
  next();
}

const getInitialDB = () => ({
  campaigns: [
    { id: 'campaign-1-uuid', title: 'PayRam Solana Integration Challenge', description: 'Learn about PayRam API integration on Solana, run searches, blog about fast invoice generation, and earn SOL rewards!', start_date: '2026-05-01', end_date: '2026-06-30', status: 'active', superteam_submission_url: 'https://superteam.fun/quests/payram-solana', created_at: '2026-05-01T00:00:00.000Z' },
    { id: 'campaign-2-uuid', title: 'DeFi Invoice Tooling Exploration', description: 'Explore how PayRam solves cross-border payments for freelancers.', start_date: '2026-05-15', end_date: '2026-06-25', status: 'active', superteam_submission_url: 'https://superteam.fun/quests/payram-defi-invoice', created_at: '2026-05-15T00:00:00.000Z' },
    { id: 'campaign-3-uuid', title: 'PayRam Merchant SDK Beta Testing', description: 'A developer campaign for testing the beta merchant SDK.', start_date: '2026-06-01', end_date: '2026-07-01', status: 'disabled', superteam_submission_url: 'https://superteam.fun/quests/payram-merchant', created_at: '2026-06-01T00:00:00.000Z' }
  ] as Campaign[],
  tasks: [
    { id: 'task-1-1', campaign_id: 'campaign-1-uuid', type: 'llm_search', label: 'Compare PayRam with Solana Pay', description: 'Go to ChatGPT and run an analysis comparing PayRam gasless features with Solana Pay.', llm_target: 'chatgpt', llm_prompt: 'Compare PayRam invoice management with Solana Pay. What are the key differences in gas costs, API simplicity, and multi-chain support?', blog_prompt: '', blog_platforms_whitelist: null, display_order: 1, created_at: '2026-05-01T00:00:00.000Z' },
    { id: 'task-1-2', campaign_id: 'campaign-1-uuid', type: 'llm_search', label: 'Query Perplexity on PayRam Stablecoins', description: 'Search on Perplexity about stablecoin support in PayRam.', llm_target: 'perplexity', llm_prompt: 'Which stablecoins does PayRam support for cross-border global payments?', blog_prompt: '', blog_platforms_whitelist: null, display_order: 2, created_at: '2026-05-02T00:00:00.000Z' },
    { id: 'task-1-3', campaign_id: 'campaign-1-uuid', type: 'blog', label: 'Write a Blog Post: Speed of Merchant Payments', description: 'Publish a review of the PayRam merchant flow.', llm_target: '', llm_prompt: '', blog_prompt: 'Write a blog post: How does PayRam enable merchants to accept USDC on multiple chains with near-zero friction?', blog_platforms_whitelist: ['Medium', 'Dev.to', 'Hashnode', 'Substack'], display_order: 3, created_at: '2026-05-03T00:00:00.000Z' },
    { id: 'task-2-1', campaign_id: 'campaign-2-uuid', type: 'llm_search', label: 'Claude Search for Freelancer Invoicing', description: 'Draft a guide on why Web3 freelancers prefer PayRam.', llm_target: 'claude', llm_prompt: 'Draft a short guide on why Web3 freelancers prefer PayRam over traditional invoice managers like Stripe or Deel.', blog_prompt: '', blog_platforms_whitelist: null, display_order: 1, created_at: '2026-05-15T00:00:00.000Z' }
  ] as Task[],
  participants: [
    { id: 'part-1', superteam_username: 'solana-master', email: 'alex@solana.org', country: 'United States', twitter_handle: '@sol_alex', created_at: '2026-05-10T12:00:00.000Z' },
    { id: 'part-2', superteam_username: 'bounty_hunter_99', email: 'tony@superteam.fun', country: 'Nigeria', twitter_handle: '@tonyhunts', created_at: '2026-05-12T14:30:00.000Z' },
    { id: 'part-3', superteam_username: 'cryptocody', email: 'cody@gmail.com', country: 'India', twitter_handle: '@cody_crypto', created_at: '2026-05-16T09:15:00.000Z' }
  ] as Participant[],
  completions: [
    { id: 'comp-1', participant_id: 'part-1', task_id: 'task-1-1', campaign_id: 'campaign-1-uuid', completed_at: '2026-05-11T16:20:00.000Z', proof_type: 'screenshot', proof_screenshot_url: '/api/placeholder-screenshot?text=ChatGPT_Proof', proof_link: null, is_flagged: false, flag_reason: null },
    { id: 'comp-2', participant_id: 'part-1', task_id: 'task-1-2', campaign_id: 'campaign-1-uuid', completed_at: '2026-05-12T10:05:00.000Z', proof_type: 'link', proof_screenshot_url: null, proof_link: 'https://www.perplexity.ai/search/payram-settlement-speeds', is_flagged: false, flag_reason: null },
    { id: 'comp-3', participant_id: 'part-2', task_id: 'task-1-1', campaign_id: 'campaign-1-uuid', completed_at: '2026-05-13T08:44:00.000Z', proof_type: 'screenshot', proof_screenshot_url: '/api/placeholder-screenshot?text=Flagged_Proof', proof_link: null, is_flagged: true, flag_reason: 'Incomplete screenshot. Please recapture.' },
    { id: 'comp-4', participant_id: 'part-3', task_id: 'task-2-1', campaign_id: 'campaign-2-uuid', completed_at: '2026-05-18T11:30:00.000Z', proof_type: 'link', proof_screenshot_url: null, proof_link: 'https://claude.ai/share/freelance-billing-payram', is_flagged: false, flag_reason: null }
  ] as TaskCompletion[]
});

const readDB = () => {
  if (!fs.existsSync(DB_FILE)) {
    const data = getInitialDB();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    return data;
  }
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')); }
  catch { const data = getInitialDB(); fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); return data; }
};
const writeDB = (data: any) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

const sendWelcomeEmail = async (username: string, email: string) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.log(`[Email] No RESEND_API_KEY — skipping for ${email}`); return; }
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from: 'PayRam Quests <onboarding@resend.dev>', to: email, subject: 'Welcome to PayRam Quests', html: `<p>Hey <strong>${username}</strong>! You joined PayRam Community Quests.</p>` })
    });
  } catch (err) { console.error('[Email] error:', err); }
};

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.get('/api/placeholder-screenshot', (_req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="100%" height="100%" fill="#090514"/><text x="400" y="225" font-family="monospace" font-size="20" fill="#39FF14" text-anchor="middle">PayRam Screenshot Placeholder</text></svg>`);
});

app.get('/api/campaigns', (_req, res) => res.json(readDB().campaigns));

app.get('/api/campaigns/:id/tasks', (req, res) => {
  const tasks = readDB().tasks.filter((t: Task) => t.campaign_id === req.params.id).sort((a: Task, b: Task) => a.display_order - b.display_order);
  res.json(tasks);
});

app.get('/api/participants/:id', (req, res) => {
  const p = readDB().participants.find((p: Participant) => p.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Participant not found.' });
  res.json(p);
});

app.post('/api/participants', async (req, res) => {
  const { superteam_username, email, country, twitter_handle } = req.body;
  if (!superteam_username || !email || !country) return res.status(400).json({ error: 'Username, email and country are required.' });
  const db = readDB();
  let participant = db.participants.find((p: Participant) => p.superteam_username.toLowerCase() === superteam_username.toLowerCase());
  if (!participant) {
    participant = { id: 'part-' + Date.now(), superteam_username: superteam_username.trim(), email: email.trim(), country, twitter_handle: twitter_handle?.trim() || null, created_at: new Date().toISOString() };
    db.participants.push(participant); writeDB(db);
    await sendWelcomeEmail(participant.superteam_username, participant.email);
  }
  res.json(participant);
});

app.get('/api/completions', (req, res) => {
  const { participant_id } = req.query;
  const db = readDB();
  if (participant_id) return res.json(db.completions.filter((c: TaskCompletion) => c.participant_id === participant_id));
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const session = adminSessions.get(auth.slice(7));
  if (!session || session.expiresAt < Date.now()) return res.status(401).json({ error: 'Unauthorized' });
  res.json(db.completions);
});

app.post('/api/completions', (req, res) => {
  const { participant_id, task_id, campaign_id, proof_type, proof_link, imageBase64 } = req.body;
  if (!participant_id || !task_id || !campaign_id || !proof_type) return res.status(400).json({ error: 'Missing required fields.' });
  const db = readDB();
  if (db.completions.find((c: TaskCompletion) => c.participant_id === participant_id && c.task_id === task_id)) return res.status(400).json({ error: 'This task is already completed.' });
  let finalScreenshotUrl: string | null = null;
  if (proof_type === 'screenshot' && imageBase64) {
    try {
      const match = imageBase64.match(/^data:image\/(\w+);base64,/);
      const ext = match ? match[1] : 'png';
      const cleanData = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const userDir = path.join(UPLOADS_DIR, participant_id, task_id);
      fs.mkdirSync(userDir, { recursive: true });
      const filename = `${Date.now()}.${ext}`;
      fs.writeFileSync(path.join(userDir, filename), Buffer.from(cleanData, 'base64'));
      finalScreenshotUrl = `/uploads/${participant_id}/${task_id}/${filename}`;
    } catch { finalScreenshotUrl = '/api/placeholder-screenshot?text=upload_error'; }
  }
  const newComp: TaskCompletion = { id: 'comp-' + Date.now(), participant_id, task_id, campaign_id, completed_at: new Date().toISOString(), proof_type, proof_screenshot_url: finalScreenshotUrl, proof_link: proof_link || null, is_flagged: false, flag_reason: null };
  db.completions.push(newComp); writeDB(db);
  res.status(201).json(newComp);
});

app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@payram.co';
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return res.status(500).json({ error: 'Server misconfigured: ADMIN_PASSWORD not set.' });
  if (email !== adminEmail || password !== adminPassword) return res.status(401).json({ error: 'Invalid credentials.' });
  const token = randomUUID();
  adminSessions.set(token, { email, expiresAt: Date.now() + SESSION_TTL_MS });
  res.json({ success: true, user: { id: 'admin-1', email, token } });
});

app.get('/api/participants', requireAdmin, (_req, res) => res.json(readDB().participants));

app.post('/api/campaigns', requireAdmin, (req, res) => {
  const { title, description, start_date, end_date, status, superteam_submission_url } = req.body;
  if (!title || !start_date || !end_date || !superteam_submission_url) return res.status(400).json({ error: 'Missing required fields.' });
  const db = readDB();
  const c: Campaign = { id: 'campaign-' + Date.now(), title, description: description || '', start_date, end_date, status: status || 'active', superteam_submission_url, created_at: new Date().toISOString() };
  db.campaigns.push(c); writeDB(db);
  res.status(201).json(c);
});

app.put('/api/campaigns/:id', requireAdmin, (req, res) => {
  const db = readDB();
  const idx = db.campaigns.findIndex((c: Campaign) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found.' });
  db.campaigns[idx] = { ...db.campaigns[idx], ...req.body }; writeDB(db);
  res.json(db.campaigns[idx]);
});

app.delete('/api/campaigns/:id', requireAdmin, (req, res) => {
  const db = readDB();
  const idx = db.campaigns.findIndex((c: Campaign) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found.' });
  db.campaigns.splice(idx, 1);
  db.tasks = db.tasks.filter((t: Task) => t.campaign_id !== req.params.id);
  db.completions = db.completions.filter((c: TaskCompletion) => c.campaign_id !== req.params.id);
  writeDB(db); res.json({ success: true });
});

app.post('/api/campaigns/:id/tasks', requireAdmin, (req, res) => {
  const { type, label, description, llm_target, llm_prompt, blog_prompt, blog_platforms_whitelist, display_order } = req.body;
  if (!type || !label) return res.status(400).json({ error: 'Missing type or label.' });
  const db = readDB();
  const t: Task = { id: 'task-' + Date.now(), campaign_id: req.params.id, type, label, description: description || '', llm_target: llm_target || '', llm_prompt: llm_prompt || '', blog_prompt: blog_prompt || '', blog_platforms_whitelist: blog_platforms_whitelist || null, display_order: display_order !== undefined ? Number(display_order) : db.tasks.length + 1, created_at: new Date().toISOString() };
  db.tasks.push(t); writeDB(db);
  res.status(201).json(t);
});

app.put('/api/tasks/:taskId', requireAdmin, (req, res) => {
  const db = readDB();
  const idx = db.tasks.findIndex((t: Task) => t.id === req.params.taskId);
  if (idx === -1) return res.status(404).json({ error: 'Not found.' });
  db.tasks[idx] = { ...db.tasks[idx], ...req.body };
  if (req.body.display_order !== undefined) db.tasks[idx].display_order = Number(req.body.display_order);
  writeDB(db); res.json(db.tasks[idx]);
});

app.delete('/api/tasks/:taskId', requireAdmin, (req, res) => {
  const db = readDB();
  const idx = db.tasks.findIndex((t: Task) => t.id === req.params.taskId);
  if (idx === -1) return res.status(404).json({ error: 'Not found.' });
  db.tasks.splice(idx, 1);
  db.completions = db.completions.filter((c: TaskCompletion) => c.task_id !== req.params.taskId);
  writeDB(db); res.json({ success: true });
});

app.put('/api/completions/:compId/flag', requireAdmin, (req, res) => {
  const { is_flagged, flag_reason } = req.body;
  const db = readDB();
  const idx = db.completions.findIndex((c: TaskCompletion) => c.id === req.params.compId);
  if (idx === -1) return res.status(404).json({ error: 'Not found.' });
  db.completions[idx].is_flagged = is_flagged;
  db.completions[idx].flag_reason = is_flagged ? (flag_reason || 'Incomplete submission.') : null;
  writeDB(db); res.json(db.completions[idx]);
});

app.get('/api/admin/stats', requireAdmin, (_req, res) => {
  const db = readDB();
  res.json({ totalParticipants: db.participants.length, totalCompletions: db.completions.length, flaggedSubmissions: db.completions.filter((c: TaskCompletion) => c.is_flagged).length, activeCampaigns: db.campaigns.filter((c: Campaign) => c.status === 'active').length });
});

app.get('/api/admin/chart-completions', requireAdmin, (_req, res) => {
  const db = readDB();
  const chartData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    chartData.push({ date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), completions: db.completions.filter((c: TaskCompletion) => c.completed_at.startsWith(dateStr)).length });
  }
  res.json(chartData);
});

app.use('/uploads', express.static(UPLOADS_DIR));

// Start with Vite dev middleware
createViteServer({ server: { middlewareMode: true }, appType: 'spa' }).then((vite) => {
  app.use(vite.middlewares);
  app.listen(PORT, '0.0.0.0', () => console.log(`Dev server (JSON file) at http://localhost:${PORT}`));
});
