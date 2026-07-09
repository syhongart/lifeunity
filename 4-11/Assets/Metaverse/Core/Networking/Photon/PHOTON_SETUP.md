# Photon PUN2 설치 가이드

## 🌐 Photon으로 WebGL + 모바일 지원

Photon PUN2를 사용하면 **웹(WebGL)**, **모바일(Android/iOS)**, **PC** 모두 지원 가능합니다!

---

## 📦 Step 1: Photon PUN2 설치

### 방법 A: Asset Store (추천)

1. Unity 에디터에서 **Asset Store** 열기
   - `Window` > `Asset Store`
   - 또는 브라우저: https://assetstore.unity.com/packages/tools/network/pun-2-free-119922

2. **"PUN 2 - FREE"** 검색

3. **Download** → **Import** 클릭

4. Import 창에서 **모두 선택** 후 **Import**

### 방법 B: Package Manager (GitHub)

```
Window > Package Manager > + > Add package from git URL
```

URL 입력:
```
https://github.com/photonengine/PhotonUnityNetworking.git#master
```

---

## 🔑 Step 2: Photon 계정 및 App ID 발급

### 1. Photon 계정 생성
https://dashboard.photonengine.com/en-US/account/signup

- 무료 (Free Plan): 20 CCU
- Email 인증 필요

### 2. App ID 발급
1. Dashboard 로그인
2. **"CREATE A NEW APP"** 클릭
3. 설정:
   - **Photon Type**: Photon PUN
   - **Name**: LifeUnity Metaverse
   - **Description**: Metaverse Gallery Platform
4. **CREATE** 클릭
5. **App ID** 복사 (긴 문자열)

### 3. Unity에 App ID 입력
1. Unity 에디터에서:
   ```
   Window > Photon Unity Networking > PUN Wizard
   ```

2. **Setup Project** 클릭

3. **App ID** 붙여넣기

4. **Setup Project** 클릭

5. ✅ 완료!

---

## 🔧 Step 3: Photon 스크립트 주석 해제

### PhotonBootstrap.cs 수정

파일 위치: `Assets/Metaverse/Core/Networking/Photon/PhotonBootstrap.cs`

**1. Using 문 주석 해제**:
```csharp
// 기존 (주석)
// using Photon.Pun;
// using Photon.Realtime;

// 변경 후 (주석 제거)
using Photon.Pun;
using Photon.Realtime;
```

**2. 클래스 상속 변경**:
```csharp
// 기존
public class PhotonBootstrap : MonoBehaviour

// 변경 후
public class PhotonBootstrap : MonoBehaviourPunCallbacks
```

**3. 메서드 주석 해제**:
파일 내의 모든 `/* Photon PUN2 설치 후 주석 해제: ... */` 블록 주석 제거

### PhotonAvatarController.cs 수정

파일 위치: `Assets/Metaverse/Core/Networking/Photon/PhotonAvatarController.cs`

**1. Using 문 주석 해제**:
```csharp
using Photon.Pun;
```

**2. 클래스 상속 변경**:
```csharp
// 기존
public class PhotonAvatarController : MonoBehaviour

// 변경 후
public class PhotonAvatarController : MonoBehaviourPun
```

**3. 메서드 주석 해제**:
모든 `/* Photon ... */` 주석 블록 해제

---

## 🎮 Step 4: 플레이어 프리팹 생성

### 1. 프리팹 폴더 생성
```
Assets/Resources/
```
**중요**: Photon은 `Resources` 폴더에서 프리팹을 로드합니다!

### 2. 플레이어 프리팹 생성

#### 기본 오브젝트
```
GameObject > 3D Object > Capsule
이름: "PhotonPlayer"
```

#### 컴포넌트 추가
1. **CharacterController**
   - Radius: 0.5
   - Height: 2
   - Center: (0, 1, 0)

2. **PhotonView** (Photon)
   - Observed Components: PhotonTransformView, PhotonAvatarController
   - Synchronization: Reliable Delta Compressed

3. **PhotonTransformView** (Photon)
   - Synchronize Position: ✓
   - Synchronize Rotation: ✓
   - Synchronize Scale: ☐

4. **PhotonAvatarController** (우리 스크립트)
   - 설정은 NetworkedAvatarController와 동일

#### 카메라 설정
```
PhotonPlayer
  └─ CameraTarget (빈 오브젝트, Y=1.6)
       └─ Main Camera
```

#### 프리팹 저장
**중요**: 반드시 `Assets/Resources/PhotonPlayer.prefab`로 저장!

---

## 🌐 Step 5: 씬 설정

### MainGallery 씬 구성

#### 1. NetworkManager 대신 PhotonManager
```
GameObject > Create Empty > "PhotonManager"
Component 추가:
  - PhotonBootstrap (스크립트)
```

**PhotonBootstrap 설정**:
- Game Version: 1.0
- Max Players Per Room: 50
- Room Name: MainGallery
- Auto Connect: ✓

#### 2. 기존 NetworkManager 제거
- Unity Netcode의 NetworkManager 오브젝트 삭제 (또는 비활성화)

---

## 🧪 Step 6: 테스트

### 로컬 테스트 (단일 플레이어)

