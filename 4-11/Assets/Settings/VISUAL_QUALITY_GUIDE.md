# 🎨 메타버스 비주얼 퀄리티 가이드

## 갤러리급 조명과 텍스처 완벽 가이드

---

## 🌟 조명 (Lighting) - 가장 중요!

### 1. 라이팅 전략: Baked + Realtime 혼합

**갤러리 환경에 최적화된 설정**:

```
Window > Rendering > Lighting

Mixed Lighting:
  ✓ Baked Global Illumination (베이킹)
  ✓ Realtime Global Illumination (실시간)
  
Lightmapping Settings:
  - Lightmapper: Progressive GPU (빠름) 또는 Progressive CPU
  - Direct Samples: 64
  - Indirect Samples: 512
  - Environment Samples: 256
  - Bounces: 3 (갤러리는 간접광 중요)
  - Lightmap Resolution: 40 (높을수록 디테일)
  - Lightmap Size: 2048 (최대 4096)
  - Compress Lightmaps: 체크 해제 (품질 우선)
  - Ambient Occlusion: ✓ (그림자 디테일)
    - Max Distance: 1
    - Direct Contribution: 0.5
    - Indirect Contribution: 1
```

### 2. 주요 조명 설정 (3가지 타입)

#### A. 메인 조명 (Directional Light) - 전체 분위기
```
Intensity: 1.0
Color: 약간 따뜻한 흰색 (FFF4E6)
Mode: Mixed (그림자는 베이킹, 움직이는 오브젝트는 실시간)
Shadow Type: Soft Shadows
Shadow Resolution: Very High
Shadow Bias: 0.05
Shadow Normal Bias: 0.4
```

#### B. 스포트라이트 (Spot Light) - 작품 강조용
```
작품마다 1개씩 배치 (자동화 스크립트 제공됨)

Intensity: 2.5 - 4.0
Range: 10m
Spot Angle: 30-45도
Color: 순백색 (FFFFFF) 또는 약간 따뜻한 톤
Mode: Baked (성능 최적화)
Shadow Type: No Shadows (베이킹으로 처리)

위치: 작품 위 45도 각도, 2-3m 거리
```

#### C. 포인트 라이트 (Point Light) - 보조 조명
```
천장 전체에 균일하게 배치 (5-10m 간격)

Intensity: 0.8 - 1.2
Range: 8m
Color: 중성 백색 (F8F8F8)
Mode: Baked
Shadow Type: No Shadows
```

### 3. HDRI 스카이박스 (리얼한 반사광)

**무료 고품질 HDRI 다운로드**:
- https://polyhaven.com/hdris (무료, 상업용 가능)
- 추천: "studio_small_08" (갤러리용)
- 추천: "photo_studio_loft_hall" (넓은 공간)

**Unity 설정**:
```
1. HDRI 이미지 다운로드 (.hdr 파일)
2. Unity로 Import
3. Texture Shape: Cube 선택
4. Mapping: Latitude-Longitude Layout
5. Window > Rendering > Lighting
6. Environment > Skybox Material: 새 Material 생성
   - Shader: Skybox/Cubemap
   - Cubemap: HDRI 할당
7. Environment Lighting:
   - Source: Skybox
   - Intensity Multiplier: 1.0 - 1.5
   - Ambient Mode: Skybox
```

### 4. Reflection Probes (사실적인 반사)

**갤러리 각 방마다 1개씩 배치**:
```
GameObject > Light > Reflection Probe

Type: Baked
Mode: Baked
Resolution: 512 (고품질: 1024)
HDR: ✓
Box Projection: ✓ (실내 필수!)
Size: 방 크기에 맞게 (예: 15x5x15)

배치:
- 각 방 중앙, 바닥에서 2.5m 높이
- 작품이 많은 곳은 추가 Probe
```

### 5. Light Probes (동적 오브젝트용)

**플레이어/아바타가 자연스러운 조명을 받도록**:
```
GameObject > Light > Light Probe Group

배치 전략:
- 방 모서리 8개
- 작품 근처 (밝은 곳)
- 복도, 통로
- 입구, 출구
- 총 20-50개 프로브 (방 크기에 따라)
```

---

## 🎨 텍스처 (Materials & Textures)

### 1. PBR (Physically Based Rendering) 필수

**URP/Lit 셰이더 사용** (표준):
```
모든 오브젝트에 PBR 머티리얼 적용:

- Albedo (Base Color): 기본 색상
- Metallic: 금속성 (0 = 비금속, 1 = 금속)
- Smoothness: 광택 (0 = 거친, 1 = 매끄러운)
- Normal Map: 디테일 (선택)
- Occlusion Map: 그림자 강화 (선택)
```

