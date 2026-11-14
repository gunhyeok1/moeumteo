import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { zipSync } from 'fflate';
import { getContestBySlug, listSubmissions, DELETED_STATUS } from '../../../lib/db';
import { buildSubmissionFileEntries } from '../../../lib/submission-zip';
import { sanitizeSegment } from '../../../lib/friendly-filename';

// 선생님한테 분야별로 따로 전달해야 할 때, 관리자가 분야를 하나씩 바꿔가며
// zip을 여러 번 받을 필요 없이 한 번에 받도록 — 대회에 등록된 분야(공모분야)
// 하나당 zip 파일 하나씩 만들어서, 그 zip들을 다시 하나의 zip으로 묶어서 줌.
// (상태 필터는 기존 "작품 파일 전체 다운로드" 버튼처럼 그대로 적용되고,
// 분야 필터만 무시하고 대회의 모든 분야를 각각 처리함)

export const GET: APIRoute = async ({ params, url }) => {
  const db = env.DB;
  const contest = params.slug ? await getContestBySlug(db, params.slug) : null;
  if (!contest) {
    return new Response('Not found', { status: 404 });
  }

  const sp = url.searchParams;
  const status = sp.get('status') || undefined;

  const outer: Record<string, Uint8Array> = {};
  const usedCategoryNames = new Set<string>();

  function reserveCategoryName(name: string): string {
    let candidate = name;
    let n = 2;
    while (usedCategoryNames.has(candidate)) {
      candidate = `${name}_${n++}`;
    }
    usedCategoryNames.add(candidate);
    return candidate;
  }

  for (const category of contest.categories) {
    const submissions = await listSubmissions(db, {
      contestId: contest.id,
      search: sp.get('q') || undefined,
      status,
      excludeStatus: status ? undefined : DELETED_STATUS,
      category,
      sort: (sp.get('sort') as any) || 'created_at',
      order: (sp.get('order') as any) || 'desc',
    });

    const files = await buildSubmissionFileEntries(env, submissions);
    if (Object.keys(files).length === 0) continue;

    const innerZip = zipSync(files, { level: 0 });
    const name = reserveCategoryName(sanitizeSegment(category) || '분야');
    outer[`${name}.zip`] = innerZip;
  }

  if (Object.keys(outer).length === 0) {
    return new Response('다운로드할 파일이 없어요 (해당 조건에 첨부된 파일이 없음).', { status: 404 });
  }

  const zipped = zipSync(outer, { level: 0 });
  const label = status ? `-${status}` : '';

  return new Response(zipped, {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${contest.slug}${label}-분야별-files.zip"`,
    },
  });
};
