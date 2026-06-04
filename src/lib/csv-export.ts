function escapeCsvCell(value: string | null | undefined): string {
  const str = String(value ?? '');
  // Prefix formula-injection characters to neutralize in Excel/Sheets
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
      escapeCsvCell(r.username),
      escapeCsvCell(r.email),
      escapeCsvCell(r.country),
      escapeCsvCell(r.twitter),
      escapeCsvCell(r.taskName),
      escapeCsvCell(r.campaignName),
      escapeCsvCell(r.proof_type),
      escapeCsvCell(r.proof_url),
      escapeCsvCell(r.completed_at),
      r.is_flagged ? 'true' : 'false',
      escapeCsvCell(r.flag_reason)
    ].join(',')
  ).join('\n');

  triggerDownload(`${header}\n${body}`, `payram-submissions-${todayDate()}.csv`);
}

export function exportUsersCSV(rows: UserRow[]): void {
  const header = [
    'Username', 'Email', 'Country', 'Twitter Handle',
    'Date Joined', 'Completions Count'
  ].join(',');

  const body = rows.map(r =>
    [
      escapeCsvCell(r.superteam_username),
      escapeCsvCell(r.email),
      escapeCsvCell(r.country),
      escapeCsvCell(r.twitter_handle),
      escapeCsvCell(r.created_at),
      String(r.completions_count)
    ].join(',')
  ).join('\n');

  triggerDownload(`${header}\n${body}`, `payram-users-${todayDate()}.csv`);
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