### 2. 벽 텍스처 (가장 중요!)

**무료 고품질 텍스처**:
- https://polyhaven.com/textures (4K, PBR, 무료)
- https://ambientcg.com (CC0 라이선스)

**추천 벽 텍스처**:
```
화이트 갤러리:
  - "white_plaster_wall" (깨끗한 화이트)
  - "painted_concrete" (약간 텍스처)
  - "smooth_concrete" (모던)

고급 갤러리:
  - "polished_marble" (대리석)
  - "wood_panel" (목재 패널)
  - "brushed_metal" (금속 악센트)
```

**텍스처 설정**:
```
해상도: 2048x2048 (최소) - 4096x4096 (최고)
Format: PNG (투명도) 또는 JPG
Compression: None (최고 품질) 또는 High Quality

Unity Import Settings:
  - Texture Type: Default
  - sRGB (Color Texture): ✓ (Albedo용)
  - Alpha Source: From Gray Scale
  - Generate Mip Maps: ✓
  - Max Size: 2048 (WebGL) / 4096 (PC)
```

### 3. 바닥 텍스처

**추천**:
```
갤러리:
  - "polished_concrete" (세련됨)
  - "marble_floor" (고급)
  - "wood_floor_parquet" (따뜻함)
  - "white_tiles" (깨끗함)

크기: 4096x4096
Tiling: 5-10 (넓은 면적 커버)
```

### 4. 액자/프레임 텍스처

**작품 프레임 머티리얼**:
```
Material Settings:
  - Metallic: 0.3 - 0.6 (약간 금속성)
  - Smoothness: 0.6 - 0.8 (광택)
  - Color: 골드(D4AF37), 실버(C0C0C0), 블랙(1A1A1A)

고급 옵션:
  - Normal Map: 나무/금속 디테일
  - Emission: 약간의 빛 (0.1 - 0.2)
```

### 5. 천장

```
흰색 페인트:
  - Color: FAFAFA
  - Metallic: 0
  - Smoothness: 0.2 (약간 거침)
  - Emission: 0 (조명은 별도)
```

---

## 🎯 Asset Store 추천 (고품질 에셋)

### 무료 에셋

1. **"Gallery Interior"** - 갤러리 환경 (무료)
   - 고품질 벽, 바닥, 천장
   - PBR 머티리얼

2. **"Simple Art Gallery Pack"** - 액자 시스템
   - 다양한 프레임 스타일
   - 즉시 사용 가능

3. **"Modern Furniture Pack"** - 가구
   - 의자, 테이블, 벤치
   - 저폴리 + 고품질

### 유료 에셋 (최고 품질)

1. **"Art Gallery Kit"** ($19.99)
   - 완전한 갤러리 환경
   - 5가지 스타일
   - Lightmapping 포함

2. **"Museum Complete Pack"** ($49.99)
   - AAA급 품질
   - 200+ 에셋
   - Baked Lighting

3. **"Interior Props Vol.1"** ($29.99)
   - 고품질 소품
   - PBR 텍스처 4K

---

## 🔧 Unity 프로젝트 설정

### 1. Quality Settings

```
Edit > Project Settings > Quality

Ultra (PC용):
  - Anti Aliasing: 8x MSAA
  - Anisotropic Textures: Per Texture
  - Texture Quality: Full Res
  - Shadows: Very High Distance
  - Shadow Resolution: Very High Resolution
  - Shadow Cascades: Four Cascades

Medium (WebGL/모바일):
  - Anti Aliasing: 2x MSAA
  - Texture Quality: Half Res
  - Shadows: Medium Distance
  - Shadow Resolution: Medium Resolution
```

### 2. URP Asset 설정

```
Assets/Settings/URP/MetaverseURP-HighQuality.asset

Rendering:
  - Depth Texture: ✓
  - Opaque Texture: ✓ (반사에 필요)
  - Opaque Downsampling: None

Lighting:
  - Main Light: Per Pixel
  - Main Light Shadows: ✓
  - Additional Lights: Per Pixel
  - Additional Lights Shadows: ✓
  - Shadow Resolution: 4096
  - Soft Shadows: ✓

Post-processing:
  - HDR: ✓
  - Color Grading Mode: High Dynamic Range
  - LUT Size: 32
```

### 3. Post-Processing Volume

```
이미 생성된 프로필 사용:
Assets/Settings/URP/MetaversePostProcessing.asset

갤러리 최적 설정:
  - Bloom: Intensity 0.3 (은은하게)
  - Color Grading:
    - Temperature: +5 (따뜻함)
    - Tint: 0
    - Contrast: +10
    - Saturation: +5
  - Ambient Occlusion: Intensity 0.6
  - Depth of Field: 비활성화 (갤러리는 전체 선명)
  - Vignette: Intensity 0.15 (미묘하게)
```

