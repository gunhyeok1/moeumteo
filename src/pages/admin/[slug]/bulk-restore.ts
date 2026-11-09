import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getContestBySlug, getSubmission, setSubmissionStatus } from '../../../lib/db';

// "삭제함" 탭에서 체크박스로 고른 제출물을 다시 "접수" 상태로 되돌림.
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
    await setSubmissionStatus(db, id, '접수');
  }

  const qs = redirectQs ? (redirectQs.startsWith('?') ? redirectQs : `?${redirectQs}`) : '';
  return Response.redirect(new URL(`/admin/${contest.slug}${qs}`, request.url).toString(), 303);
};
