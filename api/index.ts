import 'dotenv/config';
import express from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ── Supabase client ──────────────────────────────────────────────────────────
let _supabase: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    _supabase = createClient(url, key);
  }
  return _supabase;
}

// ── JWT admin auth ───────────────────────────────────────────────────────────
const jwtSecret = () =>
  new TextEncoder().encode(process.env.ADMIN_JWT_SECRET ?? 'dev-only-secret-change-me');

async function signToken(email: string) {
  return new SignJWT({ email, role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(jwtSecret());
}

const requireAdmin: express.RequestHandler = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    await jwtVerify(auth.slice(7), jwtSecret());
    next();
  } catch {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
};

// ── Welcome email ────────────────────────────────────────────────────────────
async function sendWelcomeEmail(username: string, email: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.log(`[Email] No RESEND_API_KEY — skipping welcome for ${email}`); return; }
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: 'PayRam Quests <onboarding@resend.dev>',
        to: email,
        subject: 'Welcome to PayRam Quests',
        html: `<p>Hey <strong>${username}</strong>! You've joined PayRam Community Quests. Complete tasks and earn rewards on Superteam.</p><a href="${process.env.APP_URL || 'https://your-app.vercel.app'}">Start Questing →</a>`
      })
    });
  } catch (err) { console.error('[Email] Resend error:', err); }
}

// ============================================================
// PUBLIC ROUTES
// ============================================================

app.get('/api/campaigns', async (_req, res) => {
  const { data, error } = await db().from('campaigns').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/campaigns/:id/tasks', async (req, res) => {
  const { data, error } = await db()
    .from('tasks').select('*')
    .eq('campaign_id', req.params.id)
    .order('display_order', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/participants/:id', async (req, res) => {
  const { data, error } = await db()
    .from('participants').select('*')
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(404).json({ error: 'Participant not found.' });
  res.json(data);
});

app.post('/api/participants', async (req, res) => {
  const { superteam_username, email, country, twitter_handle } = req.body;
  if (!superteam_username || !email || !country) {
    return res.status(400).json({ error: 'Username, email and country are required.' });
  }

  // Check if returning user
  const { data: existing } = await db()
    .from('participants').select('*')
    .ilike('superteam_username', superteam_username.trim())
    .single();

  if (existing) return res.json(existing);

  const { data: newPart, error } = await db()
    .from('participants')
    .insert({ superteam_username: superteam_username.trim(), email: email.trim(), country, twitter_handle: twitter_handle?.trim() || null })
    .select().single();

  if (error) return res.status(500).json({ error: error.message });
  await sendWelcomeEmail(newPart.superteam_username, newPart.email);
  res.status(201).json(newPart);
});

// completions: public with participant_id filter, admin-only without
app.get('/api/completions', async (req, res) => {
  const { participant_id } = req.query;

  if (participant_id) {
    const { data, error } = await db()
      .from('task_completions').select('*')
      .eq('participant_id', participant_id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  // No participant_id = admin only
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try { await jwtVerify(auth.slice(7), jwtSecret()); } catch { return res.status(401).json({ error: 'Unauthorized' }); }

  const { data, error } = await db().from('task_completions').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/completions', async (req, res) => {
  const { participant_id, task_id, campaign_id, proof_type, proof_link, imageBase64 } = req.body;
  if (!participant_id || !task_id || !campaign_id || !proof_type) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  // Check duplicate
  const { data: existing } = await db()
    .from('task_completions').select('id')
    .eq('participant_id', participant_id)
    .eq('task_id', task_id)
    .single();
  if (existing) return res.status(400).json({ error: 'This task is already completed.' });

  let finalScreenshotUrl: string | null = null;

  // Upload screenshot to Supabase Storage
  if (proof_type === 'screenshot' && imageBase64) {
    try {
      const match = imageBase64.match(/^data:image\/(\w+);base64,/);
      const ext = match ? match[1] : 'png';
      const cleanData = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanData, 'base64');
      const storagePath = `${participant_id}/${task_id}/${Date.now()}.${ext}`;

      const { data: storageData, error: storageError } = await db().storage
        .from('screenshots')
        .upload(storagePath, buffer, { contentType: `image/${ext}`, upsert: false });

      if (!storageError && storageData) {
        const { data: signed } = await db().storage
          .from('screenshots')
          .createSignedUrl(storageData.path, 60 * 60 * 24 * 365); // 1 year
        finalScreenshotUrl = signed?.signedUrl ?? null;
      }
    } catch (err) {
      console.error('[Storage] Upload failed:', err);
    }
  }

  const { data: newComp, error } = await db()
    .from('task_completions')
    .insert({
      participant_id, task_id, campaign_id,
      proof_type,
      proof_screenshot_url: finalScreenshotUrl,
      proof_link: proof_link || null,
      is_flagged: false,
      flag_reason: null
    })
    .select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(newComp);
});

// ============================================================
// ADMIN AUTH
// ============================================================

// ── Seed env-var admin into DB if not already present ──────────────────────
async function seedEnvAdmin() {
  try {
    const envEmail = process.env.ADMIN_EMAIL || 'admin@payram.co';
    const envPassword = process.env.ADMIN_PASSWORD;
    if (!envPassword) return;
    const { data } = await db().from('admins').select('id').eq('email', envEmail).maybeSingle();
    if (!data) {
      const hash = await bcrypt.hash(envPassword, 10);
      await db().from('admins').insert({ email: envEmail, password_hash: hash, name: 'Super Admin', is_active: true });
      console.log('[Auth] Seeded env admin:', envEmail);
    }
  } catch (e) { console.error('[Auth] Seed error:', e); }
}
seedEnvAdmin();

app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });

  try {
    const { data: admin, error: dbErr } = await db().from('admins').select('*').eq('email', email.toLowerCase().trim()).maybeSingle();
    console.log('[Login] email:', JSON.stringify(email.toLowerCase().trim()), 'found:', !!admin, 'dbErr:', dbErr?.message);
    if (dbErr) return res.status(500).json({ error: 'DB error: ' + dbErr.message });
    if (!admin || !admin.is_active) return res.status(401).json({ error: 'Invalid credentials.' });

    const valid = await bcrypt.compare(password, admin.password_hash);
    console.log('[Login] bcrypt valid:', valid);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials.' });

    const token = await signToken(email.toLowerCase().trim());
    res.json({ success: true, user: { id: admin.id, email: admin.email, name: admin.name, token } });
  } catch (e: any) {
    console.error('[Login] Exception:', e.message);
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
});

