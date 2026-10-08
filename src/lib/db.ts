import { generateReceiptId } from './validation';

export interface Contest {
  id: string;
  slug: string;
  name: string;
  description: string;
  categories: string; // JSON string[]
  topics: string; // JSON string[]
  allow_free_topic: number;
  allow_team: number;
  max_participants: number;
  video_category: string; // 이 분야만 작품을 링크(유튜브 등)로 받음. 비우면 전체 파일 업로드
  start_at: string | null;
  end_at: string | null;
  is_active: number;
  created_at: string;
}

export interface Submission {
  id: string;
  contest_id: string;
  category: string;
  topic: string;
  free_topic_text: string;
  title: string;
  description: string;
  work_link: string;
  slide_link: string;
  work_file_key: string;
  work_file_name: string;
  work_file_size: number;
  slide_file_key: string;
  slide_file_name: string;
  slide_file_size: number;
  ai_tools: string;
  participation_type: string;
  team_name: string;
  participants: string; // JSON array
  privacy_consent: number;
  exhibit_consent: number;
  pledge_consent: number;
  status: string;
  admin_note: string;
  created_at: string;
  updated_at: string;
}

export function parseContest(c: Contest) {
  return {
    ...c,
    categories: safeJsonArray(c.categories),
    topics: safeJsonArray(c.topics),
  };
}

export function parseSubmission(s: Submission) {
  return {
    ...s,
    participants: safeJsonArray(s.participants) as Array<{
      raw: string;
      grade: number;
      classNo: number;
      number: number;
      name: string;
    }>,
  };
}

function safeJsonArray(value: string): any[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function listContests(db: D1Database, opts: { activeOnly?: boolean } = {}) {
  const query = opts.activeOnly
    ? 'SELECT * FROM contests WHERE is_active = 1 ORDER BY created_at DESC'
    : 'SELECT * FROM contests ORDER BY created_at DESC';
  const { results } = await db.prepare(query).all<Contest>();
  return results.map(parseContest);
}

export async function getContestBySlug(db: D1Database, slug: string) {
  const row = await db.prepare('SELECT * FROM contests WHERE slug = ?').bind(slug).first<Contest>();
  return row ? parseContest(row) : null;
}

export async function getContestById(db: D1Database, id: string) {
  const row = await db.prepare('SELECT * FROM contests WHERE id = ?').bind(id).first<Contest>();
  return row ? parseContest(row) : null;
}

export interface ContestInput {
  slug: string;
  name: string;
  description: string;
  categories: string[];
  topics: string[];
  allowFreeTopic: boolean;
  allowTeam: boolean;
  maxParticipants: number;
  videoCategory?: string; // 이 분야만 작품을 링크로 받음 (비우면 전체 파일 업로드)
  startAt?: string | null;
  endAt?: string | null;
  isActive: boolean;
}

export async function createContest(db: D1Database, input: ContestInput) {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO contests (id, slug, name, description, categories, topics, allow_free_topic, allow_team, max_participants, video_category, start_at, end_at, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.slug,
      input.name,
      input.description,
      JSON.stringify(input.categories),
      JSON.stringify(input.topics),
      input.allowFreeTopic ? 1 : 0,
      input.allowTeam ? 1 : 0,
      input.maxParticipants,
      input.videoCategory ?? '',
      input.startAt ?? null,
      input.endAt ?? null,
      input.isActive ? 1 : 0
    )
    .run();
  return id;
}

export async function updateContest(db: D1Database, id: string, input: ContestInput) {
  await db
    .prepare(
      `UPDATE contests SET slug = ?, name = ?, description = ?, categories = ?, topics = ?, allow_free_topic = ?, allow_team = ?, max_participants = ?, video_category = ?, start_at = ?, end_at = ?, is_active = ?
       WHERE id = ?`
    )
    .bind(
      input.slug,
      input.name,
      input.description,
      JSON.stringify(input.categories),
      JSON.stringify(input.topics),
      input.allowFreeTopic ? 1 : 0,
      input.allowTeam ? 1 : 0,
      input.maxParticipants,
      input.videoCategory ?? '',
      input.startAt ?? null,
      input.endAt ?? null,
      input.isActive ? 1 : 0,
      id
    )
    .run();
}

export interface SubmissionInput {
  contestId: string;
  category: string;
  topic: string;
  freeTopicText: string;
  title: string;
  description: string;
  workLink: string;
  slideLink: string;
  aiTools: string;
  participationType: string;
  teamName: string;
  participants: Array<{ raw: string; grade: number; classNo: number; number: number; name: string }>;
  privacyConsent: boolean;
  exhibitConsent: boolean;
  pledgeConsent: boolean;
}

export async function createSubmission(db: D1Database, input: SubmissionInput): Promise<string> {
  // 접수번호 충돌 시 재시도 (실질적으로 거의 발생하지 않음)
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = generateReceiptId();
    try {
      await db
        .prepare(
          `INSERT INTO submissions (
            id, contest_id, category, topic, free_topic_text, title, description,
            work_link, slide_link, ai_tools, participation_type, team_name, participants,
            privacy_consent, exhibit_consent, pledge_consent, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '접수')`
        )
        .bind(
          id,
          input.contestId,
          input.category,
          input.topic,
          input.freeTopicText,
          input.title,
          input.description,
          input.workLink,
          input.slideLink,
          input.aiTools,
          input.participationType,
          input.teamName,
          JSON.stringify(input.participants),
          input.privacyConsent ? 1 : 0,
          input.exhibitConsent ? 1 : 0,
          input.pledgeConsent ? 1 : 0
        )
        .run();
      return id;
    } catch (err: any) {
      if (String(err?.message ?? '').includes('UNIQUE') && attempt < 4) continue;
      throw err;
    }
  }
  throw new Error('접수번호 생성에 실패했습니다.');
}

