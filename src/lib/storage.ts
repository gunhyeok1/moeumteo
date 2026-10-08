// R2(오브젝트 스토리지)에 제출 파일을 업로드/다운로드하기 위한 헬퍼.

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB — 포스터 이미지, PPT, 문서류 기준 충분한 여유치

export function isUploadableFile(value: FormDataEntryValue | null): value is File {
  return typeof value === 'object' && value !== null && 'size' in value && 'name' in value && (value as File).size >= 0;
}

// 파일명을 R2 키에 안전하게 쓸 수 있도록 정리 (한글은 유지, 경로 구분자/제어문자 등만 제거)
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() || 'file';
  return base.replace(/[\u0000-\u001f]/g, '').replace(/[?#%]/g, '_').slice(0, 150) || 'file';
}

export interface UploadedFileMeta {
  key: string;
  name: string;
  size: number;
}

export async function uploadSubmissionFile(
  bucket: R2Bucket,
  contestSlug: string,
  submissionId: string,
  field: 'work' | 'slide',
  file: File
): Promise<UploadedFileMeta> {
  const safeName = sanitizeFileName(file.name || 'file');
  const key = `${contestSlug}/${submissionId}/${field}-${Date.now()}-${safeName}`;
  await bucket.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
    customMetadata: { filename: safeName },
  });
  return { key, name: safeName, size: file.size };
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
