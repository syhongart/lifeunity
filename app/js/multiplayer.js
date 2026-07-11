// multiplayer.js — PeerJS 호스트-릴레이 멀티플레이어
// 전역 Peer (index.html의 script 태그로 로드됨) 사용. import 금지.

import * as THREE from 'three';
import { PEER_ROOM_ID, EYE_HEIGHT } from './config.js';
import { createAvatarInstance } from './avatar.js';
import { mergeNotes } from './guestbook.js';
import { isValidPhotoItem } from './feed.js';

// 룸 id는 전시별로 분리된다(같은 전시를 보는 사람끼리만 만난다) — 생성자 옵션으로
// 주입되며, 미지정 시 기본 전시 룸(PEER_ROOM_ID)을 쓴다.
const WOUND_HEAL_SECONDS = 20; // 상처 1단계 회복 시간
const HIT_RANGE = 4.0; // 호스트가 검증하는 최대 타격 거리(m) — 원격 치트 방지 겸 상식선
const SEND_INTERVAL = 1 / 10; // 10Hz
const LERP_RATE = 10;

export class MultiplayerManager {
  /**
   * @param {THREE.Scene} scene
   * @param {{nickname: string, color: string, char?: string}} opts
   */
  constructor(scene, { nickname, color, char, roomId }) {
    this.scene = scene;
    this.nickname = nickname;
    this.color = color;
    // PeerJS id 허용 문자만 남긴다 (영숫자·하이픈·언더스코어)
    this.roomId = String(roomId || PEER_ROOM_ID).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || PEER_ROOM_ID;
    this._hostId = this.roomId + '-host';
    this.char = char || 'knight'; // 하위호환: 구버전(char 미전송) 원격도 'knight'로 폴백

    // 콜백 프로퍼티 (외부에서 할당)
    this.onChat = (name, text) => {};
    this.onPlayerCount = (n) => {};
    // AI 관객(NPC) — 호스트일 때 매 프레임 호출해 상태 맵을 받는 훅 (main.js가 배선)
    this.npcProvider = null;
    this._npcStates = null;
    // 맞기 시스템 — 대상별 상처 상태 {level(0~3), t(다음 회복까지 남은 초)}.
    // 모든 클라이언트가 같은 hit 이벤트를 받아 같은 감쇠를 돌리므로 대체로 일치한다.
    this._wounds = new Map();
    this.onSelfHit = (level) => {}; // 내가 맞았을 때 (main.js가 화면 연출)
    this.onVisitor = (id, info) => {}; // 새 사람 방문자 관측 (통계용 — NPC 제외)
    this.onPhoto = (item) => {}; // 원격 캡처 사진 수신 (포토월 — main.js가 저장/알림)
    this.onNpcHit = (id, level) => {}; // NPC가 맞았을 때 (호스트 전용 — 아파하는 채팅)
    this.onStatus = (statusText) => {};
    this.onGuestbook = (notes) => {};

    this.peer = null;
    this.isHost = false;
    this.hostConn = null;         // 게스트일 때 호스트로의 연결
    this.connections = new Map(); // 호스트일 때: peerId → DataConnection
    this.playerInfo = new Map();  // 호스트일 때: peerId → {nickname,color,char,x,y,z,ry}

    // 원격 아바타: peerId → { inst, group, targetPos: Vector3, targetRy, prevPos, smoothedSpeed }
    this.remoteAvatars = new Map();

    this._lastState = { x: 0, y: EYE_HEIGHT, z: 0, ry: 0 };
    this._sendAccum = 0;
    this._hostBroadcastAccum = 0;

    // 호스트일 때: 지금까지 병합된 방명록 노트 (게스트들에게 전파할 기준본)
    this._guestbookNotes = [];

    this._disposed = false;
    this._reconnectTimer = null;
  }

  // ---------------------------------------------------------------- 공개 API

  connect() {
    this.onStatus('서버 연결 중...');
    this._tryBecomeHost();
  }

  /**
   * 로컬 플레이어 상태 전송 (10Hz 스로틀은 update 루프에서 처리)
   * @param {{x:number,y:number,z:number,ry:number}} state
   */
  sendState(state) {
    this._lastState = state;
  }

  /**
   * 관람 캡처 공유 — 같은 방 전원에게 썸네일을 전파한다 (방명록과 같은
   * 로컬 우선 피드 규약: 수신 측이 feed.js 검증 후 localStorage에 병합).
   */
  sendPhoto(item) {
    if (!isValidPhotoItem(item)) return;
    const msg = { type: 'photo', item, senderId: this.peer ? this.peer.id : null };
    if (this.isHost) {
      this._broadcast(msg);
    } else if (this.hostConn && this.hostConn.open) {
      this.hostConn.send(msg);
    }
  }

