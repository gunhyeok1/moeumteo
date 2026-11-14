import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { zipSync } from 'fflate';
import { getContestBySlug, listSubmissions, DELETED_STATUS } from '../../../lib/db';
import { buildSubmissionFileEntries } from '../../../lib/submission-zip';

// 학생들이 올린 작품/발표자료 파일을 지금 목록 화면에 보이는 필터(분야/검색/상태 탭)
// 그대로 적용해서 한 번에 zip으로 묶어 다운로드. 파일명/폴더 규칙은
// lib/submission-zip.ts 에 모아두고 분야별 zip(download-files-by-category.zip.ts)과
// 공유함.

export const GET: APIRoute = async ({ params, url }) => {
  const db = env.DB;
  const contest = params.slug ? await getContestBySlug(db, params.slug) : null;
  if (!contest) {
    return new Response('Not found', { status: 404 });
  }

  const sp = url.searchParams;
  const status = sp.get('status') || undefined;
  const submissions = await listSubmissions(db, {
    contestId: contest.id,
    search: sp.get('q') || undefined,
    status,
    excludeStatus: status ? undefined : DELETED_STATUS,
    category: sp.get('category') || undefined,
    sort: (sp.get('sort') as any) || 'created_at',
    order: (sp.get('order') as any) || 'desc',
  });

  const files = await buildSubmissionFileEntries(env, submissions);

  if (Object.keys(files).length === 0) {
    return new Response('다운로드할 파일이 없어요 (해당 조건에 첨부된 파일이 없음).', { status: 404 });
  }

  const zipped = zipSync(files, { level: 0 });
  const label = status ? `-${status}` : '';

  return new Response(zipped, {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${contest.slug}${label}-files.zip"`,
    },
  });
};
