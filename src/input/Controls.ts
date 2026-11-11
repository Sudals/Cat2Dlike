/**
 * 액션 기반 입력 레이어. 게임 로직은 키가 아닌 액션만 본다 → 리바인딩/패드 지원이 한곳에서 끝남.
 * 키 배치는 bindings.ts (키 설정 화면에서 변경, 저장됨). 기본: WASD 이동 + Space 점프 + 좌클릭 공격 +
 * Shift/우클릭 대시 + Q E R 스킬 + F 궁극기. 이동키를 빠르게 두 번 눌러도 대시, W 누른 채 공격 = 위 공격
 */
import type Phaser from 'phaser';
import { ACTIONS, bindings, type Action } from './bindings';
import { raw } from './RawInput';

export type { Action } from './bindings';

const DOUBLE_TAP = 0.26; // 초

export class Controls {
  private down = new Set<Action>();
  private prev = new Set<Action>();
  /** 바인딩별 마지막으로 본 누름 횟수 — 프레임 사이에 눌렀다 뗀 짧은 클릭도 1프레임 눌림으로 친다 */
  private seen = new Map<string, number>();
  private lastTap: Record<'left' | 'right', number> = { left: -1, right: -1 };
  private fresh = true;
  /** 자동 플레이(스모크 테스트) 등 외부에서 주입하는 가상 입력 */
  readonly virtual = new Set<Action>();
  axisX = 0;
  /** 이번 프레임에 이동키를 두 번 눌렀으면 그 방향(-1/1), 아니면 0 → 대시 */
  dashTap = 0;

  constructor(private scene: Phaser.Scene) {}

  /** 매 프레임 씬 update 시작 시 1회 호출 */
  update(): void {
    [this.prev, this.down] = [this.down, this.prev];
    this.down.clear();
    const map = bindings();
    for (const a of ACTIONS) {
      for (const b of map[a]) {
        if (!b) continue;
        const n = raw.pressCount(b);
        const last = this.seen.get(b);
        if (raw.isHeld(b) || (last !== undefined && n !== last)) this.down.add(a);
        this.seen.set(b, n);
      }
      if (this.virtual.has(a)) this.down.add(a);
    }

    const pad = this.scene.input.gamepad?.pad1;
    let stickX = 0;
    if (pad) {
      stickX = Math.abs(pad.leftStick.x) > 0.3 ? pad.leftStick.x : 0;
      if (pad.left) this.down.add('left');
      if (pad.right) this.down.add('right');
      if (pad.up) this.down.add('up');
      if (pad.down) this.down.add('down');
      if (pad.A) this.down.add('jump');
      if (pad.X) this.down.add('attack');
      if (pad.B) this.down.add('dash');
      if (pad.L1 > 0.5) this.down.add('skill1');
      if (pad.R1 > 0.5) this.down.add('skill2');
      if (pad.R2 > 0.5) this.down.add('skill3');
      if (pad.L2 > 0.5) this.down.add('ult');
    }

    // 씬 시작 순간 이미 눌려 있던 키(타이틀에서 누른 Space 등)는 '새로 누름'으로 치지 않는다
    if (this.fresh) {
      this.prev = new Set(this.down);
      this.fresh = false;
    }

    const digital = (this.down.has('right') ? 1 : 0) - (this.down.has('left') ? 1 : 0);
    this.axisX = digital !== 0 ? digital : stickX;

    // 같은 이동키 두 번 = 대시
    const now = performance.now() / 1000;
    this.dashTap = 0;
    for (const d of ['left', 'right'] as const) {
      if (!this.pressed(d)) continue;
      if (now - this.lastTap[d] < DOUBLE_TAP) {
        this.dashTap = d === 'left' ? -1 : 1;
        this.lastTap[d] = -1; // 세 번째 누름이 또 대시가 되지 않게
      } else {
        this.lastTap[d] = now;
      }
    }
  }

  /** 일시정지 해제 등: 지금 눌려 있는 키, 멈춘 동안 누른 키를 '새로 누름'으로 치지 않게 한다 */
  reset(): void {
    this.fresh = true;
    this.seen.clear();
  }

  isDown(a: Action): boolean {
    return this.down.has(a);
  }

  pressed(a: Action): boolean {
    return this.down.has(a) && !this.prev.has(a);
  }
}
