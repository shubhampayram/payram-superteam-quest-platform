/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
  llm_target: 'chatgpt' | 'perplexity' | 'gemini' | 'claude' | '';
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