1. MainGallery 씬 열기
2. Play 버튼 클릭
3. Console 확인:
   ```
   [PhotonBootstrap] Connecting to Photon Cloud...
   [PhotonBootstrap] ✓ Connected to Photon Cloud!
   [PhotonBootstrap] Joined lobby
   [PhotonBootstrap] ✓ Joined room: MainGallery
   [PhotonBootstrap] Player spawned
   ```

4. WASD 이동, 마우스 시점 테스트

### 멀티플레이어 테스트 (2명)

#### 방법 1: ParrelSync (Unity 복제)
1. Package Manager에서 **ParrelSync** 설치
   ```
   https://github.com/VeriorPies/ParrelSync.git?path=/ParrelSync
   ```

2. `ParrelSync` > `Clones Manager` > `Create new clone`

3. 원본 Unity: Play
4. Clone Unity: Play
5. 같은 방에 접속되어 서로 보임!

#### 방법 2: Build + Editor
1. `File` > `Build Settings` > **PC, Mac & Linux Standalone**
2. Build 클릭
3. Unity Editor: Play
4. Build 파일: 실행
5. 같은 방에 접속

---

## 🌐 Step 7: WebGL 빌드 (웹 지원)

### 1. Build Settings
```
File > Build Settings > WebGL
Switch Platform
```

### 2. Player Settings
```
Player Settings > WebGL:
  - Compression Format: Gzip (또는 Brotli)
  - Memory Size: 2048 MB
  - Enable Exceptions: None (성능 최적화)
```

### 3. Build
```
Build > 폴더 선택 > 빌드 완료 대기 (10-20분)
```

### 4. 테스트
- 빌드 폴더의 `index.html` 브라우저로 열기
- **주의**: `file://` 프로토콜은 안 됨! 로컬 서버 필요

**간단한 로컬 서버**:
```bash
cd build_folder
python -m http.server 8000
```

브라우저: `http://localhost:8000`

---

## 📱 Step 8: 모바일 빌드

### Android

#### Build Settings
```
File > Build Settings > Android
Switch Platform
```

#### Player Settings
```
Player Settings > Android:
  - Minimum API Level: 24 (Android 7.0)
  - Target API Level: 33 (Android 13)
  - Scripting Backend: IL2CPP
  - Target Architectures: ARM64 체크
```

#### Permissions
```
Edit > Project Settings > Player > Android > Other Settings
Internet Access: Require
Write Permission: External (SD Card)
```

#### Build
```
Build > .apk 저장 > 빌드 완료 대기
Android 기기에 설치하여 테스트
```

### iOS

#### Build Settings
```
File > Build Settings > iOS
Switch Platform
```

#### Player Settings
```
Player Settings > iOS:
  - Minimum iOS Version: 12.0
  - Architecture: ARM64
  - Camera Usage Description: "작품 촬영 및 업로드"
  - Microphone Usage Description: "음성 채팅"
```

#### Build
```
Build > Xcode 프로젝트 생성
Xcode에서 프로젝트 열기
서명 및 빌드
```

---

## 🎯 성능 최적화 (플랫폼별)

### WebGL 최적화

**그래픽 품질 낮추기**:
```csharp
#if UNITY_WEBGL
    QualitySettings.SetQualityLevel(1); // Low
    Application.targetFrameRate = 30;
#endif
```

**Addressables로 분할 로딩**:
- 초기 로딩: 필수만 (< 20MB)
- 갤러리 진입 시: 작품 동적 로드

### 모바일 최적화

**URP 설정**:
- MSAA: 2x 또는 Off
- Shadow Resolution: 512
- Shadow Distance: 30m

**LOD 설정**:
- LOD 0: 100% (가까이)
- LOD 1: 50% (중간)
- LOD 2: 25% (멀리)

---

## 🔧 문제 해결

### Photon 연결 안 됨
- App ID 확인
- 인터넷 연결 확인
- 방화벽 설정 (UDP/TCP 5055-5058 포트)

### "Resources 폴더에 프리팹 없음" 오류
- 프리팹이 `Assets/Resources/PhotonPlayer.prefab`에 정확히 있는지 확인
- 이름이 정확히 "PhotonPlayer"인지 확인

### WebGL에서 로딩 안 됨
- 로컬 서버 사용 (`python -m http.server`)
- 브라우저 콘솔에서 에러 확인

### 모바일에서 터치 안 됨
- Input System 설정 확인
- 가상 조이스틱 에셋 추가 필요

---

## 📊 Photon vs Unity Netcode 비교

| 기능 | Photon PUN2 | Unity Netcode |
|------|-------------|---------------|
| **WebGL 지원** | ✅ 완벽 | ⚠️ 제한적 |
| **모바일 지원** | ✅ 완벽 | ✅ 완벽 |
| **음성 채팅** | ✅ Photon Voice | ⚠️ 별도 구현 |
| **무료 CCU** | 20 | 무제한 |
| **유료 ($95/월)** | 100 CCU | - |
| **서버 관리** | Photon Cloud | 직접 호스팅 |
| **학습 곡선** | 쉬움 | 중간 |

---

## 🎉 완료!

Photon PUN2 설정이 완료되면 **PC, WebGL, 모바일** 모두에서 실행 가능합니다!

**다음 단계**:
1. ✅ Photon 설치 및 설정
2. 갤러리 환경 구축
3. 작품 전시 시스템 통합
4. 음성 채팅 (Photon Voice) 추가
5. 모바일 UI/조이스틱 구현

---

**작성일**: 2026-07-09
**Photon Version**: PUN 2
