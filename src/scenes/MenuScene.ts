/**
 * 메뉴 씬 — 게임(또는 타이틀) 위에 겹쳐 뜬다.
 *  - 일시정지 (게임 중 Esc): 계속하기 / 키 설정 / 처음부터 다시 / 게임 종료(exe)
 *  - 키 설정: 동작마다 키 2칸. 칸을 골라 Enter·클릭 → 쓸 키나 마우스 버튼을 누르면 지정.
 *    다른 동작이 쓰던 키면 서로 맞바꾼다. 바꾼 즉시 저장 (웹: localStorage, exe: 세이브 폴더)
 * 키보드 입력은 RawInput 으로 받아 메뉴가 열린 동안 전부 가져간다 (아래 씬으로 새지 않게).
 * 모든 동작은 다음 update 로 미뤄 실행한다 — 같은 클릭/키가 막 재개된 아래 씬에 다시 전달되는 것을 막기 위해.
 */
import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../config/game';
import { IS_ELECTRON } from '../config/build';
import { FONT } from '../art/fonts';
import { ACTIONS, ACTION_LABEL, ESSENTIAL, assign, bindings, keyLabel, reservedReason, resetBindings, type Action } from '../input/bindings';
import { raw } from '../input/RawInput';

export interface MenuData {
  from: 'sandbox' | 'title';
  panel?: 'pause' | 'keys';
}

type Panel = 'pause' | 'keys';
type Txt = Phaser.GameObjects.Text;

const NAV_UP = new Set(['ArrowUp', 'KeyW']);
const NAV_DOWN = new Set(['ArrowDown', 'KeyS']);
const NAV_LEFT = new Set(['ArrowLeft', 'KeyA']);
const NAV_RIGHT = new Set(['ArrowRight', 'KeyD']);
const NAV_OK = new Set(['Enter', 'NumpadEnter', 'Space']);
const NAV_CLEAR = new Set(['Delete', 'Backspace']);

const C = {
  panel: 0x140c1c,
  border: 0x4a4060,
  cell: 0x241a36,
  cellSel: 0x3a2a4a,
  gold: 0xffd08a,
  listen: 0x5a2a2a,
};
const small = (color = '#e8e0ff') => ({ fontFamily: FONT.small, fontSize: '9px', color, stroke: '#140c1c', strokeThickness: 3 });
const body = (color = '#ffffff', bold = false) => ({
  fontFamily: FONT.body,
  fontSize: '11px',
  fontStyle: bold ? 'bold' : 'normal',
  color,
  stroke: '#140c1c',
  strokeThickness: 3,
});

interface Cell {
  a: Action;
  slot: 0 | 1;
  bg: Phaser.GameObjects.Graphics;
  text: Txt;
  x: number;
  y: number;
}

const ROWS = ACTIONS.length; // 행 ROWS 는 아래 버튼 줄
const CELL_W = 104;
const CELL_H = 15;

export class MenuScene extends Phaser.Scene {
  private from: 'sandbox' | 'title' = 'sandbox';
  private panel: Panel = 'pause';
  private objs: Phaser.GameObjects.GameObject[] = [];
  private queue: (() => void)[] = [];

  // 일시정지
  private items: { text: Txt; label: string; run: () => void }[] = [];
  private sel = 0;
  private confirmRestart = false;

