// 학생들이 올린 작품/발표자료 파일 이름이 다 비슷해서(ex. "작품.html") 누구 건지
// 구분이 안 되는 문제를 막기 위한 "알아보기 쉬운 파일명" 생성기.
// zip 전체 다운로드(download-files.zip.ts)와 개별 파일 다운로드(files/[...key].ts)
// 양쪽에서 같은 규칙을 쓰도록 여기 한 곳에 모아둠.
//  - 개인: 학년반번호_이름_작품제목_작품(또는 발표자료).확장자
//  - 모둠: 모둠이름_대표학생 학년반번호_이름_작품제목_작품(또는 발표자료).확장자

import type { Submission } from './db';

export function sanitizeSegment(value: string): string {
  return value
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim()
    .slice(0, 60) || '이름없음';
}

export function extensionOf(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx) : '';
}

function studentTag(p: { grade?: number | string; classNo?: number | string; number?: number | string; name?: string; raw?: string } | undefined): string {
  if (!p) return '';
  if (p.grade) return `${p.grade}학년${p.classNo}반${p.number}번_${p.name || ''}`;
  return p.name || p.raw || '';
}

export function buildFriendlyBaseName(s: Pick<Submission, 'participation_type' | 'team_name' | 'title'> & { participants: any[] }): string {
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

// kind: 'work' = 작품파일, 'slide' = 발표자료
export function buildFriendlyFileName(
  s: Pick<Submission, 'participation_type' | 'team_name' | 'title'> & { participants: any[] },
  kind: 'work' | 'slide',
  originalFileName: string
): string {
  const baseName = buildFriendlyBaseName(s);
  const label = kind === 'work' ? '작품' : '발표자료';
  const ext = extensionOf(originalFileName);
  return `${baseName}_${label}${ext}`;
}
