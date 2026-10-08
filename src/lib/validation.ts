// 참가 학생 정보 한 줄 입력 검증/파싱 — 기존 구글폼 정규식 규칙과 동일하게 맞춤
// 허용 형식: "2학년 3반 15번 홍길동" 또는 "2학년3반15번홍길동" (공백 유무 무관)
export const PARTICIPANT_REGEX = /^([1-3])\s*학년\s*([0-9]{1,2})\s*반\s*([0-9]{1,2})\s*번\s*(\S+)$/;

export interface ParsedParticipant {
  raw: string;
  grade: number;
  classNo: number;
  number: number;
  name: string;
}

export function parseParticipant(raw: string): ParsedParticipant | null {
  const trimmed = raw.trim();
  const m = trimmed.match(PARTICIPANT_REGEX);
  if (!m) return null;
  return {
    raw: trimmed,
    grade: Number(m[1]),
    classNo: Number(m[2]),
    number: Number(m[3]),
    name: m[4],
  };
}

export function isValidParticipant(raw: string): boolean {
  return PARTICIPANT_REGEX.test(raw.trim());
}

export function isValidUrl(value: string): boolean {
  if (!value.trim()) return true; // 빈 값은 선택 필드로 간주하는 곳에서 사용
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

const RECEIPT_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 0,O,1,I,L 제외 (혼동 방지)

export function generateReceiptId(prefix = 'SC'): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let code = '';
  for (const b of bytes) code += RECEIPT_ALPHABET[b % RECEIPT_ALPHABET.length];
  return `${prefix}-${code}`;
}

export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
