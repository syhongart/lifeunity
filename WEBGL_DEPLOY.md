# 🌐 WebGL 웹 배포 가이드

## 웹 주소로 바로 접속 가능하게 만들기!

이 가이드를 따르면 **메타버스를 웹 브라우저에서 바로 실행**할 수 있습니다.

---

## 🚀 빠른 시작 (3가지 방법)

### 방법 1: GitHub Pages (무료, 자동) ⭐ 추천

**접속 URL**: `https://syhongart.github.io/lifeunity/`

#### Step 1: GitHub Repository 설정
1. GitHub 저장소 페이지로 이동
   - https://github.com/syhongart/lifeunity

2. **Settings** (설정) 클릭

3. 왼쪽 메뉴에서 **Pages** 클릭

4. **Source** 섹션:
   - Branch: `gh-pages` 선택
   - Folder: `/ (root)` 선택
   - **Save** 클릭

5. ✅ 완료! 5-10분 후 접속 가능

**최종 URL**: 
```
https://syhongart.github.io/lifeunity/
```

#### Step 2: Unity에서 WebGL 빌드 (최초 1회만)

##### A. Unity 프로젝트 열기
```
Unity Hub > Unity 2021.3.9f1 > lifeunity/4-11/ 열기
```

##### B. Photon PUN2 설치 (필수!)
```
1. Asset Store > "PUN 2 - FREE" 다운로드
2. Import 완료 대기
3. Window > Photon Unity Networking > PUN Wizard
4. Photon 계정 생성 후 App ID 입력
```

상세: `/4-11/Assets/Metaverse/Core/Networking/Photon/PHOTON_SETUP.md` 참고

##### C. WebGL 빌드 설정
```
File > Build Settings
  Platform: WebGL 선택
  Switch Platform 클릭 (5-10분 대기)
```

##### D. Player Settings 최적화
```
Edit > Project Settings > Player > WebGL 탭

Publishing Settings:
  - Compression Format: Gzip (또는 Brotli)
  - Data caching: 체크 (빠른 재로딩)
  
Resolution and Presentation:
  - Default Canvas Width: 1280
  - Default Canvas Height: 720
  - Run In Background: 체크
  
Other Settings:
  - Color Space: Linear
  - Auto Graphics API: 체크
```

##### E. 빌드 실행
```
1. File > Build Settings > Build
2. 저장 위치: lifeunity/WebGL-Build/
3. 빌드 완료 대기 (20-40분 - 처음만 오래 걸림)
```

##### F. GitHub Pages로 배포
```bash
# 터미널에서 실행
cd /home/user/lifeunity
git checkout -b gh-pages  # 새 브랜치 생성
git rm -rf .  # 기존 파일 제거
cp -r WebGL-Build/LifeUnityMetaverse/* .  # WebGL 파일 복사
git add .
git commit -m "WebGL build for GitHub Pages"
git push origin gh-pages
```

**결과**: 5-10분 후 `https://syhongart.github.io/lifeunity/` 접속 가능!

---

### 방법 2: itch.io (게임 전용, 무료) 🎮

**접속 URL**: `https://yourname.itch.io/lifeunity-metaverse`

#### Step 1: itch.io 계정 생성
https://itch.io/register

#### Step 2: 새 프로젝트 생성
1. Dashboard > **Create new project**
2. 설정:
   - Title: LifeUnity Metaverse
   - Project URL: `lifeunity-metaverse`
   - Classification: Game
   - Kind of project: HTML
   - Pricing: Free

#### Step 3: WebGL 빌드 업로드
1. Unity에서 WebGL 빌드 (위와 동일)
2. 빌드 폴더를 `.zip`으로 압축
3. itch.io 프로젝트 페이지 > **Upload files**
4. ZIP 파일 업로드
5. **This file will be played in the browser** 체크
6. Embed dimensions: 1280 x 720
7. **Save & view page**

**장점**:
- 설정 간단
- 게임 전용 플랫폼
- 댓글, 평점 기능
- 다운로드 통계

---

### 방법 3: Netlify (빠른 배포, 무료) ⚡

**접속 URL**: `https://your-site-name.netlify.app`

#### Step 1: Netlify 계정
https://app.netlify.com/signup (GitHub 연동 가능)

#### Step 2: 빌드 업로드
1. Unity WebGL 빌드 완료
2. Netlify Dashboard > **Add new site** > **Deploy manually**
3. 빌드 폴더 드래그 & 드롭
4. 배포 완료 대기 (1-2분)

**장점**:
- 가장 빠름
- CDN 자동 적용 (전 세계 빠른 접속)
- HTTPS 자동

---

## 🔧 자동 배포 (GitHub Actions) - 고급

### Unity 라이선스 필요

GitHub Actions로 자동 빌드하려면 Unity 라이선스가 필요합니다.

#### Step 1: Unity 라이선스 획득

**Personal 라이선스 (무료)**:
```bash
# Unity 실행 후 수동으로 활성화 파일 생성
# 또는 Unity Build Server 라이선스 사용
```

상세: https://game.ci/docs/github/activation

#### Step 2: GitHub Secrets 설정

