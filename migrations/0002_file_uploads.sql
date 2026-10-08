-- 작품/발표자료를 링크 대신 파일로 받을 수 있도록 컬럼 추가.
-- video_category: 이 값과 정확히 일치하는 공모 분야만 "영상 링크"로 받고, 나머지는 파일 업로드로 받음 (비우면 전체 파일 업로드).

ALTER TABLE contests ADD COLUMN video_category TEXT NOT NULL DEFAULT '';

ALTER TABLE submissions ADD COLUMN work_file_key TEXT NOT NULL DEFAULT '';
ALTER TABLE submissions ADD COLUMN work_file_name TEXT NOT NULL DEFAULT '';
ALTER TABLE submissions ADD COLUMN work_file_size INTEGER NOT NULL DEFAULT 0;
ALTER TABLE submissions ADD COLUMN slide_file_key TEXT NOT NULL DEFAULT '';
ALTER TABLE submissions ADD COLUMN slide_file_name TEXT NOT NULL DEFAULT '';
ALTER TABLE submissions ADD COLUMN slide_file_size INTEGER NOT NULL DEFAULT 0;