  // 키 설정
  private cells: Cell[] = [];
  private rowLabels: Txt[] = [];
  private buttons: { bg: Phaser.GameObjects.Graphics; text: Txt; x: number; y: number; run: () => void }[] = [];
  private row = 0;
  private col = 0;
  private listening = false;
  private listenAt = 0;
  private assignedAt = 0;
  private notice?: Txt;
  private footer?: Txt;
  private noticeTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super('menu');
  }

  init(d?: MenuData): void {
    this.from = d?.from ?? 'sandbox';
    this.panel = d?.panel ?? 'pause';
    this.queue = [];
    this.objs = [];
    this.sel = 0;
    this.row = 0;
    this.col = 0;
    this.listening = false;
    this.confirmRestart = false;
  }

  create(): void {
    this.scene.bringToTop();
    // 아래 씬 클릭 차단 + 어둡게
    this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x05030a, 0.78).setOrigin(0).setInteractive();
    const off = raw.onPress((b) => {
      this.queue.push(() => this.onKey(b));
      return true; // 메뉴가 열려 있는 동안 입력은 메뉴가 전부 가져간다
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    this.show(this.panel);
  }

  update(time: number): void {
    for (const fn of this.queue.splice(0)) fn();
    if (this.panel === 'keys' && this.listening) {
      const c = this.cells[this.row * 2 + this.col];
      c?.text.setAlpha(Math.floor(time / 260) % 2 ? 1 : 0.35);
    }
  }

  // ---------------------------------------------------------------------------
  // 공통
  // ---------------------------------------------------------------------------
  private keep<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.objs.push(o);
    return o;
  }

  private show(panel: Panel): void {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    this.items = [];
    this.cells = [];
    this.rowLabels = [];
    this.buttons = [];
    this.notice = undefined;
    this.footer = undefined;
    this.noticeTimer?.remove();
    this.listening = false;
    this.panel = panel;
    if (panel === 'pause') this.buildPause();
    else this.buildKeys();
  }

  private close(): void {
    this.scene.resume(this.from === 'title' ? 'title' : 'sandbox');
    this.scene.stop();
  }

  private onKey(b: string): void {
    if (this.panel === 'pause') this.onPauseKey(b);
    else this.onKeysKey(b);
  }

  // ---------------------------------------------------------------------------
  // 일시정지
  // ---------------------------------------------------------------------------
  private buildPause(): void {
    const k = this.keep.bind(this);
    const x0 = VIEW_W / 2 - 120;
    const y0 = 66;
    const h = IS_ELECTRON ? 222 : 196;
    k(this.add.graphics())
      .fillStyle(C.panel, 0.96)
      .fillRoundedRect(x0, y0, 240, h, 10)
      .lineStyle(2, C.border, 1)
      .strokeRoundedRect(x0, y0, 240, h, 10);
    k(
      this.add
        .text(VIEW_W / 2, y0 + 30, '일시정지', { fontFamily: FONT.body, fontSize: '22px', fontStyle: 'bold', color: '#ffd08a', stroke: '#140c1c', strokeThickness: 5 })
        .setOrigin(0.5),
    );
    const list: [string, () => void][] = [
      ['계속하기', () => this.close()],
      ['키 설정', () => this.show('keys')],
      ['처음부터 다시', () => this.restartRun()],
    ];
    if (IS_ELECTRON) list.push(['게임 종료', () => void window.native?.quit()]);
    list.forEach(([label, run], i) => {
      const text = k(this.add.text(VIEW_W / 2, y0 + 72 + i * 26, label, body('#e8e0ff', true)).setOrigin(0.5));
      text.setInteractive({ useHandCursor: true });
      text.on('pointerover', () => {
        this.sel = i;
        this.drawPause();
      });
      text.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (p.button === 0) this.queue.push(run);
      });
      this.items.push({ text, label, run });
    });
    k(this.add.text(VIEW_W / 2, y0 + h - 16, 'W·S / ↑↓ 선택 · Enter·클릭 확인 · Esc 계속하기', small('#a8a0c0')).setOrigin(0.5));
    this.drawPause();
  }

  private drawPause(): void {
    this.items.forEach((it, i) => {
      const on = i === this.sel;
      let label = it.label;
      if (it.label === '처음부터 다시' && this.confirmRestart) label = '정말 처음부터? (한 번 더)';
      it.text.setText(on ? `▶ ${label} ◀` : label).setColor(on ? (this.confirmRestart && i === 2 ? '#ff8a7a' : '#ffd08a') : '#e8e0ff');
    });
  }

  private onPauseKey(b: string): void {
    if (b === 'Escape') return this.close();
    const n = this.items.length;
    if (NAV_UP.has(b)) this.sel = (this.sel - 1 + n) % n;
    else if (NAV_DOWN.has(b)) this.sel = (this.sel + 1) % n;
    else if (NAV_OK.has(b)) return this.items[this.sel]?.run();
    else return;
    if (this.sel !== 2) this.confirmRestart = false;
    this.drawPause();
  }

  /** 목숨이 하나인 게임이라 한 번 더 확인 */
  private restartRun(): void {
    if (!this.confirmRestart) {
      this.confirmRestart = true;
      this.sel = 2;
      this.drawPause();
      return;
    }
    const sandbox = this.scene.get('sandbox');
    this.scene.stop();
    sandbox.scene.restart();
  }

  // ---------------------------------------------------------------------------
  // 키 설정
  // ---------------------------------------------------------------------------
  private buildKeys(): void {
    const k = this.keep.bind(this);
    k(this.add.graphics())
      .fillStyle(C.panel, 0.97)
      .fillRoundedRect(110, 6, 420, 348, 10)
      .lineStyle(2, C.border, 1)
      .strokeRoundedRect(110, 6, 420, 348, 10);
    k(
      this.add
        .text(VIEW_W / 2, 26, '키 설정', { fontFamily: FONT.body, fontSize: '22px', fontStyle: 'bold', color: '#ffd08a', stroke: '#140c1c', strokeThickness: 5 })
        .setOrigin(0.5),
    );
    k(this.add.text(VIEW_W / 2, 49, '칸을 골라 Enter·클릭 → 쓸 키나 마우스 버튼을 누르세요', small()).setOrigin(0.5));
    k(this.add.text(136, 64, '동작', small('#a8a0c0')));
    k(this.add.text(352, 64, '키 1', small('#a8a0c0')).setOrigin(0.5, 0));
    k(this.add.text(466, 64, '키 2', small('#a8a0c0')).setOrigin(0.5, 0));

    ACTIONS.forEach((a, r) => {
      const y = 86 + r * 18;
      this.rowLabels.push(k(this.add.text(136, y, ACTION_LABEL[a], body('#e8e0ff')).setOrigin(0, 0.5)));
      ([0, 1] as const).forEach((slot) => {
        const x = slot === 0 ? 352 : 466;
        const bg = k(this.add.graphics());
        const text = k(this.add.text(x, y, '', body()).setOrigin(0.5));
        const zone = k(this.add.zone(x, y, CELL_W, CELL_H + 2).setInteractive({ useHandCursor: true }));
        zone.on('pointerover', () => {
          if (this.listening) return;
          this.row = r;
          this.col = slot;
          this.drawKeys();
        });
        zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
          if (p.button !== 0) return;
          this.queue.push(() => {
            // 듣는 중의 클릭은 RawInput 쪽에서 '좌클릭 지정'으로 처리된다
            if (this.listening || performance.now() - this.assignedAt < 200) return;
            this.row = r;
            this.col = slot;
            this.listen();
          });
        });
        this.cells.push({ a, slot, bg, text, x, y });
      });
    });

    this.notice = k(this.add.text(VIEW_W / 2, 290, '', small('#ffd08a')).setOrigin(0.5));
    const btns: [string, number, () => void][] = [
      ['기본값으로', 262, () => this.resetAll()],
      ['완료', 378, () => this.closeKeys()],
    ];
    btns.forEach(([label, x, run], i) => {
      const y = 312;
      const bg = k(this.add.graphics());
      const text = k(this.add.text(x, y, label, body('#ffffff', true)).setOrigin(0.5));
      const zone = k(this.add.zone(x, y, 100, 20).setInteractive({ useHandCursor: true }));
      zone.on('pointerover', () => {
        if (this.listening) return;
        this.row = ROWS;
        this.col = i;
        this.drawKeys();
      });
      zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (p.button !== 0) return;
        this.queue.push(() => {
          if (!this.listening) run();
        });
      });
      this.buttons.push({ bg, text, x, y, run });
    });
    this.footer = k(this.add.text(VIEW_W / 2, 338, '', small('#a8a0c0')).setOrigin(0.5));
    this.drawKeys();
  }

  private drawKeys(): void {
    const map = bindings();
    ACTIONS.forEach((a, r) => {
      const empty = !map[a][0] && !map[a][1];
      this.rowLabels[r].setColor(empty && ESSENTIAL.has(a) ? '#ff8a7a' : '#e8e0ff');
    });
    this.cells.forEach((c, i) => {
      const on = this.row < ROWS && i === this.row * 2 + this.col;
      const listening = on && this.listening;
      const b = map[c.a][c.slot];
      c.bg
        .clear()
        .fillStyle(listening ? C.listen : on ? C.cellSel : C.cell, 1)
        .fillRoundedRect(c.x - CELL_W / 2, c.y - CELL_H / 2, CELL_W, CELL_H, 4)
        .lineStyle(on ? 2 : 1, listening ? 0xffffff : on ? C.gold : C.border, 1)
        .strokeRoundedRect(c.x - CELL_W / 2, c.y - CELL_H / 2, CELL_W, CELL_H, 4);
      c.text.setAlpha(1);
      if (listening) c.text.setText('키를 누르세요').setColor('#ffffff');
      else if (b) c.text.setText(keyLabel(b)).setColor(on ? '#ffd08a' : '#ffffff');
      else c.text.setText('—').setColor('#6a6080');
    });
    this.buttons.forEach((bt, i) => {
      const on = this.row === ROWS && i === this.col;
      bt.bg
        .clear()
        .fillStyle(on ? C.cellSel : C.cell, 1)
        .fillRoundedRect(bt.x - 50, bt.y - 10, 100, 20, 5)
        .lineStyle(on ? 2 : 1, on ? C.gold : C.border, 1)
        .strokeRoundedRect(bt.x - 50, bt.y - 10, 100, 20, 5);
      bt.text.setColor(on ? '#ffd08a' : '#ffffff');
    });
    this.footer?.setText(
      this.listening
        ? '바꿀 키나 마우스 버튼을 누르세요 (좌클릭도 지정됨) · Esc 취소 · Del 지우기'
        : '방향키·WASD 이동 · Enter 변경 · Del 지우기 · Esc ' + (this.from === 'title' ? '닫기' : '돌아가기'),
    );
  }

  private say(text: string, color = '#ffd08a'): void {
    this.notice?.setText(text).setColor(color).setAlpha(1);
    this.noticeTimer?.remove();
    this.noticeTimer = this.time.delayedCall(2600, () => this.notice?.setAlpha(0));
  }

  private listen(): void {
    this.listening = true;
    this.listenAt = performance.now();
    this.drawKeys();
  }

  private onKeysKey(b: string): void {
    const cell = this.row < ROWS ? this.cells[this.row * 2 + this.col] : undefined;
    if (this.listening && cell) {
      if (performance.now() - this.listenAt < 150) return; // 칸을 연 그 클릭/키 자체는 무시
      this.listening = false;
      if (b === 'Escape') return this.drawKeys();
      if (NAV_CLEAR.has(b)) return this.clearCell(cell);
      const why = reservedReason(b);
      if (why) {
        this.listening = true;
        this.say(why, '#ff8a7a');
        return;
      }
      const r = assign(cell.a, cell.slot, b);
      this.assignedAt = performance.now();
      if (r.swapped) this.say(`${ACTION_LABEL[cell.a]} ← ${keyLabel(b)}  ·  「${ACTION_LABEL[r.swapped]}」와 맞바꿨어요`);
      else if (r.cleared) this.say(`${ACTION_LABEL[cell.a]} ← ${keyLabel(b)}  ·  「${ACTION_LABEL[r.cleared]}」에서 옮겨 왔어요`, '#ffb88a');
      else this.say(`${ACTION_LABEL[cell.a]} ← ${keyLabel(b)}`);
      this.drawKeys();
      return;
    }
    if (b.startsWith('Mouse')) return; // 클릭은 Phaser 포인터 이벤트로 처리
    if (b === 'Escape') return this.closeKeys();
    if (NAV_UP.has(b)) this.row = (this.row - 1 + ROWS + 1) % (ROWS + 1);
    else if (NAV_DOWN.has(b)) this.row = (this.row + 1) % (ROWS + 1);
    else if (NAV_LEFT.has(b) || NAV_RIGHT.has(b)) this.col = 1 - this.col;
    else if (NAV_OK.has(b)) {
      if (cell) this.listen();
      else this.buttons[this.col]?.run();
      return;
    } else if (NAV_CLEAR.has(b) && cell) return this.clearCell(cell);
    else return;
    this.drawKeys();
  }

  private clearCell(cell: Cell): void {
    if (bindings()[cell.a][cell.slot]) {
      assign(cell.a, cell.slot, null);
      this.say(`${ACTION_LABEL[cell.a]} 키 ${cell.slot + 1} 을 비웠어요`, '#ffb88a');
    }
    this.drawKeys();
  }

  private resetAll(): void {
    resetBindings();
    this.say('기본 배치(WASD + 마우스)로 되돌렸어요');
    this.drawKeys();
  }

  private closeKeys(): void {
    const missing = ACTIONS.filter((a) => ESSENTIAL.has(a) && !bindings()[a][0] && !bindings()[a][1]);
    if (missing.length) {
      this.say(`「${missing.map((a) => ACTION_LABEL[a]).join('」「')}」에 키가 없어요`, '#ff8a7a');
      return;
    }
    if (this.from === 'title') this.close();
    else this.show('pause');
  }
}
