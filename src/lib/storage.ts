// Cloudflare Workers KV에 제출 파일을 업로드/다운로드하기 위한 헬퍼.
// (R2 대신 KV를 쓰는 이유: KV는 Workers 무료 플랜에 기본 포함되어 있어
//  R2처럼 별도 결제수단 등록/구독 활성화가 필요 없음. 대신 값 크기 상한이 25MiB라
//  여유를 두고 20MB로 제한함.)

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB — KV 값 크기 상한(25MiB)보다 여유 있게 설정

export function isUploadableFile(value: FormDataEntryValue | null): value is File {
  return typeof value === 'object' && value !== null && 'size' in value && 'name' in value && (value as File).size >= 0;
}

// 파일명을 KV 키에 안전하게 쓸 수 있도록 정리 (한글은 유지, 경로 구분자/제어문자 등만 제거)
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

export async function uploadSubmissionFile(
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

export async function getSubmissionFile(kv: KVNamespace, key: string) {
  const result = await kv.getWithMetadata<FileKvMetadata>(key, 'arrayBuffer');
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
