# 감독(창업자)이 직접 해야 할 일 — OWNER TODO

> 코드로 자동화가 안 되는, **사람(감독)이 직접** 해야 하는 일들의 상설 체크리스트.
> 까먹지 않기 위한 단일 창구. 완료하면 `[x]`로 체크. 부팀장은 이 목록을 매
> 세션 참고한다. (개발일지는 "한 일" 기록, 이 문서는 "감독이 할 일" 기록.)

최종 갱신: 2026-07-13

---

## 🔴 대규모 공개 전 필수 (블로커)

- [ ] **보안 3종 openartshow 반영 + 자동배포 구축**
  openartshow 세션에 부팀장이 준 지시문 붙여넣기 (P2P 검증·URL 화이트리스트·
  CSP 3개 파일 + `.github/workflows/deploy.yml`). 완료하면 대규모 공개 GO.
- [ ] **상표 출원 — ARTSHOW · 아야모** (아래 §상표 출원 절차 참고)
  → 코드가 아닌 진짜 방어선. 브랜드·마스코트를 지키는 유일한 법적 수단.
- [ ] **LICENSE 파일 추가** (openartshow 루트)
  "All rights reserved(무단 사용 금지)" 명시 — public이 "가져다 써도 됨"이
  아님을 분명히. (부팀장이 준 LICENSE 문구 사용)

## 🟡 곧

- [ ] **내부 전략 문서 2개 openartshow에서 제거**
  `docs/BACKLOG.md`(연봉 메모 포함), `docs/BUSINESS-PLAN-DRAFT.md` — public에
  노출 중. 로컬 백업 후 삭제 + `.gitignore`에 추가.
- [ ] **감독 실제 작품 이미지 준비** → 첫 전시 채우기
  지금 갤러리는 플레이스홀더 스톡 사진. 실제 작품 이미지를 주면 부팀장이
  `galleries/syhongart.json`에 넣어 진짜 개인전으로. (플래그십 갤러리)
- [ ] **검색 등록** (SEO — 이전 완료됐으니 지금 가능)
  구글 서치 콘솔 + 네이버 서치어드바이저에 openartshow 사이트 등록 (각 5분).
- [ ] **lifeunity 저장소 숨기기** (선택)
  Settings → Danger Zone → Make private (남 눈에서 사라짐, 옛 사이트도 정지).

## 🔵 나중 (트랙션·자금)

- [ ] **자체 도메인 구매** (선택) — ayamo.io/.art/.kr 등 (ayamo.com은 선점됨).
  구매 후 부팀장이 사이트 연결 + SEO 이전 처리.
- [ ] **K-스타트업 알림 설정** (k-startup.go.kr) — 2027 예비창업패키지 대비.
  ⚠️ **선정 전 사업자등록 금지** (무사업자만 신청 가능).
- [ ] **서드파티 액션 SHA 고정** (보안 §곧) — deploy.yml의 peaceiris 액션을
  커밋 SHA로 핀 + Dependabot. (부팀장이 openartshow 세션에서 도울 수 있음)

---

## 상표 출원 절차 (ARTSHOW · 아야모)

*(지식재산 전문 리서치 반영 예정 — 현행 KIPRIS/특허로 절차·수수료·분류)*

핵심 뼈대(리서치로 정확화 예정):
1. **선행상표 검색** — KIPRIS(kipris.or.kr)에서 무료로 "ARTSHOW"·"아야모"가
   관련 분류에 이미 등록됐는지 확인.
2. **출원** — 특허로(patent.go.kr) 전자출원. 특허고객번호 발급 → 지정상품
   분류(니스 류) 선택 → 제출 → 수수료 납부.
3. 문자상표(ARTSHOW·아야모) + **도형상표(아야모 캐릭터 그림)**를 함께 고려.

---

## 완료된 것 (기록용)

- [x] openartshow 저장소 생성 + 이전 (2026-07-13, 새 세션이 수행)
- [x] git 글로벌 신원 교정 (d → syhongart)
- [x] webgl-build.yml 트리거 정리 (workflow_dispatch 전용)