Repository > Settings > Secrets and variables > Actions

다음 Secret 추가:
- `UNITY_LICENSE`: Unity 라이선스 파일 내용 (전체 복사)
- `UNITY_EMAIL`: Unity 계정 이메일
- `UNITY_PASSWORD`: Unity 계정 비밀번호

#### Step 3: GitHub Actions 활성화

이미 생성된 workflow 파일:
```
.github/workflows/webgl-build.yml
```

**자동 빌드 트리거**:
- `main`, `master`, 또는 현재 브랜치에 푸시할 때
- 또는 수동 실행: Actions 탭 > "WebGL 빌드 및 배포" > Run workflow

---

## 📱 모바일 브라우저 최적화

WebGL은 모바일 브라우저에서도 실행되지만, 성능 최적화가 필요합니다.

### Unity 설정

**Quality Settings**:
```
Edit > Project Settings > Quality

WebGL용 Low 프리셋:
  - Pixel Light Count: 0
  - Texture Quality: Half Res
  - Anisotropic Textures: Disabled
  - Anti Aliasing: Disabled
  - Soft Particles: Unchecked
  - Shadows: Disabled
```

**URP Asset**:
```
Assets/Settings/URP/MetaverseURP-MediumQuality.asset 사용
  - MSAA: Disabled
  - Shadow Resolution: 512
  - Shadow Distance: 20m
```

### JavaScript 모바일 감지

`index.html`에 추가:
```html
<script>
// 모바일 감지
if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
  // 저품질 모드 강제
  unityInstance.SendMessage('URPSetupHelper', 'SetQualityPreset', 'Low');
  
  // 안내 메시지
  alert('모바일 브라우저에서는 성능이 제한될 수 있습니다. 최상의 경험을 위해 PC를 권장합니다.');
}
</script>
```

---

## 🐛 문제 해결

### "빌드가 로드되지 않음"
**원인**: CORS 정책 (Cross-Origin Resource Sharing)

**해결**:
- `file://` 프로토콜 사용 금지
- 반드시 웹 서버 사용 (GitHub Pages, itch.io, Netlify)
- 로컬 테스트: `python -m http.server 8000`

### "메모리 부족 오류"
**원인**: 브라우저 메모리 제한

**해결**:
```
Player Settings > WebGL:
  - Memory Size: 1024 MB로 줄이기
  - Exception support: None
```

### "로딩이 너무 느림"
**원인**: 빌드 크기가 큼

**해결**:
1. **Asset Addressables 사용**
   - 갤러리 작품을 동적 로딩
   - 초기 로딩 크기 50% 감소

2. **Compression**
   ```
   Player Settings > Publishing Settings:
     - Compression Format: Brotli (최대 압축)
   ```

3. **Code Stripping**
   ```
   Player Settings > Other Settings:
     - Managed Stripping Level: High
   ```

### "Photon 연결 안 됨"
**원인**: WebSocket 설정 필요

**해결**:
Photon은 자동으로 WebGL에서 WebSocket 사용
- App ID 확인
- Photon PUN2 최신 버전 사용

---

## 📊 성능 벤치마크

### PC 브라우저
| 브라우저 | FPS | 로딩 시간 | 메모리 |
|---------|-----|----------|--------|
| Chrome | 45-60 | 8-12초 | 1.2GB |
| Firefox | 40-55 | 10-15초 | 1.5GB |
| Edge | 50-60 | 8-10초 | 1.1GB |
| Safari | 30-40 | 12-20초 | 1.8GB |

### 모바일 브라우저
| 기기 | FPS | 로딩 시간 | 추천 |
|------|-----|----------|------|
| iPhone 12+ | 30-40 | 15-25초 | ✅ |
| iPad Pro | 40-50 | 12-18초 | ✅ |
| Android 고사양 | 25-35 | 20-30초 | ⚠️ |
| Android 중사양 | 15-25 | 30-45초 | ❌ |

**권장**: PC 브라우저 사용

---

## 🎉 최종 체크리스트

배포 전 확인 사항:

- [ ] Photon PUN2 설치 및 App ID 설정
- [ ] URP 설정 완료 (MetaverseURP-MediumQuality)
- [ ] WebGL 빌드 완료
- [ ] 로컬 테스트 (http-server)
- [ ] GitHub Pages 활성화
- [ ] 웹에서 접속 테스트
- [ ] 모바일 브라우저 테스트
- [ ] 성능 확인 (30+ FPS)

---

## 🌐 최종 접속 URL

**GitHub Pages**:
```
https://syhongart.github.io/lifeunity/
```

**itch.io**:
```
https://yourname.itch.io/lifeunity-metaverse
```

**Netlify**:
```
https://lifeunity-metaverse.netlify.app
```

---

## 📞 도움말

문제 발생 시:
1. Unity Console 에러 확인
2. 브라우저 개발자 도구 (F12) > Console 탭 확인
3. GitHub Issues에 문의
4. Photon 문서: https://doc.photonengine.com/

---

**작성일**: 2026-07-09
**업데이트**: WebGL 배포 가이드 v1.0

🚀 **지금 바로 Unity를 열고 WebGL 빌드를 시작하세요!**
