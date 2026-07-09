# LifeUnity Metaverse

## 🌐 개요

**LifeUnity Metaverse**는 Voxels와 같은 소셜 메타버스 플랫폼입니다.
누구나 접속하여 리얼한 3D 공간을 탐험하고, 작품을 감상하며, 다른 사용자들과 소통할 수 있는 가상 전시장 서비스입니다.

---

## ✨ 주요 기능

### 🎮 멀티플레이어 메타버스
- **Unity Netcode for GameObjects** 기반 네트워킹
- 최대 50-100명 동시 접속 (확장 가능)
- 실시간 플레이어 동기화

### 🎨 리얼 그래픽
- **URP (Universal Render Pipeline)** 렌더링
- 고품질 라이팅 및 포스트 프로세싱
- PBR 머티리얼 시스템

### 🖼️ 작품 전시 갤러리
- 2D 이미지 전시 (URL 또는 로컬 이미지)
- 3D 모델 전시 (향후 지원)
- 작품 메타데이터 (제목, 작가, 설명)
- 인터랙티브 작품 감상

### 👥 소셜 기능
- **음성 채팅** (Vivox - 3D 공간 음향 지원)
- **텍스트 채팅** (글로벌 채팅, 귓속말)
- 아바타 커스터마이징
- 이모트 및 제스처

---

## 📁 프로젝트 구조

```
/Assets/Metaverse/
│
├── Core/                      # 핵심 시스템
│   ├── Networking/            # 네트워크 관리
│   │   └── NetworkBootstrap.cs
│   ├── Player/                # 플레이어 시스템
│   │   └── NetworkedAvatarController.cs
│   ├── World/                 # 월드 관리
│   └── MetaverseManager.cs    # 전체 상태 관리
│
├── Gallery/                   # 갤러리 시스템
│   ├── Artwork/               # 작품 전시
│   │   └── ArtworkFrame.cs
│   ├── ContentManagement/     # 콘텐츠 관리
│   └── Interaction/           # 상호작용
│
├── Social/                    # 소셜 기능
│   ├── Voice/                 # 음성 채팅
│   │   └── VoiceChatManager.cs
│   ├── Text/                  # 텍스트 채팅
│   │   └── TextChatUI.cs
│   ├── Emotes/                # 이모트
│   └── Friends/               # 친구 시스템
│
├── Avatar/                    # 아바타 시스템
│   ├── Customization/         # 커스터마이징
│   └── Animation/             # 애니메이션
│
├── Backend/                   # 백엔드 연동
│   ├── APIClient.cs           (예정)
│   └── AuthenticationManager.cs (예정)
│
└── UI/                        # UI 시스템
    ├── Metaverse/             # 메타버스 UI
    └── Gallery/               # 갤러리 UI
```

---

## 🛠️ 기술 스택

| 카테고리 | 기술 |
|---------|------|
| 엔진 | Unity 2021.3.9f1 LTS |
| 렌더링 | Universal Render Pipeline (URP) |
| 네트워킹 | Unity Netcode for GameObjects 1.1.0 |
| 음성 채팅 | Vivox (Unity Services) |
| 텍스트 렌더링 | TextMeshPro |
| 카메라 시스템 | Cinemachine |
| 포스트 프로세싱 | Post Processing Stack v3 |
| 콘텐츠 로딩 | Addressables |
| 입력 시스템 | Unity Input System |

---

## 🚀 시작하기

### 1. 프로젝트 열기
Unity Hub에서 Unity 2021.3.9f1로 프로젝트를 엽니다.

### 2. 패키지 설치
프로젝트를 열면 필요한 패키지들이 자동으로 설치됩니다:
- URP
- Netcode for GameObjects
- Addressables
- Input System
- Vivox

### 3. 씬 설정
`Assets/Scenes/Metaverse/MainGallery.unity` (생성 예정)

### 4. 네트워크 테스트
1. **Host 모드**: 서버 + 클라이언트로 시작
2. **Client 모드**: 다른 서버에 접속

---

## 🎮 조작법

### 기본 이동
- **WASD** - 이동
- **Shift** - 달리기
- **Space** - 점프
- **마우스** - 시점 회전