export async function getSubmission(db: D1Database, id: string) {
  const row = await db.prepare('SELECT * FROM submissions WHERE id = ?').bind(id).first<Submission>();
  return row ? parseSubmission(row) : null;
}

export interface SubmissionFilesInput {
  workFileKey?: string;
  workFileName?: string;
  workFileSize?: number;
  slideFileKey?: string;
  slideFileName?: string;
  slideFileSize?: number;
}

export async function attachSubmissionFiles(db: D1Database, id: string, files: SubmissionFilesInput) {
  await db
    .prepare(
      `UPDATE submissions SET
        work_file_key = COALESCE(?, work_file_key),
        work_file_name = COALESCE(?, work_file_name),
        work_file_size = COALESCE(?, work_file_size),
        slide_file_key = COALESCE(?, slide_file_key),
        slide_file_name = COALESCE(?, slide_file_name),
        slide_file_size = COALESCE(?, slide_file_size)
       WHERE id = ?`
    )
    .bind(
      files.workFileKey ?? null,
      files.workFileName ?? null,
      files.workFileSize ?? null,
      files.slideFileKey ?? null,
      files.slideFileName ?? null,
      files.slideFileSize ?? null,
      id
    )
    .run();
}

export interface SubmissionFilters {
  contestId: string;
  search?: string;
  status?: string;
  category?: string;
  sort?: 'created_at' | 'title' | 'status';
  order?: 'asc' | 'desc';
}

export async function listSubmissions(db: D1Database, filters: SubmissionFilters) {
  const conditions = ['contest_id = ?'];
  const params: any[] = [filters.contestId];

  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters.category) {
    conditions.push('category = ?');
    params.push(filters.category);
  }
  if (filters.search) {
    conditions.push('(title LIKE ? OR team_name LIKE ? OR participants LIKE ? OR id LIKE ?)');
    const like = `%${filters.search}%`;
    params.push(like, like, like, like);
  }

  const sortCol = (['created_at', 'title', 'status'] as const).includes(filters.sort as any)
    ? filters.sort
    : 'created_at';
  const order = filters.order === 'asc' ? 'ASC' : 'DESC';

  const query = `SELECT * FROM submissions WHERE ${conditions.join(' AND ')} ORDER BY ${sortCol} ${order}`;
  const { results } = await db.prepare(query).bind(...params).all<Submission>();
  return results.map(parseSubmission);
}

export async function updateSubmissionStatus(db: D1Database, id: string, status: string, adminNote?: string) {
  await db
    .prepare(`UPDATE submissions SET status = ?, admin_note = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(status, adminNote ?? '', id)
    .run();
}

export async function getContestStats(db: D1Database, contestId: string) {
  const { results } = await db
    .prepare('SELECT status, COUNT(*) as count FROM submissions WHERE contest_id = ? GROUP BY status')
    .bind(contestId)
    .all<{ status: string; count: number }>();
  const total = results.reduce((sum, r) => sum + r.count, 0);
  return { total, byStatus: results };
}
