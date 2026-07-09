// multiplayer.js — PeerJS 호스트-릴레이 멀티플레이어
// 전역 Peer (index.html의 script 태그로 로드됨) 사용. import 금지.

import * as THREE from 'three';
import { PEER_ROOM_ID, EYE_HEIGHT } from './config.js';
import { createAvatarInstance } from './avatar.js';
import { mergeNotes } from './guestbook.js';

const HOST_ID = PEER_ROOM_ID + '-host';
const SEND_INTERVAL = 1 / 10; // 10Hz
const LERP_RATE = 10;

export class MultiplayerManager {
  /**
   * @param {THREE.Scene} scene
   * @param {{nickname: string, color: string, char?: string}} opts
   */
  constructor(scene, { nickname, color, char }) {
    this.scene = scene;
    this.nickname = nickname;
    this.color = color;
    this.char = char || 'knight'; // 하위호환: 구버전(char 미전송) 원격도 'knight'로 폴백

    // 콜백 프로퍼티 (외부에서 할당)
    this.onChat = (name, text) => {};
    this.onPlayerCount = (n) => {};
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

    const peer = new Peer(HOST_ID);
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
    this._broadcast({ type: 'states', players });
  }

  // -------------------------------------------------------------- 게스트 로직

  _becomeGuest() {
    if (this._disposed) return;
    this._destroyPeer();
    this.isHost = false;
    this.onStatus('서버 연결 중...');

    const peer = new Peer(); // 랜덤 id
    this.peer = peer;

    peer.on('open', () => {
      if (this._disposed || this.peer !== peer) return;
      const conn = peer.connect(HOST_ID, { reliable: true });
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
      this.onPlayerCount(Object.keys(players).length);
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
