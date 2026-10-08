# 모음터 — 학교 공모전 접수 플랫폼

QR코드 하나로 학생은 바로 참가 신청을 하고, 선생님은 실시간으로 제출 현황을 확인·관리할 수 있는 웹 서비스입니다.
특정 공모전 하나에 묶여있지 않고, 관리자 페이지에서 새 공모전을 계속 추가해서 **재사용**할 수 있도록 만들었습니다.

- 학생용 페이지: `/` (전체 공모전 목록) → `/c/{주소}` (대회 소개) → `/c/{주소}/submit` (신청서)
- 관리자 페이지: `/admin` (비밀번호 로그인 필요)

기술 스택: **Astro(SSR) + Cloudflare Workers + Cloudflare D1(데이터베이스)**. GitHub 저장소에 올려두면 Cloudflare Workers Builds가 코드를 푸시할 때마다 자동으로 다시 배포합니다.

> 참고: Cloudflare "Pages"가 아니라 **Workers**로 배포합니다. (Pages는 이 Astro 어댑터 버전과 호환 문제가 있어요 — `ASSETS` 바인딩 이름 충돌로 빌드가 실패합니다.) Cloudflare 대시보드에서 앱 생성 시 "Continue with GitHub"(통합 Workers 플로우)를 선택하면 됩니다. 맨 아래 "레거시 Pages 워크플로" 쪽은 사용하지 마세요.

---

## 1. 배포하기 (최초 1회)

### 1-1. D1 데이터베이스 만들기

1. [Cloudflare 대시보드](https://dash.cloudflare.com) 로그인 → 왼쪽 메뉴 **Workers & Pages → D1 SQL Database** → **Create database**
2. 이름을 `contest-platform-db` 로 입력하고 생성
3. 생성된 데이터베이스의 **Database ID** 를 복사해두세요.
4. 이 저장소의 `wrangler.toml` 파일을 열어 `database_id = "REPLACE_WITH_YOUR_D1_DATABASE_ID"` 부분을 방금 복사한 ID로 바꿔서 커밋/푸시 해주세요.
5. 같은 데이터베이스 화면의 **Console** 탭을 열고, 이 저장소의 `migrations/0001_init.sql` → `migrations/0002_file_uploads.sql` 파일 내용을 순서대로 그대로 복사해서 붙여넣고 실행하세요. (테이블/컬럼이 만들어집니다)

### 1-1-2. R2 버킷 만들기 (제출 파일 저장용)

1. Cloudflare 대시보드 → 왼쪽 메뉴 **R2 Object Storage** → **Create bucket**
2. 버킷 이름을 정확히 `moeumteo-files` 로 입력하고 생성 (이미 `wrangler.toml`에 이 이름으로 바인딩이 되어 있어요)
3. 별도 설정은 필요 없어요 — 비공개 버킷으로 두면 됩니다. 관리자 다운로드는 Worker를 거쳐서 제공되니 버킷을 공개로 바꿀 필요가 없어요.

### 1-2. GitHub 저장소 연결 + Cloudflare Workers 프로젝트 생성

1. 이 프로젝트 코드를 GitHub 저장소에 올립니다 (push).
2. Cloudflare 대시보드 → **Workers & Pages** → **애플리케이션 생성(Create application)** → **"Continue with GitHub"** 선택 (레거시 Pages 워크플로 아님)
3. 방금 올린 저장소(`moeumteo`) 선택
4. 빌드 설정:
   - **Framework preset**: Astro
   - **Build command**: `npm run build`
   - (Workers 플로우에는 "빌드 출력 디렉터리" 입력란이 없어요 — `wrangler.toml`이 알아서 처리합니다)
5. 환경 변수(비밀값)를 추가:

   | 변수명 | 값 |
   |---|---|
   | `ADMIN_PASSWORD` | 선생님이 로그인할 때 쓸 비밀번호 (직접 정하기) |
   | `SESSION_SECRET` | 아무 긴 임의의 문자열 (32자 이상 권장) |

6. **저장 및 배포**

D1 바인딩은 `wrangler.toml`에 이미 적혀있기 때문에 (1-1에서 database_id만 채웠다면) 별도 설정 없이 자동으로 연결됩니다.

배포가 끝나면 `https://(프로젝트이름).(계정서브도메인).workers.dev` 주소가 생성됩니다. 이 주소가 사이트의 기본 주소예요.

---

## 2. 사용 방법

### 2-1. 새 공모전 만들기 (관리자)

1. `https://your-site.workers.dev/admin/login` 접속 → 비밀번호 입력
2. **+ 새 공모전 만들기** 클릭
3. 이름, 주소(slug), 공모 분야/주제 목록(한 줄에 하나씩, 비워두면 학생이 직접 입력하는 자유 입력란이 돼요), 참가 인원 등을 입력하고 저장
4. **"영상 링크로 받을 공모 분야"** 입력란에 공모 분야 목록 중 영상 관련 분야 이름을 정확히 똑같이 적으면, 그 분야를 선택한 학생만 유튜브 등 링크로 제출받고 나머지 분야는 파일 업로드로 받아요. 비워두면 전체 다 파일 업로드예요.

생성되면 `https://your-site.workers.dev/c/{주소}` 가 학생들이 접속할 신청 페이지가 됩니다. 이 주소로 QR코드를 만들어서 공유하면 돼요.

학생이 올린 작품/발표자료 파일(50MB 이하)은 R2에 저장되고, 관리자 상세 페이지에서 바로 다운로드할 수 있어요.

### 2-2. 제출 관리

`/admin/{주소}` 에서 검색/분야별 필터/정렬, 상세보기, 상태 변경(접수/검토중/통과/보류/반려), CSV 다운로드가 가능합니다.

---

## 3. 로컬에서 미리 보기 (선택 사항)

개발자 도구(Node.js, git)가 설치되어 있다면 로컬에서도 돌려볼 수 있어요.

```bash
npm install
cp .dev.vars.example .dev.vars   # 비밀번호 등 로컬 테스트용 값 입력
npm run db:migrate:local         # 로컬 D1에 테이블 생성
npm run dev                      # http://localhost:4321
```

---

## 4. 참가 학생 정보 입력 형식

기존 구글폼과 동일한 규칙을 그대로 사용합니다: **"학년 반 번호 이름"** 순서로 한 줄에 작성 (공백 있어도/없어도 됨).

- 예: `2학년 3반 15번 홍길동` 또는 `2학년3반15번홍길동` → 정상
- 예: `3 1 3` → 형식이 맞지 않아 제출 시 바로 오류 안내가 표시됩니다.