  /**
   * 아바타 때리기 — 게스트는 호스트에 요청, 호스트가 검증(거리)·적용 후 전원에
   * 릴레이한다. 자신의 화면 반영도 릴레이 수신 경로 하나로 통일된다.
   * @param {string} targetId - 원격 플레이어 peer id 또는 'npc-N'
   */
  sendHit(targetId) {
    if (!targetId) return;
    const msg = { type: 'hit', target: targetId, sx: this._lastState.x, sz: this._lastState.z };
    if (this.isHost) {
      this._applyHit(msg);
    } else if (this.hostConn && this.hostConn.open) {
      this.hostConn.send(msg);
    }
  }

  // 호스트: 거리 검증 → 상처 누적 → 전원 릴레이(+자신 반영)
  _applyHit(msg) {
    const target = String(msg.target || '');
    let tx = null;
    let tz = null;
    if (this._npcStates && this._npcStates[target]) {
      tx = this._npcStates[target].x;
      tz = this._npcStates[target].z;
    } else if (this.playerInfo.has(target)) {
      const info = this.playerInfo.get(target);
      tx = info.x;
      tz = info.z;
    } else if (this.peer && target === this.peer.id) {
      tx = this._lastState.x;
      tz = this._lastState.z;
    }
    if (tx == null || Math.hypot(tx - (msg.sx || 0), tz - (msg.sz || 0)) > HIT_RANGE) return;
    const cur = this._wounds.get(target);
    const level = Math.min(3, (cur ? cur.level : 0) + 1);
    this._broadcast({ type: 'hitfx', target, level });
    this._receiveHitFx(target, level);
    if (target.startsWith('npc-')) this.onNpcHit(target, level);
  }

  // 모두: hit 연출 적용 (호스트 릴레이 수신 경로 — 호스트 자신도 이 경로를 탄다)
  _receiveHitFx(target, level) {
    this._wounds.set(target, { level, t: WOUND_HEAL_SECONDS });
    const av = this.remoteAvatars.get(target);
    if (av && av.inst && typeof av.inst.hit === 'function') {
      av.inst.hit(level);
    } else if (this.peer && target === this.peer.id) {
      this.onSelfHit(level);
    }
  }

  // NPC 한마디 — 호스트가 자신 화면(onChat)과 게스트 전원에 뿌린다
  sendNpcChat(name, text) {
    if (!this.isHost) return;
    this._broadcast({ type: 'chat', name, text, senderId: null });
    this.onChat(name, text);
  }

  sendChat(text) {
    // 자신의 메시지 표시는 호출 측(main.js)이 담당. onChat은 원격 메시지 전용.
    // senderId로 발신자를 식별해 닉네임이 겹쳐도 에코가 자신에게 돌아오지 않게 한다.
    const msg = { type: 'chat', name: this.nickname, text, senderId: this.peer ? this.peer.id : null };
    if (this.isHost) {
      // 호스트: 게스트 전원에게 릴레이
      this._broadcast(msg);
    } else if (this.hostConn && this.hostConn.open) {
      this.hostConn.send(msg);
    }
  }

  /**
   * 방명록 노트를 전파한다. 게스트는 호스트로 전송, 호스트는 직접 병합 후 전원에게 브로드캐스트.
   * @param {Array<{id:string,name:string,text:string,ts:number}>} notes
   */
  sendGuestbook(notes) {
    if (!Array.isArray(notes) || notes.length === 0) return;
    if (this.isHost) {
      this._guestbookNotes = mergeNotes(this._guestbookNotes, notes);
      this._broadcast({ type: 'gbook', notes: this._guestbookNotes });
      this.onGuestbook(this._guestbookNotes); // 호스트 자신도 수신 개념으로 콜백
    } else if (this.hostConn && this.hostConn.open) {
      this.hostConn.send({ type: 'gbook', notes });
    }
  }

