# Metaverse 설정 가이드

## 🚀 Unity에서 프로젝트 열기

Unity Hub에서 이 프로젝트를 **Unity 2021.3.9f1**로 열어주세요.

---

## 📦 Phase 1 체크리스트

### ✅ 이미 완료된 작업
- [x] 프로젝트 구조 생성
- [x] 패키지 설치 (manifest.json 업데이트)
- [x] 핵심 스크립트 7개 구현
- [x] Git 커밋 및 푸시

### 🔄 Unity에서 확인 필요
Unity가 프로젝트를 열면 자동으로:
1. 패키지들을 다운로드 및 설치합니다
2. `.meta` 파일들을 자동 생성합니다
3. 스크립트들을 컴파일합니다

**예상 소요 시간**: 5-10분 (패키지 다운로드)

---

## 🎨 Phase 2: URP 설정 (Unity 열고 나서)

### Step 1: URP Asset 할당
1. `Edit` > `Project Settings` > `Graphics`
2. `Scriptable Render Pipeline Settings`에 다음 할당:
   - `Assets/Settings/URP/UniversalRenderPipelineAsset.asset`

### Step 2: Quality Settings 확인
1. `Edit` > `Project Settings` > `Quality`
2. 각 품질 레벨에 URP Asset 할당

### Step 3: 기존 머티리얼 업그레이드
1. `Edit` > `Render Pipeline` > `Universal Render Pipeline`
2. `Upgrade Project Materials to UniversalRP Materials` 선택
3. 변환 확인 후 `Proceed`

### Step 4: 조명 설정
- **Directional Light** 추가 (메인 태양광)
- **Reflection Probes** 추가 (갤러리 공간)
- **Light Probes** 설정 (동적 오브젝트)

---

## 🌐 Phase 3: 네트워킹 씬 설정

### Step 1: MainGallery 씬 생성
1. `Assets/Scenes/Metaverse/` 폴더에서 우클릭
2. `Create` > `Scene` → `MainGallery.unity`
3. 씬 열기

### Step 2: NetworkManager 설정
씬에 다음 오브젝트들을 추가:

#### 1. NetworkManager 오브젝트
```
GameObject > Create Empty > "NetworkManager"
Components:
  - NetworkManager (Unity.Netcode)
  - UnityTransport (Unity.Netcode.Transports.UTP)
  - NetworkBootstrap (스크립트)
```

**NetworkManager 설정**:
- Transport: UnityTransport
- Player Prefab: (아래에서 생성할 NetworkedPlayer 프리팹)

**UnityTransport 설정**:
- Address: 127.0.0.1
- Port: 7777

**NetworkBootstrap 설정**:
- Server Address: 127.0.0.1
- Server Port: 7777
- Auto Connect: ✓
- Is Server: ☐ (클라이언트 모드)

#### 2. MetaverseManager 오브젝트
```
GameObject > Create Empty > "MetaverseManager"
Component:
  - MetaverseManager (스크립트)
```

### Step 3: 네트워크 플레이어 프리팹 생성

#### 1. 기본 플레이어 오브젝트 생성
```
GameObject > 3D Object > Capsule
이름: "NetworkedPlayer"
```

#### 2. 컴포넌트 추가
플레이어에 다음 컴포넌트 추가:
- `CharacterController`
- `NetworkObject` (Unity.Netcode)
- `NetworkedAvatarController` (우리 스크립트)

**CharacterController 설정**:
- Radius: 0.5
- Height: 2
- Center: (0, 1, 0)

**NetworkObject 설정**:
- ☐ Synchronize Transform
  (NetworkedAvatarController가 직접 동기화함)

#### 3. 카메라 설정
플레이어의 자식으로 카메라 추가:
```
NetworkedPlayer
  └─ CameraTarget (빈 오브젝트)
       └─ Main Camera
```

**CameraTarget 위치**: (0, 1.6, 0) - 눈 높이
**Main Camera 위치**: (0, 0, 0) - 로컬

**NetworkedAvatarController 설정**:
- Avatar Camera: Main Camera 할당
- Camera Target: CameraTarget 할당
- Walk Speed: 5
- Run Speed: 8
- Jump Force: 8
- Mouse Sensitivity: 100

