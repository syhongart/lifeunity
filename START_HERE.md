# 🚀 LifeUnity Metaverse - 바로 시작하기!

## ⚡ 3단계로 시작

### 1️⃣ Unity 설치 (10분)

**Unity Hub 다운로드**:
```
https://unity.com/download
```

**Unity 2021.3.9f1 설치**:
1. Unity Hub 열기
2. **Installs** 탭 클릭
3. **Install Editor** 클릭
4. **2021.3.9f1 (LTS)** 선택
5. **Install** 클릭

### 2️⃣ 프로젝트 열기 (2분)

```
Unity Hub > Projects > Open > 선택:
/home/user/lifeunity/4-11/
```

**패키지 다운로드 자동 시작** (5-10분)
- URP
- Photon Netcode
- Addressables
- 등등...

### 3️⃣ Photon PUN2 설치 (5분)

**Asset Store에서**:
1. Unity 상단 메뉴: **Window > Asset Store**
2. 검색: **"PUN 2 - FREE"**
3. **Download** > **Import**

**App ID 설정**:
1. https://dashboard.photonengine.com 계정 생성
2. **Create New App** > **PUN**
3. App ID 복사
4. Unity: **Window > Photon Unity Networking > PUN Wizard**
5. App ID 붙여넣기 > **Setup**

---

## 🎨 갤러리 만들기 (5분!)

Unity 프로젝트 열린 상태에서:

### 자동 갤러리 생성 (추천!)

```
Unity 상단 메뉴:
Metaverse > Gallery Setup Wizard 🎨

1. 스타일 선택: "Warm Gallery" (따뜻한 갤러리)
2. 방 크기: 15m x 15m x 4m (기본값)
3. ✅ 모든 옵션 체크
4. "✨ 갤러리 생성하기" 클릭

완료! 갤러리 자동 생성됨!
```

### 조명 베이킹 (필수!)

```
Window > Rendering > Lighting

아래쪽:
Generate Lighting 클릭

대기 (1-5분)
✅ 완료!
```

---

## 🎮 테스트하기

### Play 버튼 클릭!

```
Unity 상단 중앙:
▶️ (Play 버튼) 클릭

조작:
- WASD: 이동
- 마우스: 시점 회전
- Shift: 달리기
- Space: 점프
```

---

## 🌐 WebGL 빌드 (30분)

### 웹에 배포하기

```
Unity 메뉴:
Metaverse > Build & Deploy to Web 🌐

"🚀 WebGL 빌드 시작" 클릭

대기 (30분 - 커피 타임!)

자동으로 GitHub Pages 배포!

완료 후 접속:
https://syhongart.github.io/lifeunity/
```

---

## 📚 주요 메뉴

Unity에서 사용 가능한 기능:

### Metaverse 메뉴
```
Metaverse/
  ├─ Gallery Setup Wizard 🎨     - 자동 갤러리 생성
  └─ Build & Deploy to Web 🌐    - WebGL 빌드 & 배포
```

---

## 📖 가이드 문서

```
/4-11/Assets/Metaverse/README.md
  → 프로젝트 개요 및 기능

/4-11/Assets/Scenes/Metaverse/SETUP_GUIDE.md
  → Unity 설정 완전 가이드

/4-11/Assets/Settings/VISUAL_QUALITY_GUIDE.md
  → 조명 & 텍스처 프로페셔널 가이드

/4-11/Assets/Metaverse/PLATFORM_SUPPORT.md
  → WebGL/모바일 지원 가이드

/4-11/Assets/Metaverse/Core/Networking/Photon/PHOTON_SETUP.md
  → Photon 멀티플레이어 설정

/WEBGL_QUICKSTART.md
  → WebGL 배포 5단계
```

---

## 🎯 핵심 파일 위치

### 씬 (Scenes)
```
/4-11/Assets/Scenes/Metaverse/MainGallery.unity
  → 메인 갤러리 씬 (시작!)
```

### 스크립트 (Scripts)
```
/4-11/Assets/Metaverse/Core/
  ├─ MetaverseManager.cs          - 전체 관리
  ├─ Player/
  │   └─ NetworkedAvatarController.cs - 아바타
  ├─ Networking/
  │   ├─ NetworkBootstrap.cs      - Unity Netcode
  │   └─ Photon/
  │       ├─ PhotonBootstrap.cs    - Photon (WebGL)
  │       └─ PhotonAvatarController.cs
  └─ Gallery/
      └─ Artwork/
          └─ ArtworkFrame.cs       - 작품 전시
```

### 설정 (Settings)
```
/4-11/Assets/Settings/URP/
  ├─ MetaverseURP-HighQuality.asset  - 고품질 렌더링
  ├─ MetaversePostProcessing.asset   - Bloom, AO 등
  ├─ GalleryLightingManager.cs       - 조명 자동 생성
  └─ URPSetupHelper.cs               - 런타임 설정
```

### 에디터 도구 (Editor)
```
/4-11/Assets/Editor/
  ├─ GallerySetupWizard.cs  - 갤러리 자동 생성
  └─ WebGLBuilder.cs        - WebGL 자동 빌드
```

---

## 🔧 문제 해결

### "패키지 오류"
```
Assets > Reimport All
Unity 재시작
```

### "Photon 연결 안 됨"
```
Window > Photon Unity Networking > PUN Wizard
App ID 재입력
```

### "Play 했는데 아무것도 없음"
```
Hierarchy > MainGallery 씬 확인
없으면: Metaverse > Gallery Setup Wizard 실행
```

### "WebGL 빌드 실패"
```
File > Build Settings > WebGL
Switch Platform (10분 대기)
다시 빌드
```

---

## ✨ 추천 순서

### 첫 30분
```
1. Unity 설치
2. 프로젝트 열기
3. Photon PUN2 설치
4. Gallery Setup Wizard 실행
5. Play 테스트!
```

### 다음 30분
```
1. 작품(이미지) 준비
2. ArtworkFrame 프리팹 사용
3. 씬에 배치
4. Spot Light 자동 생성
5. Lighting 베이킹
```

### 마지막 30분
```
1. WebGL 빌드
2. GitHub Pages 배포
3. 웹에서 확인!
```

---

## 🎉 완료!

**총 1.5시간이면 웹에서 실행되는 메타버스 완성!**

```
접속 주소:
https://syhongart.github.io/lifeunity/
```

---

## 📞 도움말

문제 발생 시:
- GitHub Issues: https://github.com/syhongart/lifeunity/issues
- Email: syhongartist@gmail.com

---

**지금 바로 시작하세요!** 🚀

Unity Hub 다운로드: https://unity.com/download