---

## 🎨 실전 씬 구성 예시

### 갤러리 룸 레이아웃

```
1. 바닥 (10x10m)
   - Material: Polished Concrete
   - Tiling: 5x5

2. 벽 (높이 4m)
   - Material: White Plaster
   - 두께: 0.3m

3. 천장
   - Material: White Paint
   - 포인트 라이트 8개 균일 배치

4. 조명
   - Directional Light 1개 (전체)
   - 작품별 Spot Light (2.5 Intensity)
   - 천장 Point Light 8개 (1.0 Intensity)
   - Reflection Probe 1개 (중앙)

5. 작품 (ArtworkFrame)
   - 벽에서 0.1m 띄워서 배치
   - 높이: 1.5m (눈높이)
   - Spot Light로 강조

6. 바닥 그림자
   - Contact Shadows 활성화
   - Baked Shadows (성능)
```

---

## 🚀 자동화 스크립트

### 작품별 자동 조명 생성

```csharp
// 이미 GalleryLightingManager.cs에 포함됨
Assets/Settings/URP/GalleryLightingManager.cs

사용법:
1. 씬에 빈 오브젝트 생성: "LightingManager"
2. GalleryLightingManager 컴포넌트 추가
3. Inspector에서 Lighting Preset 선택:
   - Natural Daylight (자연광)
   - Warm Gallery (따뜻한 갤러리)
   - Cool Modern (차가운 현대식)
   - Dramatic Spotlight (극적)
   - Evening Ambient (저녁)

4. "Create Artwork Spotlights" 버튼 클릭
   → 모든 ArtworkFrame에 자동으로 Spot Light 생성!
```

---

## 📊 품질 체크리스트

### 조명
- [ ] Directional Light 설정 (Mixed, Soft Shadows)
- [ ] 작품별 Spot Light 배치 (2.5-4.0 Intensity)
- [ ] 천장 Point Light 균일 배치
- [ ] HDRI Skybox 적용
- [ ] Reflection Probe 각 방마다
- [ ] Light Probe Group 배치
- [ ] Baked Lighting 완료 (1-5분 소요)

### 텍스처
- [ ] 벽: PBR 텍스처 (2048x2048 이상)
- [ ] 바닥: 고품질 타일/콘크리트 (4096x4096)
- [ ] 천장: 흰색 페인트
- [ ] 액자: Metallic 0.3-0.6, Smoothness 0.6-0.8
- [ ] 모든 머티리얼 URP/Lit 셰이더 사용

### Post-Processing
- [ ] Bloom 활성화 (0.3 Intensity)
- [ ] Color Grading (+5 온도, +10 대비)
- [ ] Ambient Occlusion (0.6)
- [ ] Vignette (0.15)

### 최적화
- [ ] Occlusion Culling 활성화
- [ ] Static Batching (벽, 바닥)
- [ ] LOD Groups (먼 오브젝트)
- [ ] Lightmap Compression (WebGL)

---

## 🎯 최종 품질 테스트

### PC (고품질)
- 60 FPS @ 1080p
- 부드러운 그림자
- 반사 선명
- 텍스처 디테일 확인

### WebGL (최적화)
- 30+ FPS
- Lightmap 압축
- 텍스처 해상도 50%
- 그림자 간소화

---

## 📸 참고 스크린샷 찍기

Unity에서 고품질 스크린샷:
```csharp
// Game View에서
1. Resolution 설정: 1920x1080 이상
2. Quality Settings: Ultra
3. Play Mode
4. F12 또는 Screenshot 도구

또는 Unity Recorder:
Window > General > Recorder
  - Output Resolution: 4K (3840x2160)
  - Capture: Game View
```

---

## 💡 프로 팁

### 조명
- **작품마다 다른 색온도** 사용 (따뜻함/차가움)
- **그림자는 부드럽게** (Soft Shadows)
- **간접광 3번 반사** (Bounces: 3)

### 텍스처
- **4K는 PC만**, WebGL은 2K
- **Normal Map으로 디테일** 추가 (벽 표면)
- **Smoothness 0.2-0.4** (너무 반짝이지 않게)

### 성능
- **Baked Lighting** 우선 (실시간은 보조)
- **Occlusion Culling** 필수
- **Lightmap 해상도 40** (너무 높으면 용량 증가)

---

**작성일**: 2026-07-09
**목표**: 미술관급 비주얼 퀄리티!
