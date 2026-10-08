import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getContestBySlug, listSubmissions } from '../../../lib/db';

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export const GET: APIRoute = async ({ params, url, locals, request }) => {
  const db = env.DB;
  const contest = params.slug ? await getContestBySlug(db, params.slug) : null;
  if (!contest) {
    return new Response('Not found', { status: 404 });
  }

  const origin = new URL(request.url).origin;

  const sp = url.searchParams;
  const submissions = await listSubmissions(db, {
    contestId: contest.id,
    search: sp.get('q') || undefined,
    status: sp.get('status') || undefined,
    category: sp.get('category') || undefined,
    sort: (sp.get('sort') as any) || 'created_at',
    order: (sp.get('order') as any) || 'desc',
  });

  const header = [
    '접수번호',
    '작품제목',
    '분야',
    '주제',
    '자유주제내용',
    '작품링크',
    '작품파일다운로드',
    '발표자료파일다운로드',
    '사용AI도구',
    '참가형태',
    '모둠명',
    '참가자',
    '상태',
    '관리자메모',
    '제출시각',
  ];

  const rows = submissions.map((s) => [
    s.id,
    s.title,
    s.category,
    s.topic,
    s.free_topic_text,
    s.work_link,
    s.work_file_key ? `${origin}/admin/files/${s.work_file_key}` : '',
    s.slide_file_key ? `${origin}/admin/files/${s.slide_file_key}` : '',
    s.ai_tools,
    s.participation_type === 'team' ? '모둠' : '개인',
    s.team_name,
    s.participants.map((p) => p.raw).join('; '),
    s.status,
    s.admin_note,
    new Date(s.created_at).toLocaleString('ko-KR'),
  ]);

  const csv = [header, ...rows].map((r) => r.map((v) => csvEscape(String(v ?? ''))).join(',')).join('\n');
  const body = '﻿' + csv; // BOM for Excel 한글 호환

  return new Response(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${contest.slug}-submissions.csv"`,
    },
  });
};
