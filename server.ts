import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { createServer as createViteServer } from 'vite';
import { Campaign, Task, Participant, TaskCompletion } from './src/types.js';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const DB_FILE = path.join(process.cwd(), 'server-db.json');
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// In-memory admin sessions: token → { email, expiresAt }
const adminSessions = new Map<string, { email: string; expiresAt: number }>();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

// ── Auth middleware ────────────────────────────────────────────────────────────
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.slice(7);
  const session = adminSessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    adminSessions.delete(token);
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
  next();
}

// ── DB helpers ────────────────────────────────────────────────────────────────
const getInitialDB = () => {
  const campaigns: Campaign[] = [
    {
      id: 'campaign-1-uuid',
      title: 'PayRam Solana Integration Challenge',
      description: 'Learn about PayRam API integration on Solana, run searches, blog about fast invoice generation, and earn SOL rewards!',
      start_date: '2026-05-01',
      end_date: '2026-06-30',
      status: 'active',
      superteam_submission_url: 'https://superteam.fun/quests/payram-solana',
      created_at: '2026-05-01T00:00:00.000Z'
    },
    {
      id: 'campaign-2-uuid',
      title: 'DeFi Invoice Tooling Exploration',
      description: 'Explore how PayRam solves cross-border payments for freelancers. Complete the LLM searches and write a high-fidelity article.',
      start_date: '2026-05-15',
      end_date: '2026-06-25',
      status: 'active',
      superteam_submission_url: 'https://superteam.fun/quests/payram-defi-invoice',
      created_at: '2026-05-15T00:00:00.000Z'
    },
    {
      id: 'campaign-3-uuid',
      title: 'PayRam Merchant SDK Beta Testing',
      description: 'A developer campaign for testing out the beta merchant SDK.',
      start_date: '2026-06-01',
      end_date: '2026-07-01',
      status: 'disabled',
      superteam_submission_url: 'https://superteam.fun/quests/payram-merchant',
      created_at: '2026-06-01T00:00:00.000Z'
    }
  ];

  const tasks: Task[] = [
    {
      id: 'task-1-1',
      campaign_id: 'campaign-1-uuid',
      type: 'llm_search',
      label: 'Compare PayRam with Solana Pay',
      description: 'Go to ChatGPT and run an analysis comparing PayRam gasless features with native Solana Pay. Capture a screenshot.',
      llm_target: 'chatgpt',
      llm_prompt: 'Compare PayRam invoice management with Solana Pay. What are the key differences in gas costs, API simplicity, and multi-chain support?',
      blog_prompt: '',
      blog_platforms_whitelist: null,
      display_order: 1,
      created_at: '2026-05-01T00:00:00.000Z'
    },
    {
      id: 'task-1-2',
      campaign_id: 'campaign-1-uuid',
      type: 'llm_search',
      label: 'Query Perplexity on PayRam Backed Stablecoins',
      description: 'Search on Perplexity about stablecoin support in PayRam. Paste your conversation link here.',
      llm_target: 'perplexity',
      llm_prompt: 'Which stablecoins does PayRam support for cross-border global payments? Outline their settlement speeds.',
      blog_prompt: '',
      blog_platforms_whitelist: null,
      display_order: 2,
      created_at: '2026-05-02T00:00:00.000Z'
    },
    {
      id: 'task-1-3',
      campaign_id: 'campaign-1-uuid',
      type: 'blog',
      label: 'Write a Blog Post: Speed of Merchant Payments',
      description: 'Publish a review of the PayRam merchant flow on Medium, Substack, Hashnode or Dev.to.',
      llm_target: '',
      llm_prompt: '',
      blog_prompt: 'Write a blog post answering: How does PayRam enable merchants to accept USDC on multiple chains with near-zero friction? (Focus on Solana, Base, and Arbitrum).',
      blog_platforms_whitelist: ['Medium', 'Dev.to', 'Hashnode', 'Substack'],
      display_order: 3,
      created_at: '2026-05-03T00:00:00.000Z'
    },
    {
      id: 'task-2-1',
      campaign_id: 'campaign-2-uuid',
      type: 'llm_search',
      label: 'Claude Search for Freelancer Invoicing Integration',
      description: 'Draft a short guide on why Web3 freelancers prefer PayRam over traditional invoice systems on Claude.',
      llm_target: 'claude',
      llm_prompt: 'Draft a short guide on why Web3 freelancers prefer PayRam over traditional invoice managers like Stripe or Deel.',
      blog_prompt: '',
      blog_platforms_whitelist: null,
      display_order: 1,
      created_at: '2026-05-15T00:00:00.000Z'
    }
  ];

  const participants: Participant[] = [
    {
      id: 'part-1',
      superteam_username: 'solana-master',
      email: 'alex@solana.org',
      country: 'United States',
      twitter_handle: '@sol_alex',
      created_at: '2026-05-10T12:00:00.000Z'
    },
    {
      id: 'part-2',
      superteam_username: 'bounty_hunter_99',
      email: 'tony@superteam.fun',
      country: 'Nigeria',
      twitter_handle: '@tonyhunts',
      created_at: '2026-05-12T14:30:00.000Z'
    },
    {
      id: 'part-3',
      superteam_username: 'cryptocody',
      email: 'cody@gmail.com',
      country: 'India',
      twitter_handle: '@cody_crypto',
      created_at: '2026-05-16T09:15:00.000Z'
    }
  ];

  const completions: TaskCompletion[] = [
    {
      id: 'comp-1',
      participant_id: 'part-1',
      task_id: 'task-1-1',
      campaign_id: 'campaign-1-uuid',
      completed_at: '2026-05-11T16:20:00.000Z',
      proof_type: 'screenshot',
      proof_screenshot_url: '/api/placeholder-screenshot?text=ChatGPT_Invoice_Search_Proof',
      proof_link: null,
      is_flagged: false,
      flag_reason: null
    },
    {
      id: 'comp-2',
      participant_id: 'part-1',
      task_id: 'task-1-2',
      campaign_id: 'campaign-1-uuid',
      completed_at: '2026-05-12T10:05:00.000Z',
      proof_type: 'link',
      proof_screenshot_url: null,
      proof_link: 'https://www.perplexity.ai/search/payram-settlement-speeds',
      is_flagged: false,
      flag_reason: null
    },
    {
      id: 'comp-3',
      participant_id: 'part-2',
      task_id: 'task-1-1',
      campaign_id: 'campaign-1-uuid',
      completed_at: '2026-05-13T08:44:00.000Z',
      proof_type: 'screenshot',
      proof_screenshot_url: '/api/placeholder-screenshot?text=ChatGPT_SolanaPay_Proof_Flagged',
      proof_link: null,
      is_flagged: true,
      flag_reason: 'Incomplete search output visible. Please redo and capture the entire browser screen.'
    },
    {
      id: 'comp-4',
      participant_id: 'part-3',
      task_id: 'task-2-1',
      campaign_id: 'campaign-2-uuid',
      completed_at: '2026-05-18T11:30:00.000Z',
      proof_type: 'link',
      proof_screenshot_url: null,
      proof_link: 'https://claude.ai/share/freelance-billing-payram',
      is_flagged: false,
      flag_reason: null
    }
  ];

  return { campaigns, tasks, participants, completions };
};

