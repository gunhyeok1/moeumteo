// 제출물 목록 하나를 받아서 "학년반번호_이름_작품제목" 이름 규칙으로 zip에 넣을
// {파일경로: 바이트} 맵을 만들어줌. download-files.zip.ts(전체 zip)와
// download-files-by-category.zip.ts(분야별 zip)가 똑같은 로직을 공유함.

import { getSubmissionFile } from './storage';
import { buildFriendlyFileName, buildFriendlyBaseName, extensionOf } from './friendly-filename';
import type { Submission } from './db';

type Env = Parameters<typeof getSubmissionFile>[0];

export async function buildSubmissionFileEntries(
  env: Env,
  submissions: (Submission & { participants: any[] })[]
): Promise<Record<string, Uint8Array>> {
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

  return files;
}
