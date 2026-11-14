import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getSubmissionFile } from '../../../lib/storage';
import { getSubmission } from '../../../lib/db';
import { buildFriendlyFileName } from '../../../lib/friendly-filename';

// 저장 키는 "{contestSlug}/{submissionId}/work-{timestamp}-{원본파일명}" 형태라
// (R2 영상은 앞에 "r2v:" 접두사만 더 붙음) 키 안에서 접수번호(submissionId)를
// 뽑아낼 수 있음. 그 접수번호로 제출 정보를 다시 조회해서, zip 전체 다운로드와
// 똑같은 "학년반번호_이름_작품제목" 이름을 개별 다운로드에도 그대로 적용함.
function parseKey(key: string): { submissionId: string; field: 'work' | 'slide' } | null {
  const rawKey = key.startsWith('r2v:') ? key.slice(4) : key;
  const parts = rawKey.split('/');
  if (parts.length < 3) return null;
  const submissionId = parts[1];
  const fieldPart = parts[2];
  if (fieldPart.startsWith('work-')) return { submissionId, field: 'work' };
  if (fieldPart.startsWith('slide-')) return { submissionId, field: 'slide' };
  return null;
}

export const GET: APIRoute = async ({ params }) => {
  const key = params.key;
  if (!key) {
    return new Response('Not found', { status: 404 });
  }

  const file = await getSubmissionFile(env, key);
  if (!file) {
    return new Response('파일을 찾을 수 없어요.', { status: 404 });
  }

  let filename = file.filename;
  const parsed = parseKey(key);
  if (parsed) {
    const submission = await getSubmission(env.DB, parsed.submissionId);
    if (submission) {
      filename = buildFriendlyFileName(submission, parsed.field, file.filename);
    }
  }

  const headers = new Headers();
  headers.set('content-type', file.contentType);
  headers.set('content-disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

  return new Response(file.body, { headers });
};