// ============================================================
// PROTECTED ADMIN ROUTES
// ============================================================

app.get('/api/participants', requireAdmin, async (_req, res) => {
  const { data, error } = await db().from('participants').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/campaigns', requireAdmin, async (req, res) => {
  const { title, description, start_date, end_date, status, superteam_submission_url } = req.body;
  if (!title || !start_date || !end_date || !superteam_submission_url) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  const { data, error } = await db()
    .from('campaigns')
    .insert({ title, description: description || '', start_date, end_date, status: status || 'active', superteam_submission_url })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

app.put('/api/campaigns/:id', requireAdmin, async (req, res) => {
  const { data, error } = await db()
    .from('campaigns').update(req.body)
    .eq('id', req.params.id)
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/campaigns/:id', requireAdmin, async (req, res) => {
  const { error } = await db().from('campaigns').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.post('/api/campaigns/:id/tasks', requireAdmin, async (req, res) => {
  const { type, label, description, llm_target, llm_prompt, blog_prompt, blog_platforms_whitelist, display_order } = req.body;
  if (!type || !label) return res.status(400).json({ error: 'Missing type or label.' });

  const { count } = await db().from('tasks').select('*', { count: 'exact', head: true }).eq('campaign_id', req.params.id);
  const { data, error } = await db()
    .from('tasks')
    .insert({
      campaign_id: req.params.id, type, label,
      description: description || '',
      llm_target: llm_target || '',
      llm_prompt: llm_prompt || '',
      blog_prompt: blog_prompt || '',
      blog_platforms_whitelist: blog_platforms_whitelist || null,
      display_order: display_order !== undefined ? Number(display_order) : (count ?? 0) + 1
    })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

app.put('/api/tasks/:taskId', requireAdmin, async (req, res) => {
  const { data, error } = await db()
    .from('tasks').update(req.body)
    .eq('id', req.params.taskId)
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/tasks/:taskId', requireAdmin, async (req, res) => {
  const { error } = await db().from('tasks').delete().eq('id', req.params.taskId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.put('/api/completions/:compId/flag', requireAdmin, async (req, res) => {
  const { is_flagged, flag_reason } = req.body;
  const { data, error } = await db()
    .from('task_completions')
    .update({ is_flagged, flag_reason: is_flagged ? (flag_reason || 'Incomplete submission.') : null })
    .eq('id', req.params.compId)
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/admin/stats', requireAdmin, async (_req, res) => {
  const [
    { count: participants },
    { count: completions },
    { count: flagged },
    { count: active }
  ] = await Promise.all([
    db().from('participants').select('*', { count: 'exact', head: true }),
    db().from('task_completions').select('*', { count: 'exact', head: true }),
    db().from('task_completions').select('*', { count: 'exact', head: true }).eq('is_flagged', true),
    db().from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'active')
  ]);
  res.json({ totalParticipants: participants ?? 0, totalCompletions: completions ?? 0, flaggedSubmissions: flagged ?? 0, activeCampaigns: active ?? 0 });
});

app.get('/api/admin/chart-completions', requireAdmin, async (_req, res) => {
  const chartData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const { count } = await db()
      .from('task_completions').select('*', { count: 'exact', head: true })
      .gte('completed_at', `${dateStr}T00:00:00.000Z`)
      .lte('completed_at', `${dateStr}T23:59:59.999Z`);
    chartData.push({ date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), completions: count ?? 0 });
  }
  res.json(chartData);
});

// ── Admin management routes ───────────────────────────────────────────────────
app.get('/api/admin/admins', requireAdmin, async (_req, res) => {
  const { data, error } = await db().from('admins').select('id, email, name, is_active, created_at').order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/admin/admins', requireAdmin, async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  const hash = await bcrypt.hash(password, 10);
  const { data, error } = await db().from('admins')
    .insert({ email: email.toLowerCase().trim(), password_hash: hash, name: name?.trim() || null, is_active: true })
    .select('id, email, name, is_active, created_at').single();
  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'An admin with that email already exists.' });
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json(data);
});

app.patch('/api/admin/admins/:adminId', requireAdmin, async (req, res) => {
  const { name, is_active, password } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name?.trim() || null;
  if (is_active !== undefined) updates.is_active = is_active;
  if (password) {
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    updates.password_hash = await bcrypt.hash(password, 10);
  }
  const { data, error } = await db().from('admins')
    .update(updates).eq('id', req.params.adminId)
    .select('id, email, name, is_active, created_at').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/admin/admins/:adminId', requireAdmin, async (req, res) => {
  // Prevent deleting the last active admin
  const { count } = await db().from('admins').select('*', { count: 'exact', head: true }).eq('is_active', true);
  if ((count ?? 0) <= 1) return res.status(400).json({ error: 'Cannot delete the last active admin.' });
  const { error } = await db().from('admins').delete().eq('id', req.params.adminId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ── Tags routes ───────────────────────────────────────────────────────────────
app.get('/api/admin/tags', requireAdmin, async (_req, res) => {
  const { data, error } = await db().from('tags').select('*').order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/admin/tags', requireAdmin, async (req, res) => {
  const { name, color } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Tag name required.' });
  const { data, error } = await db()
    .from('tags').insert({ name: name.trim(), color: color || '#7C3AED' }).select().single();
  if (error) return res.status(error.code === '23505' ? 400 : 500).json({ error: error.code === '23505' ? 'Tag name already exists.' : error.message });
  res.status(201).json(data);
});

app.delete('/api/admin/tags/:tagId', requireAdmin, async (req, res) => {
  const { error } = await db().from('tags').delete().eq('id', req.params.tagId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.get('/api/tasks/:taskId/tags', requireAdmin, async (req, res) => {
  const { data, error } = await db()
    .from('task_tags').select('tag_id, tags(*)').eq('task_id', req.params.taskId);
  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map((row: any) => row.tags));
});

app.put('/api/tasks/:taskId/tags', requireAdmin, async (req, res) => {
  const { tag_ids } = req.body;
  await db().from('task_tags').delete().eq('task_id', req.params.taskId);
  if (Array.isArray(tag_ids) && tag_ids.length > 0) {
    await db().from('task_tags').insert(tag_ids.map((tagId: string) => ({ task_id: req.params.taskId, tag_id: tagId })));
  }
  res.json({ success: true });
});

// ── Analytics route ───────────────────────────────────────────────────────────
app.get('/api/admin/analytics', requireAdmin, async (_req, res) => {
  const [campsRes, tasksRes, compsRes, tagsRes, taskTagsRes] = await Promise.all([
    db().from('campaigns').select('*'),
    db().from('tasks').select('*'),
    db().from('task_completions').select('*'),
    db().from('tags').select('*'),
    db().from('task_tags').select('*')
  ]);

  const campaigns = campsRes.data || [];
  const tasks = tasksRes.data || [];
  const completions = compsRes.data || [];
  const tags = tagsRes.data || [];
  const taskTags = taskTagsRes.data || [];

  const llmMap: Record<string, number> = {};
  completions.forEach((c: any) => {
    const task = tasks.find((t: any) => t.id === c.task_id);
    if (task?.type === 'llm_search' && task.llm_target) {
      llmMap[task.llm_target] = (llmMap[task.llm_target] || 0) + 1;
    }
  });
  const llmStats = Object.entries(llmMap).map(([target, count]) => ({
    target, label: target.charAt(0).toUpperCase() + target.slice(1), completions: count
  }));

  const campaignStats = campaigns.map((camp: any) => {
    const cc = completions.filter((c: any) => c.campaign_id === camp.id);
    return {
      id: camp.id, title: camp.title, status: camp.status,
      totalTasks: tasks.filter((t: any) => t.campaign_id === camp.id).length,
      totalCompletions: cc.length,
      uniqueParticipants: new Set(cc.map((c: any) => c.participant_id)).size,
      flaggedCount: cc.filter((c: any) => c.is_flagged).length
    };
  });

  const taskStats = tasks.map((task: any) => {
    const tc = completions.filter((c: any) => c.task_id === task.id);
    const camp = campaigns.find((c: any) => c.id === task.campaign_id);
    const tagIds = taskTags.filter((tt: any) => tt.task_id === task.id).map((tt: any) => tt.tag_id);
    return {
      id: task.id, label: task.label, type: task.type, llm_target: task.llm_target,
      campaignTitle: camp?.title || 'Unknown',
      totalCompletions: tc.length,
      screenshotCount: tc.filter((c: any) => c.proof_type === 'screenshot').length,
      linkCount: tc.filter((c: any) => c.proof_type === 'link').length,
      flaggedCount: tc.filter((c: any) => c.is_flagged).length,
      tags: tagIds.map((id: string) => tags.find((t: any) => t.id === id)?.name).filter(Boolean)
    };
  });

  const tagStats = tags.map((tag: any) => {
    const taggedTaskIds = taskTags.filter((tt: any) => tt.tag_id === tag.id).map((tt: any) => tt.task_id);
    const tc = completions.filter((c: any) => taggedTaskIds.includes(c.task_id));
    return {
      id: tag.id, name: tag.name, color: tag.color,
      tasksCount: taggedTaskIds.length, completionsCount: tc.length,
      flaggedCount: tc.filter((c: any) => c.is_flagged).length
    };
  });

  res.json({ llmStats, campaignStats, taskStats, tagStats });
});

// ── Error reports routes ──────────────────────────────────────────────────────
app.get('/api/error-reports', requireAdmin, async (_req, res) => {
  const { data, error } = await db().from('error_reports').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/error-reports', async (req, res) => {
  const { participant_id, page, description } = req.body;
  if (!description?.trim()) return res.status(400).json({ error: 'Description required.' });
  const { data, error } = await db()
    .from('error_reports')
    .insert({ participant_id: participant_id || null, page: page || 'unknown', description: description.trim(), is_resolved: false })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

app.put('/api/error-reports/:id/resolve', requireAdmin, async (req, res) => {
  const { data, error } = await db()
    .from('error_reports').update({ is_resolved: true }).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default app;
