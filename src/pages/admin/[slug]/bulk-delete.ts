import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getContestBySlug, getSubmission, deleteSubmission } from '../../../lib/db';
import { deleteSubmissionFile } from '../../../lib/storage';

// 관리자 목록 화면에서 체크박스로 고른 제출물을 한 번에 삭제 (테스트 제출물 정리용).
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
    if (submission.work_file_key) await deleteSubmissionFile(env, submission.work_file_key);
    if (submission.slide_file_key) await deleteSubmissionFile(env, submission.slide_file_key);
    await deleteSubmission(db, id);
  }

  const qs = redirectQs ? (redirectQs.startsWith('?') ? redirectQs : `?${redirectQs}`) : '';
  return Response.redirect(new URL(`/admin/${contest.slug}${qs}`, request.url).toString(), 303);
};
