/**
 * 키 바인딩 — 동작(Action)마다 키 2칸. 키는 KeyboardEvent.code(물리 키 위치) 기준이라
 * 한/영 입력 상태와 상관없이 같은 자리 키로 동작한다. 마우스 버튼은 'Mouse0'(왼쪽)·'Mouse2'(오른쪽)…
 *
 * 기본 배치 (WASD + 마우스):
 *   A D 이동 · W 위(위 공격) · S 아래(발판 내려가기) · Space 점프
 *   좌클릭 공격 · Shift / 우클릭 / 이동키 두 번 대시 · Q E R 스킬 · F 궁극기 · Esc 메뉴
 */
import { saveStore } from '../platform/storage';

export type Action = 'left' | 'right' | 'up' | 'down' | 'jump' | 'attack' | 'dash' | 'skill1' | 'skill2' | 'skill3' | 'ult';
export type Binding = string;
export type BindingMap = Record<Action, [Binding | null, Binding | null]>;

export const ACTIONS: readonly Action[] = ['left', 'right', 'up', 'down', 'jump', 'attack', 'dash', 'skill1', 'skill2', 'skill3', 'ult'];

export const ACTION_LABEL: Record<Action, string> = {
  left: '왼쪽 이동',
  right: '오른쪽 이동',
  up: '위 (위 공격)',
  down: '아래 (발판 내려가기)',
  jump: '점프',
  attack: '기본 공격',
  dash: '대시',
  skill1: '스킬 1',
  skill2: '스킬 2',
  skill3: '스킬 3',
  ult: '궁극기',
};

/** 비어 있으면 게임 진행이 막히는 동작 */
export const ESSENTIAL: ReadonlySet<Action> = new Set<Action>(['left', 'right', 'jump', 'attack']);

export const DEFAULT_BINDINGS: BindingMap = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  jump: ['Space', null],
  attack: ['Mouse0', null],
  dash: ['Shift', 'Mouse2'],
  skill1: ['KeyQ', null],
  skill2: ['KeyE', null],
  skill3: ['KeyR', null],
  ult: ['KeyF', null],
};

/** 바인딩할 수 없는 키: 메뉴, 브라우저/창 기능, 윈도우 키, 한/영·한자, 직업 변경(1·2) */
const RESERVED: Record<string, string> = {
  Escape: 'Esc 는 메뉴 키예요',
  F5: 'F5 는 새로고침 키예요',
  F11: 'F11 은 전체화면 키예요',
  F12: 'F12 는 개발자 도구 키예요',
  MetaLeft: '윈도우 키는 쓸 수 없어요',
  MetaRight: '윈도우 키는 쓸 수 없어요',
  ContextMenu: '메뉴 키는 쓸 수 없어요',
  Lang1: '한/영 키는 쓸 수 없어요',
  Lang2: '한자 키는 쓸 수 없어요',
  Digit1: '1·2 는 직업 변경 키예요',
  Digit2: '1·2 는 직업 변경 키예요',
};

export function reservedReason(b: Binding): string | null {
  return RESERVED[b] ?? null;
}

const clone = (m: BindingMap): BindingMap => Object.fromEntries(ACTIONS.map((a) => [a, [...m[a]]])) as BindingMap;

let current: BindingMap = clone(DEFAULT_BINDINGS);
let rev = 0;

export const bindings = (): Readonly<BindingMap> => current;
/** 바인딩이 바뀔 때마다 증가 — HUD 가 단축키 표시를 다시 그릴지 판단 */
export const bindingsRev = (): number => rev;

export function actionOf(b: Binding): Action | null {
  for (const a of ACTIONS) if (current[a].includes(b)) return a;
  return null;
}

/** (a, slot) 에 b 를 지정. 다른 칸에 이미 있던 키면 그 칸과 맞바꾼다. 맞바꾼 동작을 돌려줌 */
export function assign(a: Action, slot: 0 | 1, b: Binding | null): { swapped?: Action; cleared?: Action } {
  const old = current[a][slot];
  let result: { swapped?: Action; cleared?: Action } = {};
  if (b) {
    for (const x of ACTIONS) {
      for (const j of [0, 1] as const) {
        if ((x !== a || j !== slot) && current[x][j] === b) {
          current[x][j] = old;
          result = old ? { swapped: x } : { cleared: x };
        }
      }
    }
  }
  current[a][slot] = b;
  rev++;
  void saveBindings();
  return result;
}

export function resetBindings(): void {
  current = clone(DEFAULT_BINDINGS);
  rev++;
  void saveBindings();
}

