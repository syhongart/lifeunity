# 플랫폼 지원 가이드

## 🎮 지원 플랫폼 개요

| 플랫폼 | 현재 상태 | 네트워킹 | 음성 채팅 | 권장 품질 | 개발 우선순위 |
|--------|----------|---------|----------|----------|--------------|
| **PC (Windows/Mac/Linux)** | ✅ 지원 | ✓ | ✓ | 최고 | 1순위 (현재) |
| **WebGL (브라우저)** | ⚠️ 제한적 | △ | ✗ | 중하 | 3순위 |
| **Android** | 🔄 계획 중 | ✓ | ✓ | 중 | 2순위 |
| **iOS** | 🔄 계획 중 | ✓ | ✓ | 중 | 2순위 |
| **VR (Quest/PCVR)** | 📋 향후 | ✓ | ✓ | 고 | 4순위 |

---

## 🌐 WebGL (브라우저) 상세

### 장점
- ✅ **설치 불필요** - URL만으로 접속
- ✅ **크로스 플랫폼** - 모든 OS에서 실행
- ✅ **접근성 최고** - 클릭 한 번으로 시작
- ✅ **빠른 업데이트** - 서버 배포만으로 자동 업데이트

### 단점 & 해결책

#### 1. Unity Netcode + WebGL 호환성 문제
**문제**:
- Unity Netcode for GameObjects는 UDP 기반
- WebGL은 WebSocket만 지원 (UDP 불가)
- 연결 불안정, 지연 증가

**해결책 A: Photon PUN2 사용** ⭐ 추천
```csharp
// 현재 (Netcode)
using Unity.Netcode;

// 변경 후 (Photon)
using Photon.Pun;
using Photon.Realtime;
```

**변경 필요 스크립트**:
- `NetworkBootstrap.cs` → `PhotonBootstrap.cs`
- `NetworkedAvatarController.cs` → `PhotonAvatarController.cs`
- 모든 `ServerRpc` → `[PunRPC]`

**Photon 장점**:
- WebGL 완벽 지원
- 자동 WebSocket 변환
- 무료: 20 CCU까지

**해결책 B: Mirror Networking**
```
Unity Netcode → Mirror
```
- WebGL 지원 (WebSocket Transport)
- 오픈소스 무료
- 하지만 Photon보다 설정 복잡

#### 2. Vivox 음성 채팅 미지원
**문제**:
- Vivox는 WebGL 미지원

**해결책**:

**Option 1: Photon Voice** ⭐
```
Vivox → Photon Voice 2
```
- WebGL 완벽 지원
- Photon PUN2와 완벽 통합

**Option 2: Agora.io**
- WebRTC 기반
- WebGL 지원
- 하지만 Unity SDK 품질 낮음

**Option 3: 음성 제외**
- WebGL 버전은 텍스트 채팅만
- PC/모바일은 음성 지원

#### 3. 성능 및 메모리 제한
**문제**:
- 브라우저 메모리 제한 (2-4GB)
- 로딩 시간 길음 (빌드 크기 50-200MB)
- FPS 30-40 정도로 제한

**해결책**:

**그래픽 품질 낮추기**
```csharp
// WebGL 플랫폼 감지
#if UNITY_WEBGL
    QualitySettings.SetQualityLevel(1); // Low quality
    Application.targetFrameRate = 30;
#else
    QualitySettings.SetQualityLevel(3); // High quality
    Application.targetFrameRate = 60;
#endif
```

**Addressables로 분할 로딩**
- 초기 로딩: 필수 에셋만 (10-20MB)
- 갤러리 진입 시: 작품 동적 로드

**텍스처 압축**
- ASTC/DXT 대신 WebGL 최적화 포맷
- 해상도 50% 감소

#### 4. 쓰레드 제한
**문제**:
- WebGL은 멀티쓰레딩 제한적
- Addressables, 네트워킹에 영향

**해결책**:
- 무거운 작업을 프레임 분산
- 코루틴 활용

---

## 📱 모바일 (Android/iOS) 상세

### 장점
- ✅ **Unity 완벽 지원**
- ✅ **네트워킹 문제 없음** (Netcode/Photon 모두 지원)
- ✅ **Vivox 지원** (iOS/Android)
- ✅ **URP 모바일 최적화** 렌더링

### 필요한 작업

#### 1. 터치 컨트롤 구현

**가상 조이스틱 추가**
```
Asset Store: "Joystick Pack" (무료)
또는 직접 구현
```

**NetworkedAvatarController 수정**:
```csharp
// 기존 (키보드)
horizontal = Input.GetAxis("Horizontal");
vertical = Input.GetAxis("Vertical");

// 추가 (조이스틱)
#if UNITY_ANDROID || UNITY_IOS
    horizontal = Joystick.Horizontal;
    vertical = Joystick.Vertical;
#endif
```

**카메라 회전 (터치 스와이프)**:
```csharp
// 기존 (마우스)
float mouseX = Input.GetAxis("Mouse X");

// 추가 (터치)
if (Input.touchCount > 0)
{
    Touch touch = Input.GetTouch(0);
    mouseX = touch.deltaPosition.x * touchSensitivity;
}
```

#### 2. UI 스케일 조정

**Canvas Scaler 설정**:
```
UI Scale Mode: Scale With Screen Size
Reference Resolution: 1080x1920 (세로) 또는 1920x1080 (가로)
Screen Match Mode: Match Width Or Height
Match: 0.5
```

