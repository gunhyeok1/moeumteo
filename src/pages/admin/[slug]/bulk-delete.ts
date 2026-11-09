import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getContestBySlug, getSubmission, setSubmissionStatus, DELETED_STATUS } from '../../../lib/db';

// 관리자 목록 화면에서 체크박스로 고른 제출물을 "삭제함" 상태로 옮김 (실제로 지우진 않음).
// 파일/DB 레코드가 그대로 남아있어서 "삭제함" 탭에서 다시 복구할 수 있음.
// /admin 하위 경로라 middleware.ts에서 로그인 여부를 이미 검사함.
export const POST: APIRoute = async ({ params, request }) => {
  const { slug } = params;
  const db = env.DB;
  const contest = slug ? await getContestBySlug(db, slug) : null;
  if (!contest) {
    return new Response('Not found', { status: 404 });
  }

  const form = await request.formData();
  const ids = form.getAll('ids').map(String);
  const redirectQs = String(form.get('redirect_qs') ?? '');

  for (const id of ids) {
    const submission = await getSubmission(db, id);
    if (!submission || submission.contest_id !== contest.id) continue;
    await setSubmissionStatus(db, id, DELETED_STATUS);
  }

  const qs = redirectQs ? (redirectQs.startsWith('?') ? redirectQs : `?${redirectQs}`) : '';
  return Response.redirect(new URL(`/admin/${contest.slug}${qs}`, request.url).toString(), 303);
};