### 상호작용
- **E** - 작품 상세 정보 보기
- **Enter** - 채팅창 열기/메시지 전송
- **ESC** - 채팅창 닫기 / 커서 해제

### 채팅 명령어
- `/help` - 도움말
- `/clear` - 채팅 기록 삭제
- `/whisper <이름> <메시지>` - 귓속말 (/w로 축약 가능)

---

## 📝 개발 로드맵

### ✅ Phase 1: Foundation (완료)
- [x] 프로젝트 구조 설계
- [x] 네트워킹 기초 (NetworkBootstrap)
- [x] 메타버스 매니저 (MetaverseManager)
- [x] 네트워크 아바타 컨트롤러
- [x] 작품 전시 시스템 (ArtworkFrame)
- [x] 음성 채팅 관리자 (VoiceChatManager)
- [x] 텍스트 채팅 UI (TextChatUI)
- [x] 패키지 설정 (URP, Netcode, etc.)

### 🔄 Phase 2: Graphics Upgrade (진행 중)
- [ ] URP 렌더 파이프라인 전환
- [ ] 포스트 프로세싱 설정
- [ ] 라이팅 시스템 구축
- [ ] 머티리얼 업그레이드

### 📋 Phase 3: Multiplayer Implementation (예정)
- [ ] 서버/클라이언트 연결 테스트
- [ ] 플레이어 스폰 시스템
- [ ] 아바타 동기화
- [ ] 네트워크 최적화

### 📋 Phase 4: Avatar System (예정)
- [ ] 아바타 모델 통합
- [ ] 커스터마이징 시스템
- [ ] 애니메이션 동기화
- [ ] 네임플레이트 UI

### 📋 Phase 5: Gallery System (예정)
- [ ] 갤러리 씬 제작
- [ ] 3D 모델 전시 시스템
- [ ] 콘텐츠 업로드 시스템
- [ ] 작품 상세 정보 UI

### 📋 Phase 6: Social Features (예정)
- [ ] Vivox 음성 채팅 통합
- [ ] 3D 공간 음향 구현
- [ ] 친구 시스템
- [ ] 이모트 시스템

### 📋 Phase 7-11 (향후)
- World Building
- Backend Integration
- UI/UX Polish
- Testing & Optimization
- Deployment

---

## 🔧 주요 스크립트 설명

### NetworkBootstrap.cs
네트워크 연결을 초기화하고 관리합니다.
- 서버/클라이언트 모드 선택
- 자동 연결 기능
- 연결 상태 콜백

### MetaverseManager.cs
메타버스 전체 상태를 관리하는 싱글톤 매니저
- 상태 머신 (Disconnected, Connecting, InWorld, InGallery 등)
- 플레이어 수 추적
- 월드 로딩 관리

### NetworkedAvatarController.cs
네트워크 동기화되는 아바타 컨트롤러
- WASD 이동, 점프, 달리기
- 마우스 시점 회전
- 로컬/원격 플레이어 구분
- 위치/회전/애니메이션 네트워크 동기화

### ArtworkFrame.cs
2D 작품(그림, 사진)을 전시하는 액자 시스템
- URL에서 이미지 로드
- 텍스처 크기 최적화
- 종횡비 자동 조정
- 작품 메타데이터 표시

### VoiceChatManager.cs
Vivox 음성 채팅 관리
- 3D 공간 음향 (Proximity Voice)
- 마이크 음소거/볼륨 조절
- 채널 관리

### TextChatUI.cs
텍스트 채팅 UI 시스템
- 글로벌 채팅
- 귓속말
- 명령어 시스템
- 욕설 필터

---

## 🎯 목표 성능

- **프레임레이트**: 60 FPS @ 1080p (중급 GPU)
- **동시 접속자**: 50-100명/서버
- **네트워크 지연**: < 100ms
- **메모리 사용**: < 4GB

---

## 📄 라이선스

이 프로젝트는 교육 및 연구 목적으로 제작되었습니다.

---

## 👨‍💻 개발자

LifeUnity Metaverse Development Team

**문의**: syhongartist@gmail.com

---

## 🙏 크레딧

- Unity Technologies
- Photon Engine / Unity Netcode
- Vivox
- Ready Player Me
- Open Source Community

---

**Last Updated**: 2026-07-09