const readDB = () => {
  if (!fs.existsSync(DB_FILE)) {
    const data = getInitialDB();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return data;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } catch {
    const data = getInitialDB();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return data;
  }
};

const writeDB = (data: any) => {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
};

// ── Placeholder screenshot ────────────────────────────────────────────────────
app.get('/api/placeholder-screenshot', (req, res) => {
  const text = String(req.query.text || 'Proof Screenshot').replace(/[<>&"']/g, '');
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
    <defs><radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="0%" style="stop-color:#1E1B4B"/><stop offset="100%" style="stop-color:#090514"/></radialGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <rect x="20" y="20" width="760" height="410" rx="10" fill="none" stroke="#7C3AED" stroke-opacity="0.3" stroke-width="2"/>
    <text x="400" y="210" font-family="monospace" font-size="24" fill="#39FF14" font-weight="bold" text-anchor="middle">PayRam Quest Verification</text>
    <text x="400" y="250" font-family="sans-serif" font-size="16" fill="#A1A1AA" text-anchor="middle">SUBMITTED PROOF: ${text}</text>
    <text x="400" y="380" font-family="monospace" font-size="11" fill="#71717A" text-anchor="middle">PayRam Community Quest Platform</text>
  </svg>`);
});

// ── Welcome email ─────────────────────────────────────────────────────────────
const sendWelcomeEmail = async (username: string, email: string) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[Email] No RESEND_API_KEY set. Skipping welcome email for ${email}`);
    return;
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: 'PayRam Quests <onboarding@resend.dev>',
        to: email,
        subject: 'Welcome to PayRam Quests',
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#0A0A0F;color:#fff;border:1px solid #7C3AED;border-radius:8px;">
          <h1 style="color:#7C3AED;">Welcome to PayRam Quests</h1>
          <p>Hey <strong>${username}</strong>! You've joined the PayRam Community Quest Platform.</p>
          <p>Complete tasks and earn rewards on Superteam.</p>
          <a href="${process.env.APP_URL || 'http://localhost:3000'}" style="background:#7C3AED;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;margin-top:16px;">Start Questing →</a>
        </div>`
      })
    });
    const result = await response.json();
    console.log('[Email] Sent via Resend:', result);
  } catch (err) {
    console.error('[Email] Resend error:', err);
  }
};

// ============================================================
// PUBLIC ROUTES
// ============================================================

app.get('/api/campaigns', (_req, res) => {
  res.json(readDB().campaigns);
});

app.get('/api/campaigns/:id/tasks', (req, res) => {
  const db = readDB();
  const tasks = db.tasks
    .filter((t: Task) => t.campaign_id === req.params.id)
    .sort((a: Task, b: Task) => a.display_order - b.display_order);
  res.json(tasks);
});

// completions: with participant_id = public; without = admin only
app.get('/api/completions', (req, res) => {
  const { participant_id } = req.query;
  const db = readDB();

  if (participant_id) {
    return res.json(db.completions.filter((c: TaskCompletion) => c.participant_id === participant_id));
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.slice(7);
  const session = adminSessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.json(db.completions);
});

app.post('/api/completions', (req, res) => {
  const { participant_id, task_id, campaign_id, proof_type, proof_link, imageBase64 } = req.body;
  if (!participant_id || !task_id || !campaign_id || !proof_type) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const db = readDB();

  const exists = db.completions.find(
    (c: TaskCompletion) => c.participant_id === participant_id && c.task_id === task_id
  );
  if (exists) {
    return res.status(400).json({ error: 'This task is already completed.' });
  }

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
    } catch {
      finalScreenshotUrl = `/api/placeholder-screenshot?text=upload_error`;
    }
  }

  const newCompletion: TaskCompletion = {
    id: 'comp-' + Date.now(),
    participant_id,
    task_id,
    campaign_id,
    completed_at: new Date().toISOString(),
    proof_type,
    proof_screenshot_url: finalScreenshotUrl,
    proof_link: proof_link || null,
    is_flagged: false,
    flag_reason: null
  };

  db.completions.push(newCompletion);
  writeDB(db);
  res.status(201).json(newCompletion);
});

app.post('/api/participants', async (req, res) => {
  const { superteam_username, email, country, twitter_handle } = req.body;
  if (!superteam_username || !email || !country) {
    return res.status(400).json({ error: 'Username, email and country are required.' });
  }

  const db = readDB();
  let participant = db.participants.find(
    (p: Participant) => p.superteam_username.toLowerCase() === superteam_username.toLowerCase()
  );

  if (!participant) {
    participant = {
      id: 'part-' + Date.now(),
      superteam_username: superteam_username.trim(),
      email: email.trim(),
      country,
      twitter_handle: twitter_handle ? twitter_handle.trim() : null,
      created_at: new Date().toISOString()
    };
    db.participants.push(participant);
    writeDB(db);
    await sendWelcomeEmail(participant.superteam_username, participant.email);
  }

  res.json(participant);
});

// Restore participant session by ID
app.get('/api/participants/:id', (req, res) => {
  const db = readDB();
  const participant = db.participants.find((p: Participant) => p.id === req.params.id);
  if (!participant) return res.status(404).json({ error: 'Participant not found.' });
  res.json(participant);
});

// ============================================================
// ADMIN AUTH
// ============================================================

app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required.' });
  }

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@payram.co';
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return res.status(500).json({ error: 'Server misconfigured: ADMIN_PASSWORD env var is not set.' });
  }

  if (email !== adminEmail || password !== adminPassword) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const token = randomUUID();
  adminSessions.set(token, { email, expiresAt: Date.now() + SESSION_TTL_MS });

  res.json({ success: true, user: { id: 'admin-1', email, token } });
});

// ============================================================
// PROTECTED ADMIN ROUTES (all require requireAdmin)
// ============================================================

app.get('/api/participants', requireAdmin, (_req, res) => {
  res.json(readDB().participants);
});

app.post('/api/campaigns', requireAdmin, (req, res) => {
  const { title, description, start_date, end_date, status, superteam_submission_url } = req.body;
  if (!title || !start_date || !end_date || !superteam_submission_url) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  const db = readDB();
  const newCampaign: Campaign = {
    id: 'campaign-' + Date.now(),
    title,
    description: description || '',
    start_date,
    end_date,
    status: status || 'active',
    superteam_submission_url,
    created_at: new Date().toISOString()
  };
  db.campaigns.push(newCampaign);
  writeDB(db);
  res.status(201).json(newCampaign);
});

app.put('/api/campaigns/:id', requireAdmin, (req, res) => {
  const db = readDB();
  const idx = db.campaigns.findIndex((c: Campaign) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Campaign not found.' });
  db.campaigns[idx] = { ...db.campaigns[idx], ...req.body };
  writeDB(db);
  res.json(db.campaigns[idx]);
});

app.delete('/api/campaigns/:id', requireAdmin, (req, res) => {
  const db = readDB();
  const idx = db.campaigns.findIndex((c: Campaign) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Campaign not found.' });
  db.campaigns.splice(idx, 1);
  db.tasks = db.tasks.filter((t: Task) => t.campaign_id !== req.params.id);
  db.completions = db.completions.filter((c: TaskCompletion) => c.campaign_id !== req.params.id);
  writeDB(db);
  res.json({ success: true });
});

app.post('/api/campaigns/:id/tasks', requireAdmin, (req, res) => {
  const { type, label, description, llm_target, llm_prompt, blog_prompt, blog_platforms_whitelist, display_order } = req.body;
  if (!type || !label) return res.status(400).json({ error: 'Missing type or label.' });
  const db = readDB();
  const newTask: Task = {
    id: 'task-' + Date.now(),
    campaign_id: req.params.id,
    type,
    label,
    description: description || '',
    llm_target: llm_target || '',
    llm_prompt: llm_prompt || '',
    blog_prompt: blog_prompt || '',
    blog_platforms_whitelist: blog_platforms_whitelist || null,
    display_order: display_order !== undefined ? Number(display_order) : db.tasks.length + 1,
    created_at: new Date().toISOString()
  };
  db.tasks.push(newTask);
  writeDB(db);
  res.status(201).json(newTask);
});

app.put('/api/tasks/:taskId', requireAdmin, (req, res) => {
  const db = readDB();
  const idx = db.tasks.findIndex((t: Task) => t.id === req.params.taskId);
  if (idx === -1) return res.status(404).json({ error: 'Task not found.' });
  db.tasks[idx] = { ...db.tasks[idx], ...req.body };
  if (req.body.display_order !== undefined) {
    db.tasks[idx].display_order = Number(req.body.display_order);
  }
  writeDB(db);
  res.json(db.tasks[idx]);
});

app.delete('/api/tasks/:taskId', requireAdmin, (req, res) => {
  const db = readDB();
  const idx = db.tasks.findIndex((t: Task) => t.id === req.params.taskId);
  if (idx === -1) return res.status(404).json({ error: 'Task not found.' });
  db.tasks.splice(idx, 1);
  db.completions = db.completions.filter((c: TaskCompletion) => c.task_id !== req.params.taskId);
  writeDB(db);
  res.json({ success: true });
});

app.put('/api/completions/:compId/flag', requireAdmin, (req, res) => {
  const { is_flagged, flag_reason } = req.body;
  const db = readDB();
  const idx = db.completions.findIndex((c: TaskCompletion) => c.id === req.params.compId);
  if (idx === -1) return res.status(404).json({ error: 'Completion not found.' });
  db.completions[idx].is_flagged = is_flagged;
  db.completions[idx].flag_reason = is_flagged ? (flag_reason || 'Incomplete submission.') : null;
  writeDB(db);
  res.json(db.completions[idx]);
});

app.get('/api/admin/stats', requireAdmin, (_req, res) => {
  const db = readDB();
  res.json({
    totalParticipants: db.participants.length,
    totalCompletions: db.completions.length,
    flaggedSubmissions: db.completions.filter((c: TaskCompletion) => c.is_flagged).length,
    activeCampaigns: db.campaigns.filter((c: Campaign) => c.status === 'active').length
  });
});

app.get('/api/admin/chart-completions', requireAdmin, (_req, res) => {
  const db = readDB();
  const chartData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const count = db.completions.filter((c: TaskCompletion) =>
      c.completed_at.startsWith(dateStr)
    ).length;
    chartData.push({
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      completions: count
    });
  }
  res.json(chartData);
});

app.use('/uploads', express.static(UPLOADS_DIR));

// ============================================================
// VITE / STATIC
// ============================================================
if (process.env.NODE_ENV !== 'production') {
  createViteServer({ server: { middlewareMode: true }, appType: 'spa' }).then((vite) => {
    app.use(vite.middlewares);
    app.listen(PORT, '0.0.0.0', () => console.log(`Dev server running at http://localhost:${PORT}`));
  });
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  app.listen(PORT, '0.0.0.0', () => console.log(`Production server on port ${PORT}`));
}
