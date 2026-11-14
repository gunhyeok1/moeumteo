import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { zipSync } from 'fflate';
import { getContestBySlug, listSubmissions, DELETED_STATUS } from '../../../lib/db';
import { getSubmissionFile } from '../../../lib/storage';
import { buildFriendlyFileName, buildFriendlyBaseName, extensionOf } from '../../../lib/friendly-filename';

// 학생들이 올린 작품/발표자료 파일을 지금 목록 화면에 보이는 필터(분야/검색/상태 탭)
// 그대로 적용해서 한 번에 zip으로 묶어 다운로드. 파일 이름 규칙은
// lib/friendly-filename.ts 에 모아두고 개별 다운로드(files/[...key].ts)와
// 공유함 — 둘 다 똑같이 "학년반번호_이름_작품제목" 형식으로 나오도록.
// 작품+발표자료를 둘 다 올린 학생은 "2개 올렸구나"가 한눈에 보이도록
// "학년반번호_이름_작품제목" 폴더 안에 작품/발표자료 두 파일을 같이 넣음.
// 하나만 올린 학생은 예전처럼 폴더 없이 파일 하나만 그대로 둠.

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

  const files: Record<string, Uint8Array> = {};
  const usedNames = new Set<string>();

  function reserveName(name: string): string {
    let candidate = name;
    let n = 2;
    while (usedNames.has(candidate)) {
      candidate = name.replace(/(\.[^.]*)?$/, (ext) => `_${n++}${ext}`);
    }
    usedNames.add(candidate);
    return candidate;
  }

  for (const s of submissions) {
    const hasBoth = !!(s.work_file_key && s.slide_file_key);
    const folderName = hasBoth ? reserveName(buildFriendlyBaseName(s)) : null;

    if (s.work_file_key) {
      const file = await getSubmissionFile(env, s.work_file_key);
      if (file) {
        const bytes = new Uint8Array(await new Response(file.body as any).arrayBuffer());
        const path = folderName
          ? `${folderName}/작품${extensionOf(file.filename || s.work_file_name || '')}`
          : reserveName(buildFriendlyFileName(s, 'work', file.filename || s.work_file_name || ''));
        files[path] = bytes;
      }
    }
    if (s.slide_file_key) {
      const file = await getSubmissionFile(env, s.slide_file_key);
      if (file) {
        const bytes = new Uint8Array(await new Response(file.body as any).arrayBuffer());
        const path = folderName
          ? `${folderName}/발표자료${extensionOf(file.filename || s.slide_file_name || '')}`
          : reserveName(buildFriendlyFileName(s, 'slide', file.filename || s.slide_file_name || ''));
        files[path] = bytes;
      }
    }
  }

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
