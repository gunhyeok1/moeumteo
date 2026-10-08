-- 대회(공모전) 정의. 플랫폼을 재사용할 때마다 새 row를 추가합니다.
CREATE TABLE IF NOT EXISTS contests (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  categories TEXT NOT NULL DEFAULT '[]',      -- JSON string[] 예: ["정보보호","저작권"]
  topics TEXT NOT NULL DEFAULT '[]',          -- JSON string[] 예: ["딥페이크 예방","사이버 폭력 예방"]
  allow_free_topic INTEGER NOT NULL DEFAULT 1,
  allow_team INTEGER NOT NULL DEFAULT 1,
  max_participants INTEGER NOT NULL DEFAULT 4,
  start_at TEXT,
  end_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 제출(참가 신청) 레코드.
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,                        -- 접수번호, 예: SC26-0001
  contest_id TEXT NOT NULL REFERENCES contests(id),
  category TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  free_topic_text TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  work_link TEXT NOT NULL DEFAULT '',
  slide_link TEXT NOT NULL DEFAULT '',
  ai_tools TEXT NOT NULL DEFAULT '',
  participation_type TEXT NOT NULL DEFAULT 'individual', -- individual | team
  team_name TEXT NOT NULL DEFAULT '',
  participants TEXT NOT NULL DEFAULT '[]',    -- JSON [{grade,classNo,number,name}]
  privacy_consent INTEGER NOT NULL DEFAULT 0,
  exhibit_consent INTEGER NOT NULL DEFAULT 0,
  pledge_consent INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT '접수',         -- 접수 | 검토중 | 통과 | 보류 | 반려
  admin_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_submissions_contest ON submissions(contest_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_contests_slug ON contests(slug);
