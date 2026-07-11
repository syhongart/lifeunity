# artshow 저장소 이전 절차

이 저장소(lifeunity)는 강좌 포크 위에서 개발한 임시 거처다. 완성된 소스는
`clean-main`, 배포 산출물은 `clean-pages` 브랜치에 **깨끗한 단일 커밋**으로
매 배포마다 갱신되어 있다 — 강좌 히스토리 없이 이전할 준비 완료 상태.

## 감독(계정 소유자)이 할 일 — 딱 1가지

1. https://github.com/new 에서 **artshow** 저장소 생성
   (Public, README/GITIGNORE 추가하지 말 것 — 완전히 빈 저장소)

## 그다음 (둘 중 하나)

### A. Claude에게 맡기기 (권장)
새 Claude Code 세션을 **artshow 저장소**로 열고 이렇게 지시:
> lifeunity 저장소의 clean-main 브랜치를 main으로, clean-pages를 gh-pages로
> 가져와 푸시하고, Settings → Pages에서 gh-pages 브랜치를 활성화해줘.

### B. 로컬 터미널에서 직접 (2분)
```bash
git clone --branch clean-main https://github.com/syhongart/lifeunity artshow
cd artshow
git remote set-url origin https://github.com/syhongart/artshow
git push -u origin clean-main:main
git fetch https://github.com/syhongart/lifeunity clean-pages
git push origin FETCH_HEAD:gh-pages
```
그리고 GitHub에서 artshow → Settings → Pages → Branch: `gh-pages`, `/ (root)` 저장.

## 이전 후 확인

- https://syhongart.github.io/artshow/ (랜딩)
- https://syhongart.github.io/artshow/app/ (전시장)
- README의 라이브 링크가 이미 artshow 경로로 작성되어 있어 수정 불필요.

## 이전 후 lifeunity 저장소는

- Archive 처리(Settings → Archive this repository) 권장 — 삭제보다 안전.
