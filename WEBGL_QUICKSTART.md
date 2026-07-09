# ⚡ WebGL 빠른 시작 (5단계)

## 웹 주소로 바로 접속하기!

### 🎯 목표
`https://syhongart.github.io/lifeunity/` 에서 메타버스 실행

---

## 📋 5단계로 완성

### 1️⃣ Unity 프로젝트 열기 (5분)
```
Unity Hub > Unity 2021.3.9f1 설치 (없으면)
Unity Hub > Open > /home/user/lifeunity/4-11/
패키지 다운로드 대기 (자동)
```

### 2️⃣ Photon PUN2 설치 (10분)
```
Asset Store 열기 (Ctrl+9)
"PUN 2 - FREE" 검색 > Download > Import
Window > Photon Unity Networking > PUN Wizard
Photon 계정 생성: https://dashboard.photonengine.com
App ID 발급 후 입력
```

### 3️⃣ WebGL 빌드 (30분 - 처음만 오래 걸림)
```
File > Build Settings
Platform: WebGL 선택
Switch Platform (10분 대기)
Build 클릭
저장 위치: ~/Desktop/WebGL-Build
빌드 완료 대기 (20분)
```

### 4️⃣ GitHub Pages 배포 (5분)
```bash
# 터미널에서
cd ~/lifeunity
git checkout -b gh-pages
git rm -rf .
cp -r ~/Desktop/WebGL-Build/LifeUnityMetaverse/* .
git add .
git commit -m "WebGL build"
git push origin gh-pages
```

### 5️⃣ GitHub Pages 활성화 (1분)
```
1. GitHub 저장소: https://github.com/syhongart/lifeunity
2. Settings > Pages
3. Source: gh-pages 브랜치 선택
4. Save
```

---

## ✅ 완료!

**5-10분 후 접속**:
```
https://syhongart.github.io/lifeunity/
```

---

## 🔍 상세 가이드

문제 발생 시: `/WEBGL_DEPLOY.md` 참고

---

**예상 소요 시간**: 총 50분 (처음) → 이후 10분
