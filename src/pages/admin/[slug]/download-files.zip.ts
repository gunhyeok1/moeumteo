import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { zipSync } from 'fflate';
import { getContestBySlug, listSubmissions, DELETED_STATUS } from '../../../lib/db';
import { getSubmissionFile } from '../../../lib/storage';

// 학생들이 올린 작품/발표자료 파일을 지금 목록 화면에 보이는 필터(분야/검색/상태 탭)
// 그대로 적용해서 한 번에 zip으로 묶어 다운로드. 파일 이름이 다 비슷해서 구분이
// 안 가는 문제를 막으려고 파일명을 다음 규칙으로 바꿔서 저장함:
//  - 개인: 학년반번호_이름_작품제목
//  - 모둠: 모둠이름_대표학생(학년반번호_이름)_작품제목
// (모둠명만으로는 실제 누구인지 알 수 없어서 대표 학생 정보도 같이 붙임)

function sanitizeSegment(value: string): string {
  return value
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim()
    .slice(0, 60) || '이름없음';
}

function extensionOf(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx) : '';
}

function studentTag(p: { grade?: number | string; classNo?: number | string; number?: number | string; name?: string; raw?: string } | undefined): string {
  if (!p) return '';
  if (p.grade) return `${p.grade}학년${p.classNo}반${p.number}번_${p.name || ''}`;
  return p.name || p.raw || '';
}

function buildBaseName(s: any): string {
  const first = s.participants[0];
  const titlePart = sanitizeSegment(s.title || '제출물');
  let who: string;

  if (s.participation_type === 'team') {
    const teamName = sanitizeSegment(s.team_name || '모둠');
    const repTag = sanitizeSegment(studentTag(first) || '대표자없음');
    who = `${teamName}_${repTag}`;
  } else {
    who = sanitizeSegment(studentTag(first) || s.title || '이름없음');
  }
  return `${who}_${titlePart}`;
}

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
    const baseName = buildBaseName(s);

    if (s.work_file_key) {
      const file = await getSubmissionFile(env, s.work_file_key);
      if (file) {
        const ext = extensionOf(file.filename) || extensionOf(s.work_file_name);
        const bytes = new Uint8Array(await new Response(file.body as any).arrayBuffer());
        files[reserveName(`${baseName}_작품${ext}`)] = bytes;
      }
    }
    if (s.slide_file_key) {
      const file = await getSubmissionFile(env, s.slide_file_key);
      if (file) {
        const ext = extensionOf(file.filename) || extensionOf(s.slide_file_name);
        const bytes = new Uint8Array(await new Response(file.body as any).arrayBuffer());
        files[reserveName(`${baseName}_발표자료${ext}`)] = bytes;
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
