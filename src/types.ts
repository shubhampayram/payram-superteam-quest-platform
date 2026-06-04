/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type LLMTarget =
  | 'chatgpt'
  | 'perplexity'
  | 'gemini'
  | 'claude'
  | 'deepseek'
  | 'grok'
  | 'copilot'
  | 'meta'
  | '';

export interface Campaign {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'disabled';
  superteam_submission_url: string;
  created_at: string;
}

export interface Task {
  id: string;
  campaign_id: string;
  type: 'llm_search' | 'blog';
  label: string;
  description: string;
  llm_target: LLMTarget;
  llm_prompt: string;
  blog_prompt: string;
  blog_platforms_whitelist: string[] | null;
  display_order: number;
  created_at: string;
}

export interface Participant {
  id: string;
  superteam_username: string;
  email: string;
  country: string;
  twitter_handle: string | null;
  created_at: string;
}

export interface TaskCompletion {
  id: string;
  participant_id: string;
  task_id: string;
  campaign_id: string;
  completed_at: string;
  proof_type: 'screenshot' | 'link';
  proof_screenshot_url: string | null;
  proof_link: string | null;
  is_flagged: boolean;
  flag_reason: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  created_at: string;
}

// ── Tags (admin-internal, never shown to participants) ───────────────────────

export interface Tag {
  id: string;
  name: string;
  color: string; // hex colour
  created_at: string;
}

export interface TaskTag {
  task_id: string;
  tag_id: string;
}

// ── Error reports ────────────────────────────────────────────────────────────

export interface ErrorReport {
  id: string;
  participant_id: string | null;
  page: string;
  description: string;
  created_at: string;
  is_resolved: boolean;
}

// ── Analytics (returned by /api/admin/analytics) ─────────────────────────────

export interface LLMStat {
  target: string;
  label: string;
  completions: number;
}

export interface CampaignStat {
  id: string;
  title: string;
  status: string;
  totalTasks: number;
  totalCompletions: number;
  uniqueParticipants: number;
  flaggedCount: number;
}

export interface TaskStat {
  id: string;
  label: string;
  type: string;
  llm_target: string;
  campaignTitle: string;
  totalCompletions: number;
  screenshotCount: number;
  linkCount: number;
  flaggedCount: number;
  tags: string[];
}

export interface TagStat {
  id: string;
  name: string;
  color: string;
  tasksCount: number;
  completionsCount: number;
  flaggedCount: number;
}

export interface AnalyticsData {
  llmStats: LLMStat[];
  campaignStats: CampaignStat[];
  taskStats: TaskStat[];
  tagStats: TagStat[];
}