  update(delta) {
    if (this._disposed) return;

    // ---- 상태 송신 (10Hz) ----
    this._sendAccum += delta;
    if (this._sendAccum >= SEND_INTERVAL) {
      this._sendAccum = 0;
      const s = this._lastState;
      if (this.isHost) {
        // 호스트는 자기 상태를 playerInfo에 반영하고 전체 브로드캐스트
        this._broadcastStates(s);
      } else if (this.hostConn && this.hostConn.open) {
        this.hostConn.send({ type: 'state', x: s.x, y: s.y, z: s.z, ry: s.ry });
      }
    }

    // ---- AI 관객(NPC) — 호스트만 시뮬레이션, 사람과 동일 파이프라인으로 표시 ----
    if (this.isHost && this.npcProvider) {
      // 사람 위치(호스트 자신 + 게스트) — NPC 인사/시선용
      const humans = [{ x: this._lastState.x, z: this._lastState.z }];
      for (const info of this.playerInfo.values()) humans.push({ x: info.x || 0, z: info.z || 0 });
      this._npcStates = this.npcProvider(delta, humans) || null;
      if (this._npcStates) {
        for (const id of Object.keys(this._npcStates)) {
          this._updateRemoteAvatar(id, this._npcStates[id]);
        }
      }
    } else if (this._npcStates) {
      // 호스트 지위를 잃으면 자체 NPC를 정리한다 (새 호스트의 states가 대체)
      for (const id of Object.keys(this._npcStates)) this._removeAvatar(id);
      this._npcStates = null;
    }

    // ---- 상처 자연 회복 — 20초마다 한 단계씩 ----
    for (const [id, w] of this._wounds) {
      w.t -= delta;
      if (w.t <= 0) {
        w.level -= 1;
        if (w.level <= 0) {
          this._wounds.delete(id);
        } else {
          w.t = WOUND_HEAL_SECONDS;
        }
        const av = this.remoteAvatars.get(id);
        if (av && av.inst && typeof av.inst.setWound === 'function') {
          av.inst.setWound(Math.max(0, w.level));
        }
      }
    }

    // ---- 원격 아바타 보간 + 애니메이션 ----
    const t = Math.min(1, LERP_RATE * delta);
    const speedSmoothT = Math.min(1, 10 * delta);
    for (const av of this.remoteAvatars.values()) {
      av.group.position.lerp(av.targetPos, t);
      // yaw 최단경로 보간
      let diff = av.targetRy - av.group.rotation.y;
      diff = ((diff + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      av.group.rotation.y += diff * t;

      // 프레임 이동거리/delta → 지수 평활 (10Hz 네트워크 틱의 순간값 튐 방지)
      const rawSpeed = delta > 0 ? av.group.position.distanceTo(av.prevPos) / delta : 0;
      av.smoothedSpeed += (rawSpeed - av.smoothedSpeed) * speedSmoothT;
      av.prevPos.copy(av.group.position);

      av.inst.update(delta, av.smoothedSpeed);
    }
  }

  dispose() {
    this._disposed = true;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch (e) { /* noop */ }
      this.peer = null;
    }
    for (const id of Array.from(this.remoteAvatars.keys())) {
      this._removeAvatar(id);
    }
    this.connections.clear();
    this.playerInfo.clear();
    this.hostConn = null;
  }

  // ---------------------------------------------------------- 호스트 되기 시도

  _tryBecomeHost() {
    if (this._disposed) return;
    this._destroyPeer();

    // window.LU_PEER_OPTS: 테스트 하네스/셀프호스팅용 시그널링 서버 오버라이드 훅.
    // 미지정(undefined)이면 PeerJS 공용 클라우드를 쓴다 — 프로덕션 기본.
    const peer = new Peer(this._hostId, window.LU_PEER_OPTS || undefined);
    this.peer = peer;

    peer.on('open', () => {
      if (this._disposed || this.peer !== peer) return;
      this.isHost = true;
      this.onStatus('호스트로 개설됨');
      this._updateCount();
      peer.on('connection', (conn) => this._onGuestConnected(conn));
    });

    peer.on('error', (err) => {
      if (this._disposed || this.peer !== peer) return;
      if (err.type === 'unavailable-id') {
        // 이미 호스트 존재 → 게스트로 접속
        this._becomeGuest();
      } else if (!this.isHost) {
        // 기타 초기화 오류 → 재시도
        this._scheduleReconnect();
      }
    });

    peer.on('disconnected', () => {
      if (this._disposed || this.peer !== peer) return;
      // 시그널링 서버 끊김 → 재연결 시도
      try { peer.reconnect(); } catch (e) { this._scheduleReconnect(); }
    });
  }

  // -------------------------------------------------------------- 호스트 로직

  _onGuestConnected(conn) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      this._updateCount();
    });

    conn.on('data', (data) => {
      if (!data || typeof data !== 'object') return;

      if (data.type === 'hello') {
        this.playerInfo.set(conn.peer, {
          nickname: String(data.nickname || '게스트'),
          color: String(data.color || '#3498db'),
          char: String(data.char || 'knight'), // 하위호환: char 없는 구버전 게스트도 'knight'
          x: 0, y: EYE_HEIGHT, z: 0, ry: 0,
        });
        this._updateCount();
      } else if (data.type === 'state') {
        const info = this.playerInfo.get(conn.peer);
        if (info) {
          info.x = data.x; info.y = data.y; info.z = data.z; info.ry = data.ry;
          this._updateRemoteAvatar(conn.peer, info);
        }
      } else if (data.type === 'photo') {
        if (isValidPhotoItem(data.item)) {
          this._broadcast({ type: 'photo', item: data.item, senderId: conn.peer }, conn.peer);
          this.onPhoto(data.item); // 호스트 자신도 수신
        }
      } else if (data.type === 'hit') {
        // 게스트의 타격 요청 — 검증 후 전원 릴레이 (sx/sz는 요청자 위치)
        this._applyHit({ target: data.target, sx: data.sx, sz: data.sz });
      } else if (data.type === 'chat') {
        const msg = {
          type: 'chat',
          name: String(data.name || '게스트'),
          text: String(data.text || ''),
          senderId: conn.peer, // 릴레이 시 발신자 id 보존 — 수신 측 자기 에코 필터용
        };
        this._broadcast(msg, conn.peer); // 발신자 제외 릴레이 (발신자는 자기 화면에 이미 표시함)
        this.onChat(msg.name, msg.text); // 호스트 자신도 표시
      } else if (data.type === 'gbook') {
        const incoming = Array.isArray(data.notes) ? data.notes : [];
        this._guestbookNotes = mergeNotes(this._guestbookNotes, incoming);
        this._broadcast({ type: 'gbook', notes: this._guestbookNotes });
        this.onGuestbook(this._guestbookNotes); // 호스트 자신도 수신 개념으로 콜백
      }
    });

    const cleanup = () => {
      this.connections.delete(conn.peer);
      this.playerInfo.delete(conn.peer);
      this._removeAvatar(conn.peer);
      this._updateCount();
    };
    conn.on('close', cleanup);
    conn.on('error', cleanup);
  }

  _broadcast(msg, exceptPeerId) {
    for (const conn of this.connections.values()) {
      if (exceptPeerId && conn.peer === exceptPeerId) continue;
      if (conn.open) {
        try { conn.send(msg); } catch (e) { /* noop */ }
      }
    }
  }

  _broadcastStates(selfState) {
    const players = {};
    // 호스트 자신
    players[this.peer ? this.peer.id : 'host'] = {
      nickname: this.nickname,
      color: this.color,
      char: this.char,
      x: selfState.x, y: selfState.y, z: selfState.z, ry: selfState.ry,
    };
    // 게스트들
    for (const [id, info] of this.playerInfo) {
      players[id] = {
        nickname: info.nickname, color: info.color, char: info.char,
        x: info.x, y: info.y, z: info.z, ry: info.ry,
      };
    }
    if (this._npcStates) {
      for (const [id, info] of Object.entries(this._npcStates)) players[id] = info;
    }
    this._broadcast({ type: 'states', players });
  }

  // -------------------------------------------------------------- 게스트 로직

  _becomeGuest() {
    if (this._disposed) return;
    this._destroyPeer();
    this.isHost = false;
    this.onStatus('서버 연결 중...');

    const peer = new Peer(undefined, window.LU_PEER_OPTS || undefined); // 랜덤 id
    this.peer = peer;

    peer.on('open', () => {
      if (this._disposed || this.peer !== peer) return;
      const conn = peer.connect(this._hostId, { reliable: true });
      this.hostConn = conn;

      let opened = false;

      conn.on('open', () => {
        if (this._disposed) return;
        opened = true;
        this.onStatus('접속됨 (게스트)');
        conn.send({ type: 'hello', nickname: this.nickname, color: this.color, char: this.char });
      });

      conn.on('data', (data) => this._onGuestData(data, peer.id));

      const onLost = () => {
        if (this._disposed || this.peer !== peer) return;
        this.hostConn = null;
        this._clearAllAvatars();
        this._scheduleReconnect();
      };
      conn.on('close', onLost);
      conn.on('error', onLost);

      // 호스트 부재 등으로 일정 시간 내 연결 실패 시 재시도
      setTimeout(() => {
        if (!opened && !this._disposed && this.peer === peer) {
          this._scheduleReconnect();
        }
      }, 8000);
    });

    peer.on('error', (err) => {
      if (this._disposed || this.peer !== peer) return;
      if (err.type === 'peer-unavailable') {
        // 호스트가 사라짐 → 재접속 루프 (호스트 승격 시도 포함)
        this._scheduleReconnect();
      }
    });

    peer.on('disconnected', () => {
      if (this._disposed || this.peer !== peer) return;
      try { peer.reconnect(); } catch (e) { this._scheduleReconnect(); }
    });
  }

  _onGuestData(data, selfId) {
    if (!data || typeof data !== 'object') return;

    if (data.type === 'states') {
      const players = data.players || {};
      const ids = new Set(Object.keys(players));
      ids.delete(selfId); // 자기 자신 제외

      // 갱신/생성
      for (const id of ids) {
        this._updateRemoteAvatar(id, players[id]);
      }
      // 사라진 플레이어 제거
      for (const id of Array.from(this.remoteAvatars.keys())) {
        if (!ids.has(id)) this._removeAvatar(id);
      }
      this.onPlayerCount(Object.values(players).filter((p) => p && !p.npc).length);
    } else if (data.type === 'photo') {
      if (data.senderId !== selfId && isValidPhotoItem(data.item)) this.onPhoto(data.item);
    } else if (data.type === 'hitfx') {
      this._receiveHitFx(String(data.target || ''), Math.max(1, Math.min(3, data.level | 0)));
    } else if (data.type === 'chat') {
      if (data.senderId && data.senderId === selfId) return; // 자기 메시지 에코 무시
      this.onChat(String(data.name || '게스트'), String(data.text || ''));
    } else if (data.type === 'gbook') {
      this.onGuestbook(Array.isArray(data.notes) ? data.notes : []);
    }
  }

  // ------------------------------------------------------------ 재접속 루프

  _scheduleReconnect() {
    if (this._disposed || this._reconnectTimer) return;
    this.onStatus('재접속 중...');
    const delay = 3000 + Math.random() * 3000; // 3~6초 랜덤
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      if (this._disposed) return;
      // 호스트 id 재획득 시도 → unavailable-id면 자동으로 게스트로 전환
      this._tryBecomeHost();
    }, delay);
  }

  _destroyPeer() {
    if (this.peer) {
      try { this.peer.destroy(); } catch (e) { /* noop */ }
      this.peer = null;
    }
    this.hostConn = null;
    this.isHost = false;
    this.connections.clear();
    this.playerInfo.clear();
  }

  // ---------------------------------------------------------- 아바타 관리

  _updateRemoteAvatar(id, info) {
    if (!info) return;
    let av = this.remoteAvatars.get(id);

    if (!av) {
      // 하위호환: 원격 정보에 char가 없으면(구버전 접속자) 'knight'로 폴백
      const inst = createAvatarInstance(info.char || 'knight', info.color || '#3498db', info.nickname || '게스트');
      const group = inst.group;
      const y = (info.y != null ? info.y : EYE_HEIGHT) - EYE_HEIGHT;
      group.position.set(info.x || 0, y, info.z || 0);
      group.rotation.y = info.ry || 0;
      this.scene.add(group);
      av = {
        inst,
        group,
        targetPos: group.position.clone(),
        targetRy: group.rotation.y,
        prevPos: group.position.clone(),
        smoothedSpeed: 0,
      };
      this.remoteAvatars.set(id, av);
      if (this.isHost) this._updateCount();
      if (!info.npc && !id.startsWith('npc-')) this.onVisitor(id, info);
    }

    av.targetPos.set(
      info.x || 0,
      (info.y != null ? info.y : EYE_HEIGHT) - EYE_HEIGHT, // 눈높이 → 발 기준 보정
      info.z || 0
    );
    av.targetRy = info.ry || 0;
  }

  _removeAvatar(id) {
    const av = this.remoteAvatars.get(id);
    if (!av) return;
    this.scene.remove(av.group);
    av.inst.dispose();
    this.remoteAvatars.delete(id);
  }

  _clearAllAvatars() {
    for (const id of Array.from(this.remoteAvatars.keys())) {
      this._removeAvatar(id);
    }
  }

  _updateCount() {
    // 호스트: 자신 + 연결된 게스트 수
    if (this.isHost) {
      this.onPlayerCount(1 + this.playerInfo.size);
    }
  }
}
