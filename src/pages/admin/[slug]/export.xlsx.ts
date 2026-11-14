import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import * as XLSX from 'xlsx';
import { getContestBySlug, listSubmissions } from '../../../lib/db';

// 선생님께 드릴 "참가 학생 명단 + 주제" 엑셀. 통과/검토중 시트로 나누고,
// 제출물 1건당 1행으로 보여줌 (모둠이어도 한 줄에 다 모아서 표시 —
// 예전엔 학생 수만큼 줄을 나눠서 제출 건수랑 엑셀 줄 수가 안 맞고
// 헷갈린다는 피드백이 있었음).
const SHEET_STATUSES = ['통과', '검토중', '보류'] as const;

const HEADER = [
  '번호',
  '접수번호',
  '학년',
  '반',
  '번호(출석)',
  '이름',
  '참가형태',
  '모둠명',
  '공모분야',
  '공모주제',
  '작품제목',
  '사용 AI 도구',
  '제출일',
  '작품파일',
  '발표자료',
];

export const GET: APIRoute = async ({ params }) => {
  const db = env.DB;
  const contest = params.slug ? await getContestBySlug(db, params.slug) : null;
  if (!contest) {
    return new Response('Not found', { status: 404 });
  }

  const wb = XLSX.utils.book_new();

  for (const status of SHEET_STATUSES) {
    const submissions = await listSubmissions(db, {
      contestId: contest.id,
      status,
      sort: 'created_at',
      order: 'asc',
    });

    // 학년 → 반 → 번호(출석) 순으로 정렬 (같은 번호대면 주제로 한 번 더 묶음)
    const sorted = [...submissions].sort((a, b) => {
      const gA = a.participants[0]?.grade ?? 0;
      const gB = b.participants[0]?.grade ?? 0;
      if (gA !== gB) return gA - gB;
      const cA = a.participants[0]?.classNo ?? 0;
      const cB = b.participants[0]?.classNo ?? 0;
      if (cA !== cB) return cA - cB;
      const nA = a.participants[0]?.number ?? 0;
      const nB = b.participants[0]?.number ?? 0;
      if (nA !== nB) return nA - nB;
      const topicA = a.free_topic_text || a.topic;
      const topicB = b.free_topic_text || b.topic;
      if (topicA !== topicB) return topicA.localeCompare(topicB, 'ko');
      return a.id.localeCompare(b.id);
    });

    const rows: (string | number)[][] = [];
    let rowNo = 1;
    for (const s of sorted) {
      const topicLabel = s.free_topic_text || s.topic || '-';
      const participants = s.participants.length > 0 ? s.participants : [{ raw: '-', grade: '', classNo: '', number: '', name: s.team_name || '-' }];

      // 모둠이어도 한 줄로 모아서 보여줌 (학년/반/번호/이름을 각각 쉼표로 구분)
      const grades = participants.map((p) => p.grade ?? '').join(',');
      const classNos = participants.map((p) => p.classNo ?? '').join(',');
      const numbers = participants.map((p) => p.number ?? '').join(',');
      const names = participants.map((p) => p.name || p.raw || '-').join(',');

      rows.push([
        rowNo++,
        s.id,
        grades,
        classNos,
        numbers,
        names,
        s.participation_type === 'team' ? '모둠' : '개인',
        s.team_name || '',
        s.category || '-',
        topicLabel,
        s.title,
        s.ai_tools || '',
        new Date(s.created_at).toLocaleString('ko-KR'),
        s.work_file_name || (s.work_file_key ? '(파일명 없음)' : '-'),
        s.slide_file_name || (s.slide_file_key ? '(파일명 없음)' : '-'),
      ]);
    }

    const sheet = XLSX.utils.aoa_to_sheet([HEADER, ...rows]);
    sheet['!cols'] = [
      { wch: 5 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 20 },
      { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 24 }, { wch: 12 },
      { wch: 18 }, { wch: 24 }, { wch: 24 },
    ];
    XLSX.utils.book_append_sheet(wb, sheet, status);
  }

  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

  return new Response(buffer, {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${contest.slug}-명단.xlsx"`,
    },
  });
};
