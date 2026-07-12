# ARTSHOW 백로그

감독 지시 순서: **깃허브 정리 → (마지막) AI 관람객 로드맵**

## 1. 깃허브 정리 — artshow 저장소 이전 (진행 중)

- lifeunity(강좌 포크)에서 `syhongart/artshow` 새 저장소로 이전
- 준비 완료: origin의 `clean-main`(소스 단일 커밋) / `clean-pages`(배포 단일 커밋)
  브랜치를 매 배포마다 최신으로 갱신 중
- 이전 절차: artshow 저장소 생성 → clean-main을 main으로, clean-pages를
  gh-pages로 푸시 → Settings에서 Pages(gh-pages 브랜치) 활성화

## 2. AI 관람객 로드맵 (감독 승인 — 마지막에)

원칙: **"AI가 실제로 관람하는 모습"이 먼저, 규격 공개는 그다음.**

1. `llms.txt` + 가이드 페이지 "AI 관람객 안내" — 에이전트가 사이트에 오면
   스스로 관람법(입장 URL·이동/채팅/방명록 프로토콜)을 알게
2. AI 방문자 표시 규약 — 닉네임 🤖 배지 (신뢰 필수)
3. 호스트 초빙형 AI 평론가 프로토타입 — 꼬마악마를 실제 LLM으로 승격,
   작품 JSON을 읽고 방명록에 감상평 (키는 호스트가 제공)
4. 방명록 백엔드(영속화) — AI 평이 남으려면 선행 조건
5. MCP 서버 → 공식 MCP Registry + Claude 커넥터 디렉터리 등록,
   서드파티(Smithery/mcp.so/PulseMCP) 병행
6. GitHub 규격+예제 에이전트 공개, Show HN / r/mcp / AI SNS 상주 계정

## 기타 대기 항목

- og.png(SNS 공유 썸네일) 청자 그린 브랜드로 재생성

- 블렌더 커스텀 건물 파이프라인 구현 (규약 문서 docs/BLENDER-BUILDING-GUIDE.md
  완료 — three-mesh-bvh 충돌, Empty 슬롯 임포터, 스튜디오 검증기)
- 실계정/실결제 (현재 활성화 코드 목업)
- 음성 채팅 / 이모트 / 경매장 (아이디어 백로그)
