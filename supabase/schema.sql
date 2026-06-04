-- ==========================================
-- PAYRAM COMMUNITY QUEST PLATFORM
-- Database Schema + RLS Policies
-- ==========================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── TABLES ────────────────────────────────

CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    superteam_submission_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('llm_search', 'blog')),
    label TEXT NOT NULL,
    description TEXT,
    llm_target TEXT CHECK (llm_target IN ('chatgpt', 'perplexity', 'gemini', 'claude', '')),
    llm_prompt TEXT,
    blog_prompt TEXT,
    blog_platforms_whitelist TEXT[],
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    superteam_username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    country TEXT NOT NULL,
    twitter_handle TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE task_completions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    proof_type TEXT NOT NULL CHECK (proof_type IN ('screenshot', 'link')),
    proof_screenshot_url TEXT,
    proof_link TEXT,
    is_flagged BOOLEAN NOT NULL DEFAULT false,
    flag_reason TEXT,
    CONSTRAINT unique_participant_task UNIQUE (participant_id, task_id)
);

CREATE TABLE admin_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── STORAGE ───────────────────────────────

-- Run in Supabase Dashboard > Storage:
-- 1. Create bucket named "screenshots" (private)
-- 2. Then run the policies below

-- ── ENABLE RLS ────────────────────────────

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- ── CAMPAIGNS ─────────────────────────────

-- Public can read active campaigns
CREATE POLICY "public_read_active_campaigns" ON campaigns
    FOR SELECT
    USING (status = 'active');

-- Authenticated admins can read ALL campaigns (including disabled)
CREATE POLICY "admin_read_all_campaigns" ON campaigns
    FOR SELECT
    TO authenticated
    USING (true);

-- Only authenticated admins can insert
CREATE POLICY "admin_insert_campaigns" ON campaigns
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Only authenticated admins can update
CREATE POLICY "admin_update_campaigns" ON campaigns
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Only authenticated admins can delete
CREATE POLICY "admin_delete_campaigns" ON campaigns
    FOR DELETE
    TO authenticated
    USING (true);

-- ── TASKS ─────────────────────────────────

-- Anyone can read tasks
CREATE POLICY "public_read_tasks" ON tasks
    FOR SELECT
    USING (true);

-- Only authenticated admins can insert/update/delete
CREATE POLICY "admin_insert_tasks" ON tasks
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "admin_update_tasks" ON tasks
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "admin_delete_tasks" ON tasks
    FOR DELETE
    TO authenticated
    USING (true);

-- ── PARTICIPANTS ──────────────────────────

-- Anyone can register (self-service, no auth required)
CREATE POLICY "public_insert_participant" ON participants
    FOR INSERT
    WITH CHECK (true);

-- Anyone can look up participants by username (needed for returning user check)
CREATE POLICY "public_read_participants" ON participants
    FOR SELECT
    USING (true);

-- ── TASK COMPLETIONS ─────────────────────

-- Anyone can submit a completion (participants have no auth account)
CREATE POLICY "public_insert_completion" ON task_completions
    FOR INSERT
    WITH CHECK (true);

-- Anyone can read completions (client filters by participant_id stored in localStorage)
CREATE POLICY "public_read_completions" ON task_completions
    FOR SELECT
    USING (true);

-- Only authenticated admins can flag/unflag (UPDATE)
CREATE POLICY "admin_update_completions" ON task_completions
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Only authenticated admins can delete
CREATE POLICY "admin_delete_completions" ON task_completions
    FOR DELETE
    TO authenticated
    USING (true);

-- ── ADMIN USERS ───────────────────────────

-- Only authenticated users can read their own admin record
CREATE POLICY "admin_read_own_record" ON admin_users
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

-- ── STORAGE POLICIES (run after creating bucket) ──

-- Allow anyone to upload to screenshots bucket
-- (participants don't have auth, so we allow anon)
-- In Supabase Dashboard > Storage > screenshots > Policies:
--
-- INSERT policy (name: "allow_uploads"):
--   Roles: anon, authenticated
--   USING: true
--   WITH CHECK: true
--
-- SELECT policy (name: "admin_view_screenshots"):
--   Roles: authenticated
--   USING: true

-- ── TAGS (admin-internal labels) ────────────────────────────────────────────

CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#7C3AED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE task_tags (
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    tag_id  UUID NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
    PRIMARY KEY (task_id, tag_id)
);

ALTER TABLE tags      ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_tags ENABLE ROW LEVEL SECURITY;

-- Only authenticated admins can read/write tags
CREATE POLICY "admin_all_tags" ON tags
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "admin_all_task_tags" ON task_tags
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── ERROR REPORTS ─────────────────────────────────────────────────────────────

CREATE TABLE error_reports (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
    page           TEXT,
    description    TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_resolved    BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE error_reports ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a report (participants have no auth)
CREATE POLICY "public_insert_error_report" ON error_reports
    FOR INSERT WITH CHECK (true);

-- Only authenticated admins can read and update
CREATE POLICY "admin_read_error_reports" ON error_reports
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin_update_error_reports" ON error_reports
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ── FIRST ADMIN SETUP ─────────────────────
-- After creating your admin via Supabase Auth dashboard, run:
--
-- INSERT INTO admin_users (id, email)
-- VALUES ('<your-auth-user-uuid>', 'admin@payram.co');