**버튼 크기**:
```
최소 크기: 100x100 픽셀 (터치 가능한 크기)
간격: 20 픽셀 이상
```

#### 3. 성능 최적화

**그래픽 설정**:
```csharp
// URP Asset 모바일 설정
Rendering Path: Forward
MSAA: 2x (또는 비활성화)
Shadow Resolution: 512 또는 1024
Shadow Distance: 30m
```

**LOD (Level of Detail)**:
```
LOD 0 (가까이): 원본 모델
LOD 1 (중간): 50% 폴리곤
LOD 2 (멀리): 25% 폴리곤
```

**Draw Call 줄이기**:
- Static Batching 활성화
- Texture Atlas 사용
- Object Pooling

#### 4. 해상도 및 종횡비

**다양한 화면 비율 대응**:
```
iPhone: 19.5:9
Android: 16:9, 18:9, 19:9, 20:9
Tablet: 4:3, 16:10
```

**Safe Area 고려**:
```csharp
// 노치/홈바 영역 피하기
RectTransform rectTransform = GetComponent<RectTransform>();
Rect safeArea = Screen.safeArea;
rectTransform.anchorMin = new Vector2(safeArea.x / Screen.width, 
                                       safeArea.y / Screen.height);
```

#### 5. 권한 요청

**Android (Manifest)**:
```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.RECORD_AUDIO"/>
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
```

**iOS (Info.plist)**:
```xml
<key>NSMicrophoneUsageDescription</key>
<string>음성 채팅을 위해 마이크 권한이 필요합니다.</string>
```

---

## 🚀 WebGL + 모바일 동시 지원 전략

### 추천: Photon PUN2로 마이그레이션

**1단계: Photon PUN2 설치**
```
Asset Store → "Photon PUN 2 - FREE" 다운로드
또는
Package Manager → Photon PUN2 설치
```

**2단계: 핵심 스크립트 변환**

**NetworkBootstrap.cs → PhotonBootstrap.cs**:
```csharp
using Photon.Pun;
using Photon.Realtime;

public class PhotonBootstrap : MonoBehaviourPunCallbacks
{
    void Start()
    {
        PhotonNetwork.ConnectUsingSettings();
    }
    
    public override void OnConnectedToMaster()
    {
        PhotonNetwork.JoinRandomOrCreateRoom();
    }
}
```

**NetworkedAvatarController.cs → PhotonAvatarController.cs**:
```csharp
using Photon.Pun;

public class PhotonAvatarController : MonoBehaviourPun
{
    void Update()
    {
        if (!photonView.IsMine) return; // 로컬 플레이어만
        
        // 이동 로직 (기존과 동일)
    }
    
    // RPC 예시
    [PunRPC]
    void UpdatePosition(Vector3 pos)
    {
        transform.position = pos;
    }
}
```

**3단계: 플랫폼별 빌드 설정**

**WebGL**:
```
File > Build Settings > WebGL
Player Settings:
  - Compression Format: Gzip
  - Memory Size: 2048 MB
  - Enable Exceptions: None
```

**Android**:
```
File > Build Settings > Android
Player Settings:
  - Minimum API Level: 24 (Android 7.0)
  - Target API Level: 33 (Android 13)
  - Scripting Backend: IL2CPP
  - ARM64 체크
```

**iOS**:
```
File > Build Settings > iOS
Player Settings:
  - Minimum iOS Version: 12.0
  - Architecture: ARM64
  - Camera Usage Description 추가
```

---

## 📊 플랫폼별 성능 목표

| 플랫폼 | 해상도 | FPS | 동시 접속 | 빌드 크기 |
|--------|--------|-----|----------|----------|
| **PC** | 1920x1080 | 60 | 100 | 500 MB |
| **WebGL** | 1280x720 | 30 | 20 | 80 MB |
| **Android (High)** | 1920x1080 | 60 | 50 | 150 MB |
| **Android (Mid)** | 1280x720 | 30 | 30 | 150 MB |
| **iOS** | 1920x1080 | 60 | 50 | 200 MB |

---

## 🔧 구현 로드맵

### Phase 2B: WebGL 지원 (2주)
- [ ] Photon PUN2 설치 및 설정
- [ ] NetworkBootstrap → PhotonBootstrap 변환
- [ ] NetworkedAvatarController → PhotonAvatarController 변환
- [ ] WebGL 빌드 테스트
- [ ] 성능 최적화

### Phase 5B: 모바일 지원 (3주)
- [ ] 터치 컨트롤 구현 (조이스틱 + 스와이프)
- [ ] UI 스케일 조정
- [ ] Safe Area 대응
- [ ] 모바일 성능 최적화
- [ ] Android/iOS 빌드 및 테스트
- [ ] 권한 처리

---

## 💡 즉시 WebGL + 모바일 지원 시작하기

지금 바로 Photon으로 전환할까요?

**장점**:
- ✅ WebGL 완벽 지원
- ✅ 모바일 완벽 지원
- ✅ 무료 (20 CCU)
- ✅ 음성 채팅 (Photon Voice)
- ✅ 쉬운 구현

**단점**:
- ⚠️ 기존 Netcode 코드 재작성 필요 (하루 작업)
- ⚠️ 100 CCU 이상은 유료 ($95/월)

**결정해주세요**:
1. **지금 Photon으로 전환** → WebGL + 모바일 즉시 지원
2. **PC 먼저 완성** → 나중에 Photon 전환
3. **Netcode 유지** → PC/모바일만 지원 (WebGL 포기)

어떻게 할까요?
