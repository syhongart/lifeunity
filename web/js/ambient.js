// ambient.js — 새소리 앰비언트 (Web Audio 실시간 합성, 오디오 파일 불필요)
// startAmbient()는 반드시 사용자 제스처(입장 버튼) 안에서 호출할 것 (autoplay 정책)

let ctx = null;
let master = null;
let running = false;

// 새 한 마리의 지저귐: 짧은 사인 스윕 음절 2~5개
function chirp(baseFreq, pan) {
  if (!ctx) return;
  const panner = new StereoPannerNode(ctx, { pan });
  panner.connect(master);

  const syllables = 2 + Math.floor(Math.random() * 4);
  let t = ctx.currentTime + 0.02;

  for (let s = 0; s < syllables; s++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(panner);

    const f0 = baseFreq * (0.85 + Math.random() * 0.4);
    const f1 = f0 * (Math.random() > 0.5 ? 1.25 : 0.78); // 위/아래 스윕
    const dur = 0.05 + Math.random() * 0.1;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + dur);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.55, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.start(t);
    osc.stop(t + dur + 0.02);

    t += dur + 0.04 + Math.random() * 0.09;
  }
}

// 아주 옅은 바람 소리 (필터링된 노이즈 루프)
function startBreeze() {
  const len = ctx.sampleRate * 4;
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    // 브라운 노이즈 (부드러운 저역)
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;

  const gain = ctx.createGain();
  gain.gain.value = 0.012;

  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start();
}

// 새 여러 마리를 랜덤 간격으로 스케줄
function scheduleBirds() {
  if (!running) return;
  const birds = [
    { base: 2600, pan: -0.7 },
    { base: 3400, pan: 0.6 },
    { base: 4200, pan: 0.15 },
  ];
  const bird = birds[Math.floor(Math.random() * birds.length)];
  chirp(bird.base, bird.pan + (Math.random() - 0.5) * 0.3);

  const next = 900 + Math.random() * 4200; // 0.9~5.1초 간격
  setTimeout(scheduleBirds, next);
}

export function startAmbient() {
  if (running) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.05; // 전체 볼륨 (은은하게)
    master.connect(ctx.destination);

    if (ctx.state === 'suspended') ctx.resume();

    running = true;
    startBreeze();
    scheduleBirds();
    // 살짝 겹치게 두 번째 스트림
    setTimeout(() => { if (running) scheduleBirds(); }, 2500);
  } catch (e) {
    // 오디오 미지원 환경 — 무음으로 진행
    running = false;
  }
}

export function stopAmbient() {
  running = false;
  if (ctx) {
    ctx.close();
    ctx = null;
    master = null;
  }
}