const SLOT = 'keys';
const VERSION = 1;

export async function loadBindings(): Promise<void> {
  try {
    const saved = await saveStore.read<{ v: number; map: Partial<Record<Action, unknown>> }>(SLOT);
    if (!saved || saved.v !== VERSION || !saved.map) return;
    const next = clone(DEFAULT_BINDINGS);
    const used = new Set<string>();
    for (const a of ACTIONS) {
      const v = saved.map[a];
      if (!Array.isArray(v)) continue;
      next[a] = [0, 1].map((i) => {
        const b = v[i];
        if (typeof b !== 'string' || !b || used.has(b) || reservedReason(b)) return null;
        used.add(b);
        return b;
      }) as [Binding | null, Binding | null];
    }
    current = next;
    rev++;
  } catch (err) {
    console.warn('key bindings load failed', err); // 깨진 설정이면 기본값으로
  }
}

async function saveBindings(): Promise<void> {
  try {
    await saveStore.write(SLOT, { v: VERSION, map: current });
  } catch (err) {
    console.warn('key bindings save failed', err);
  }
}

// ---------------------------------------------------------------------------
// 표시용 이름
// ---------------------------------------------------------------------------
const NAMES: Record<string, [long: string, short: string]> = {
  Mouse0: ['좌클릭', '좌클'],
  Mouse1: ['휠 클릭', '휠'],
  Mouse2: ['우클릭', '우클'],
  Mouse3: ['마우스 4', 'M4'],
  Mouse4: ['마우스 5', 'M5'],
  Space: ['Space', 'Spc'],
  Shift: ['Shift', 'Sft'],
  ControlLeft: ['Ctrl', 'Ctrl'],
  ControlRight: ['오른쪽 Ctrl', 'RCtl'],
  AltLeft: ['Alt', 'Alt'],
  AltRight: ['오른쪽 Alt', 'RAlt'],
  Enter: ['Enter', 'Ent'],
  NumpadEnter: ['Num Enter', 'NEnt'],
  Tab: ['Tab', 'Tab'],
  CapsLock: ['Caps Lock', 'Caps'],
  Backspace: ['Backspace', 'BkSp'],
  Delete: ['Delete', 'Del'],
  Insert: ['Insert', 'Ins'],
  Home: ['Home', 'Home'],
  End: ['End', 'End'],
  PageUp: ['Page Up', 'PgUp'],
  PageDown: ['Page Down', 'PgDn'],
  ArrowLeft: ['←', '←'],
  ArrowRight: ['→', '→'],
  ArrowUp: ['↑', '↑'],
  ArrowDown: ['↓', '↓'],
  Backquote: ['`', '`'],
  Minus: ['-', '-'],
  Equal: ['=', '='],
  BracketLeft: ['[', '['],
  BracketRight: [']', ']'],
  Backslash: ['\\', '\\'],
  IntlBackslash: ['\\', '\\'],
  Semicolon: [';', ';'],
  Quote: ["'", "'"],
  Comma: [',', ','],
  Period: ['.', '.'],
  Slash: ['/', '/'],
};

export function keyLabel(b: Binding | null | undefined, short = false): string {
  if (!b) return short ? '' : '—';
  const n = NAMES[b];
  if (n) return short ? n[1] : n[0];
  if (b.startsWith('Key')) return b.slice(3);
  if (b.startsWith('Digit')) return b.slice(5);
  if (b.startsWith('Numpad')) return `Num${b.slice(6)}`;
  return b;
}

/** 동작의 대표 키 이름 (첫 칸 우선) */
export function actionKey(a: Action, short = false): string {
  const [p, s] = current[a];
  return keyLabel(p ?? s, short);
}

/** 동작의 모든 키 이름 ('Shift/우클릭') */
export function actionKeys(a: Action): string {
  const ks = current[a].filter((b): b is Binding => !!b).map((b) => keyLabel(b));
  return ks.length ? ks.join('/') : '없음';
}

/** 화면 아래·HUD 조작 안내 한 줄 */
export function controlsHint(): string {
  const k = (a: Action) => actionKey(a);
  return (
    `이동 ${k('left')}·${k('right')}  점프 ${k('jump')}  공격 ${k('attack')}(연타 콤보, ${k('up')}+공격)  ` +
    `대시 ${actionKeys('dash')}·이동키 두 번  스킬 ${k('skill1')}·${k('skill2')}·${k('skill3')}  궁극기 ${k('ult')}  메뉴 Esc`
  );
}
