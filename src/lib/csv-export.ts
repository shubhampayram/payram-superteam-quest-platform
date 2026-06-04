import type { LLMStat, CampaignStat, TaskStat, TagStat } from '../types.ts';

function escapeCsvCell(value: string | null | undefined): string {
  const str = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${safe.replace(/"/g, '""')}"`;
}

export interface SubmissionRow {
  username: string;
  email: string;
  country: string;
  twitter: string;
  taskName: string;
  campaignName: string;
  proof_type: string;
  proof_url: string;
  completed_at: string;
  is_flagged: boolean;
  flag_reason: string;
}

export interface UserRow {
  superteam_username: string;
  email: string;
  country: string;
  twitter_handle: string;
  created_at: string;
  completions_count: number;
}

function todayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function exportSubmissionsCSV(rows: SubmissionRow[]): void {
  const header = [
    'Username', 'Email', 'Country', 'Twitter',
    'Task', 'Campaign', 'Proof Type', 'Proof URL',
    'Completed At', 'Is Flagged', 'Flag Reason'
  ].join(',');
  const body = rows.map(r =>
    [
      escapeCsvCell(r.username), escapeCsvCell(r.email), escapeCsvCell(r.country), escapeCsvCell(r.twitter),
      escapeCsvCell(r.taskName), escapeCsvCell(r.campaignName), escapeCsvCell(r.proof_type),
      escapeCsvCell(r.proof_url), escapeCsvCell(r.completed_at),
      r.is_flagged ? 'true' : 'false', escapeCsvCell(r.flag_reason)
    ].join(',')
  ).join('\n');
  triggerDownload(`${header}\n${body}`, `payram-submissions-${todayDate()}.csv`);
}

export function exportUsersCSV(rows: UserRow[]): void {
  const header = ['Username', 'Email', 'Country', 'Twitter Handle', 'Date Joined', 'Completions Count'].join(',');
  const body = rows.map(r =>
    [escapeCsvCell(r.superteam_username), escapeCsvCell(r.email), escapeCsvCell(r.country),
     escapeCsvCell(r.twitter_handle), escapeCsvCell(r.created_at), String(r.completions_count)].join(',')
  ).join('\n');
  triggerDownload(`${header}\n${body}`, `payram-users-${todayDate()}.csv`);
}

// ── Analytics exports ─────────────────────────────────────────────────────────

export function exportLLMAnalyticsCSV(rows: LLMStat[], total: number): void {
  const header = ['LLM Platform', 'Completions', 'Share (%)'].join(',');
  const body = rows.map(r =>
    [escapeCsvCell(r.label), String(r.completions),
     total > 0 ? ((r.completions / total) * 100).toFixed(1) + '%' : '0%'].join(',')
  ).join('\n');
  triggerDownload(`${header}\n${body}`, `payram-llm-analytics-${todayDate()}.csv`);
}

export function exportCampaignAnalyticsCSV(rows: CampaignStat[]): void {
  const header = ['Campaign', 'Status', 'Total Tasks', 'Total Completions', 'Unique Participants', 'Flagged'].join(',');
  const body = rows.map(r =>
    [escapeCsvCell(r.title), escapeCsvCell(r.status), String(r.totalTasks),
     String(r.totalCompletions), String(r.uniqueParticipants), String(r.flaggedCount)].join(',')
  ).join('\n');
  triggerDownload(`${header}\n${body}`, `payram-campaign-analytics-${todayDate()}.csv`);
}

export function exportTaskAnalyticsCSV(rows: TaskStat[]): void {
  const header = ['Task', 'Campaign', 'Type', 'LLM Target', 'Total Completions', 'Screenshots', 'Links', 'Flagged', 'Tags'].join(',');
  const body = rows.map(r =>
    [escapeCsvCell(r.label), escapeCsvCell(r.campaignTitle), escapeCsvCell(r.type),
     escapeCsvCell(r.llm_target), String(r.totalCompletions), String(r.screenshotCount),
     String(r.linkCount), String(r.flaggedCount), escapeCsvCell(r.tags.join('; '))].join(',')
  ).join('\n');
  triggerDownload(`${header}\n${body}`, `payram-task-analytics-${todayDate()}.csv`);
}

export function exportTagAnalyticsCSV(rows: TagStat[]): void {
  const header = ['Tag', 'Tasks Tagged', 'Completions', 'Flagged'].join(',');
  const body = rows.map(r =>
    [escapeCsvCell(r.name), String(r.tasksCount), String(r.completionsCount), String(r.flaggedCount)].join(',')
  ).join('\n');
  triggerDownload(`${header}\n${body}`, `payram-tag-analytics-${todayDate()}.csv`);
}

function triggerDownload(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