#### 4. 프리팹 저장
플레이어 오브젝트를 `Assets/Metaverse/Core/Player/NetworkedPlayer.prefab`로 저장

#### 5. NetworkManager에 프리팹 할당
- NetworkManager의 `Player Prefab`에 방금 만든 프리팹 할당

### Step 4: 기본 환경 구성

#### 바닥 생성
```
GameObject > 3D Object > Plane
Name: "Ground"
Scale: (10, 1, 10)
Position: (0, 0, 0)
```

#### 조명 추가
```
GameObject > Light > Directional Light
Rotation: (50, -30, 0)
Intensity: 1
```

---

## 🧪 테스트하기

### 단일 플레이어 테스트 (Host 모드)
1. MainGallery 씬 열기
2. NetworkBootstrap의 `Is Server` 체크박스를 **체크** (Host 모드)
3. Play 버튼 클릭
4. WASD로 이동, Space로 점프, 마우스로 시점 회전 테스트

### 멀티플레이어 테스트 (2명)
**방법 1: ParrelSync 사용 (권장)**
1. Package Manager에서 ParrelSync 설치
2. Clone 생성 (`ParrelSync` > `Clones Manager` > `Create new clone`)
3. 원본: Host 모드로 실행
4. Clone: Client 모드로 실행

**방법 2: 빌드 파일 사용**
1. File > Build Settings
2. MainGallery 씬 추가
3. Build 클릭 → 빌드 파일 생성
4. Unity Editor: Host 모드로 실행
5. 빌드 파일: Client 모드로 실행

---

## 🖼️ Phase 4: 갤러리 작품 전시 테스트

### Step 1: 액자 프리팹 생성

#### 1. 액자 오브젝트
```
GameObject > 3D Object > Quad
Name: "ArtworkFrame"
Scale: (2, 1.5, 1) - 가로 2m, 세로 1.5m
Rotation: (0, 180, 0) - 플레이어를 향하도록
```

#### 2. 컴포넌트 추가
- `ArtworkFrame` (스크립트)

**ArtworkFrame 설정**:
- Artwork URL: (테스트 이미지 URL)
  예: `https://picsum.photos/800/600`
- Artwork Title: "테스트 작품"
- Artist Name: "테스트 작가"
- Interaction Distance: 3

#### 3. 머티리얼 설정
- 새 머티리얼 생성: `ArtworkMaterial`
- Shader: URP/Lit
- Albedo: 흰색
- Quad의 Renderer에 할당

#### 4. 프리팹 저장
`Assets/Metaverse/Gallery/Prefabs/ArtworkFrame.prefab`로 저장

### Step 2: 갤러리에 배치
- 씬에 여러 액자 배치
- 각 액자에 다른 이미지 URL 설정
- 플레이 모드에서 작품 로딩 테스트

---

## 💬 Phase 5: 채팅 UI 설정 (선택 사항)

### TextChat UI 생성
1. `GameObject` > `UI` > `Canvas`
2. Canvas에 TextChatUI 컴포넌트 추가
3. UI 요소들 설정:
   - Chat Panel (Panel)
   - Chat History Text (TextMeshProUGUI)
   - Chat Input Field (TMP_InputField)
   - Send Button (Button)

---

## 🐛 문제 해결

### 패키지 설치 오류
- Unity Hub에서 Unity 2021.3.9f1 재설치
- `Packages` 폴더 삭제 후 Unity 재시작

### 스크립트 컴파일 오류
- `Assets` > `Reimport All`
- Unity 재시작

### 네트워크 연결 안 됨
- 방화벽에서 포트 7777 허용
- localhost (127.0.0.1) 사용 확인

### URP 변환 후 분홍색 머티리얼
- `Edit` > `Render Pipeline` > `URP` > `Upgrade Materials`
- 각 머티리얼 수동으로 Shader를 URP/Lit로 변경

---

## 📊 성능 최적화 (나중에)

현재는 기능 구현에 집중하고, 최적화는 Phase 10에서 진행합니다.

---

## 📞 도움말

문제가 발생하면:
1. Unity Console 확인 (에러 메시지)
2. `Assets/Metaverse/README.md` 참고
3. GitHub Issues에 문의

---

**작성일**: 2026-07-09
**버전**: Phase 1 - Foundation
