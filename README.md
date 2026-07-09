# LifeUnity — 웹 3D 가상 전시 플랫폼

LifeUnity는 **웹 브라우저만으로 접속하는 3D 가상 전시 플랫폼**입니다. 작가는 손쉽게 전시를 등록하고, 관람객은 루이지애나 미술관 스타일의 몰입감 있는 3D 전시장에서 작품을 감상할 수 있습니다.

## 라이브 링크

- **랜딩 페이지**: https://syhongart.github.io/lifeunity/
- **전시장 입장**: https://syhongart.github.io/lifeunity/app/
- **작가 스튜디오**: https://syhongart.github.io/lifeunity/app/studio.html

## 주요 기능

- **3D 전시 감상**: 아치형 목조 볼트 천장, 통유리 벽, 중정의 큰 나무가 있는 실내 공간
  - PC: WASD 이동, Shift 달리기, 마우스 시점 조작
  - 모바일: 왼쪽 화면 터치 이동 + 오른쪽 화면 드래그 시점
- **작품 정보**: 작품 3m 이내 접근 시 우측에 정보 패널 표시
- **라이트박스**: E키로 작품 전체화면 확대 (ESC/X/배경클릭 닫기)
- **멀티플레이어**: 같은 전시장에 접속한 사람들이 아바타로 표시되고, Enter키로 채팅 가능
- **사운드**: 입장 시 새소리·바람 앰비언트 음향
- **전시 선택**: 로비의 전시 목록 또는 URL 파라미터(`?g=<전시id>`)로 전시 선택

## 기술 스택

- **3D 렌더링**: Three.js r160 (ES 모듈, 빌드 도구 없음)
- **멀티플레이어**: PeerJS (P2P 연결)
- **오디오**: Web Audio API (앰비언트 사운드)
- **배포**: GitHub Pages (`gh-pages` 브랜치)

## 폴더 구조

```
lifeunity/
├── web/                        # 개발 소스
│   ├── index.html              # 3D 전시장 (app/로 배포)
│   ├── landing.html            # 랜딩 페이지 (루트의 index.html로 배포)
│   ├── guide.html              # 이용 안내 (루트의 guide.html로 배포)
│   ├── studio.html             # 작가 스튜디오 (app/로 배포)
│   ├── js/                     # JavaScript 모듈
│   │   ├── main.js             # 메인 진입점 및 전시장 초기화
│   │   ├── scene.js            # Three.js 씬 설정 (조명, 카메라, 지오메트리)
│   │   ├── player.js           # 플레이어 이동 및 카메라 제어
│   │   ├── avatar.js           # 다른 플레이어의 아바타 표시
│   │   ├── artworks.js         # 작품 로딩 및 정보 패널
│   │   ├── multiplayer.js      # PeerJS 기반 멀티플레이어 (P2P 연결, 채팅)
│   │   ├── ui.js               # UI 요소 (로비, 정보 패널, 채팅)
│   │   ├── ambient.js          # Web Audio 앰비언트 사운드 관리
│   │   └── config.js           # 전역 설정 상수
│   ├── galleries/              # 전시 갤러리 데이터
│   │   └── index.json          # 등록된 전시 목록 및 메타데이터
│   ├── assets/                 # 자산 (이미지, 리소스)
│   └── vendor/                 # 외부 라이브러리 (Three.js 등)
└── README.md                   # 이 파일
```

### 배포 구조

- 개발 저장소의 `web/landing.html`, `web/guide.html` → 루트(`index.html`, `guide.html`)로 배포
- `web/index.html`, `web/studio.html` → `app/`로 배포
- `gh-pages` 브랜치에서 자동으로 GitHub Pages 업데이트

## 새 전시 추가 방법

### 1. 작가 스튜디오에서 전시 생성
- https://syhongart.github.io/lifeunity/app/studio.html 접속
- 전시 제목, 설명, 작품(최대 14점, 대표작 2점) 입력
- **[JSON 다운로드]** 버튼으로 전시 데이터 파일 생성

### 2. 저장소에 추가
- 생성된 JSON 파일을 `web/galleries/` 폴더에 추가
- `web/galleries/index.json`의 전시 목록에 메타데이터 등록 (제목, ID, 썸네일, 설명)

### 3. 배포
- 변경사항을 `gh-pages` 브랜치로 푸시
- GitHub Pages가 자동으로 업데이트

---

## 참고: 기존 프로젝트

### 인생유니타교과서 공유

**Unity 게임 개발 교육 프로젝트**

교육 교재 챕터별 자료:

- [챕터 3 - Awesome Cartoon Airplanes](https://github.com/araxrlab/lifeunity/blob/master/Awesome%20Cartoon%20Airplanes.unitypackage)
- [챕터 3 - 모바일 조이스틱 입력 대응하기 Virtual Plug and Play 애셋](https://cafe.naver.com/unrealunity/243)
- [챕터 3 - 음원 파일 (CP03_Sound)](https://cafe.naver.com/unrealunity/63)
- [챕터 4 - 총 이펙트와 사운드 패키지](https://cafe.naver.com/unrealunity/159)
- [챕터 4 - 크로스헤어 이미지](https://cafe.naver.com/unrealunity/160)
- [챕터 4 - 옵션 버튼 이미지](https://cafe.naver.com/unrealunity/161)
- [챕터 4.10 UI디자인 레이아웃 이미지](https://cafe.naver.com/unrealunity/162)
- [챕터 4 - 좀비 피격 애니메이션 (Zombie Reaction Hit.fbx)](https://cafe.naver.com/unrealunity/201)

### Metaverse Project (2026)

**Voxels 스타일의 리얼 메타버스 플랫폼** - Unity 게임 엔진 기반 프로젝트

- **프로젝트 위치**: `./4-11/` (Unity 2021.3.9f1)
- **브랜치**: `claude/voxels-korean-char-011CUumPbfUUn7d8tLwuXHig`
- **문서**: [메타버스 README](./4-11/Assets/Metaverse/README.md)
- **설정 가이드**: [SETUP_GUIDE.md](./4-11/Assets/Scenes/Metaverse/SETUP_GUIDE.md)

#### 주요 기능
- 멀티플레이어: Unity Netcode 기반 (50-100 CCU)
- 리얼 그래픽: URP (Universal Render Pipeline)
- 작품 전시: 2D/3D 갤러리 시스템
- 소셜: 음성 채팅 (Vivox), 텍스트 채팅
- 아바타: 커스터마이징 가능

#### 개발 진행도
- ✅ Phase 1: Foundation & Core Systems (완료)
- 🔄 Phase 2: URP Graphics Upgrade (진행 중)
- 📋 Phase 3-11: 네트워킹, 아바타, 갤러리 등 (예정)
