/**
 * DOM 에서 직접 받는 키보드·마우스 입력.
 * - 키는 KeyboardEvent.code(물리 위치) 기준 → 한/영 입력기 상태와 무관 (한글 모드에서 WASD 가 안 먹는 문제 방지)
 * - 마우스 버튼도 'Mouse0'(왼쪽)·'Mouse2'(오른쪽)… 바인딩으로 똑같이 취급
 * - 아주 짧은 클릭(프레임 사이에 눌렀다 뗌)도 놓치지 않도록 누른 횟수를 센다
 * - onPress 구독은 나중에 등록한 쪽이 먼저 받고, true 를 돌려주면 그 아래로 전달되지 않는다
 *   (메뉴가 열려 있으면 메뉴가 입력을 다 가져감)
 *
 * Phaser 는 기본 동작이 막힌(defaultPrevented) 이벤트를 무시하므로, Phaser 리스너가 붙은 뒤
 * (game READY) 같은 window 버블 단계에 붙여서 Phaser 가 먼저 처리한 다음 preventDefault 한다.
 */
import { actionOf } from './bindings';

type PressHandler = (b: string) => boolean | void;

const held = new Set<string>();
const counts = new Map<string, number>();
const handlers: PressHandler[] = [];
let installed = false;

/** 페이지 스크롤·포커스 이동·브라우저 메뉴를 막을 키 (바인딩 여부와 상관없이) */
const ALWAYS_PREVENT = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'AltLeft', 'AltRight', 'Backspace']);

export function normalizeKey(e: KeyboardEvent): string {
  const c = e.code || e.key;
  if (c === 'ShiftLeft' || c === 'ShiftRight') return 'Shift';
  return c;
}

function down(b: string): void {
  if (held.has(b)) return;
  held.add(b);
  counts.set(b, (counts.get(b) ?? 0) + 1);
  for (let i = handlers.length - 1; i >= 0; i--) if (handlers[i](b) === true) break;
}

export function installRawInput(): void {
  if (installed) return;
  installed = true;
  window.addEventListener('keydown', (e) => {
    const b = normalizeKey(e);
    if (/^F\d+$/.test(b)) return; // F키는 브라우저/창 기능 그대로
    if (ALWAYS_PREVENT.has(b) || (actionOf(b) && !e.ctrlKey && !e.metaKey)) e.preventDefault();
    if (!e.repeat) down(b);
  });
  window.addEventListener('keyup', (e) => {
    const b = normalizeKey(e);
    held.delete(b);
    if (b === 'AltLeft' || b === 'AltRight') e.preventDefault(); // Alt 를 떼면 브라우저 메뉴로 포커스가 가는 것 방지
  });
  window.addEventListener('mousedown', (e) => {
    const b = `Mouse${e.button}`;
    if (e.button === 1 || e.button >= 3) e.preventDefault(); // 휠 클릭 자동 스크롤 / 뒤로·앞으로
    down(b);
  });
  window.addEventListener('mouseup', (e) => {
    held.delete(`Mouse${e.button}`);
    if (e.button >= 3) e.preventDefault();
  });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  // 창이 포커스를 잃으면 떼는 이벤트가 안 오므로 눌림 상태를 비운다 (Alt+Tab 후 키가 눌린 채 남는 문제)
  window.addEventListener('blur', () => held.clear());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) held.clear();
  });
}

export const raw = {
  isHeld: (b: string): boolean => held.has(b),
  /** b 를 지금까지 누른 횟수 — 프레임 사이 짧은 클릭 감지용 */
  pressCount: (b: string): number => counts.get(b) ?? 0,
  /** 새로 누를 때마다 호출. 해제 함수를 돌려줌 */
  onPress(fn: PressHandler): () => void {
    handlers.push(fn);
    return () => {
      const i = handlers.indexOf(fn);
      if (i >= 0) handlers.splice(i, 1);
    };
  },
};
