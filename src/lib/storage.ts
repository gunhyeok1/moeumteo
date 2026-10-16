// 제출 파일 업로드/다운로드 헬퍼.
// 일반 파일(카드뉴스·웹앱 등 작품/발표자료)은 Cloudflare Workers KV에 저장 —
//  Workers 무료 플랜에 기본 포함되어 있어 별도 결제수단 등록이 필요 없음.
//  대신 KV 값 크기 상한이 25MiB라 여유를 두고 20MB로 제한함.
// 영상 분야(contest.video_category) 작품 파일만 Cloudflare R2에 저장 —
//  영상은 용량이 커서 KV로는 부족해 R2를 씀. R2는 카드 등록(구독 활성화)이
//  필요하지만 무료 한도(10GB 저장) 안에서는 과금되지 않음.
// 두 경우 모두 Cloudflare 계정 자체의 요청 본문 크기 상한(무료/Pro 플랜 100MB)을
// 넘을 수 없어서, 영상 업로드 한도는 그 아래인 98MB로 설정함 (실측 샘플 기준
// 2분22초/56.3MB ≈ 초당 3.2Mbps — 같은 화질이면 4분 영상도 95MB 안팎이라
// 98MB로 약간의 여유를 둠. 압축 안 된 원본 고화질 영상은 그래도 넘을 수 있음).

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB — KV 값 크기 상한(25MiB)보다 여유 있게 설정
export const MAX_VIDEO_FILE_SIZE = 98 * 1024 * 1024; // 98MB — Cloudflare 요청 본문 상한(100MB)에 거의 딱 맞춤 (여유 2MB)

// R2에 저장된 파일의 키는 이 접두사로 구분함 (다운로드 라우트가 KV/R2 중 어디서
// 읽을지 이 접두사로 판단함). 콜론은 slug 정규식(영문/숫자/한글/하이픈)에 못 쓰는
// 문자라 일반 KV 키와 절대 겹치지 않음.
const R2_KEY_PREFIX = 'r2v:';

export function isUploadableFile(value: FormDataEntryValue | null): value is File {
  return typeof value === 'object' && value !== null && 'size' in value && 'name' in value && (value as File).size >= 0;
}

// 파일명을 저장 키에 안전하게 쓸 수 있도록 정리 (한글은 유지, 경로 구분자/제어문자 등만 제거)
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() || 'file';
  return base.replace(/[\u0000-\u001f]/g, '').replace(/[?#%]/g, '_').slice(0, 150) || 'file';
}

export interface UploadedFileMeta {
  key: string;
  name: string;
  size: number;
}

interface FileKvMetadata {
  filename: string;
  contentType: string;
}

export async function uploadSubmissionFileKV(
  kv: KVNamespace,
  contestSlug: string,
  submissionId: string,
  field: 'work' | 'slide',
  file: File
): Promise<UploadedFileMeta> {
  const safeName = sanitizeFileName(file.name || 'file');
  const key = `${contestSlug}/${submissionId}/${field}-${Date.now()}-${safeName}`;
  const metadata: FileKvMetadata = { filename: safeName, contentType: file.type || 'application/octet-stream' };
  await kv.put(key, await file.arrayBuffer(), { metadata });
  return { key, name: safeName, size: file.size };
}

export async function uploadSubmissionFileR2(
  bucket: R2Bucket,
  contestSlug: string,
  submissionId: string,
  field: 'work' | 'slide',
  file: File
): Promise<UploadedFileMeta> {
  const safeName = sanitizeFileName(file.name || 'file');
  const rawKey = `${contestSlug}/${submissionId}/${field}-${Date.now()}-${safeName}`;
  await bucket.put(rawKey, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
    customMetadata: { filename: safeName },
  });
  return { key: `${R2_KEY_PREFIX}${rawKey}`, name: safeName, size: file.size };
}

export async function getSubmissionFile(env: { FILES_KV: KVNamespace; FILES_R2?: R2Bucket }, key: string) {
  if (key.startsWith(R2_KEY_PREFIX)) {
    if (!env.FILES_R2) return null;
    const rawKey = key.slice(R2_KEY_PREFIX.length);
    const object = await env.FILES_R2.get(rawKey);
    if (!object) return null;
    return {
      body: object.body,
      filename: object.customMetadata?.filename || rawKey.split('/').pop() || 'file',
      contentType: object.httpMetadata?.contentType || 'application/octet-stream',
    };
  }

  const result = await env.FILES_KV.getWithMetadata<FileKvMetadata>(key, 'arrayBuffer');
  if (!result.value) return null;
  return {
    body: result.value,
    filename: result.metadata?.filename || key.split('/').pop() || 'file',
    contentType: result.metadata?.contentType || 'application/octet-stream',
  };
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
