/**
 * 세이브 저장소 추상화
 * - Electron: userData/saves/<slot>.json (IPC, 원자적 쓰기)
 * - Web(체험판): localStorage
 */
export interface SaveStore {
  read<T>(slot: string): Promise<T | null>;
  write(slot: string, data: unknown): Promise<void>;
}

const WEB_PREFIX = 'nyanlife:';

function electronStore(native: NativeBridge): SaveStore {
  return {
    async read<T>(slot: string) {
      const raw = await native.save.read(slot);
      return raw ? (JSON.parse(raw) as T) : null;
    },
    async write(slot, data) {
      await native.save.write(slot, JSON.stringify(data));
    },
  };
}

const webStore: SaveStore = {
  async read<T>(slot: string) {
    try {
      const raw = localStorage.getItem(WEB_PREFIX + slot);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null; // 시크릿 모드/저장소 차단 시에도 게임은 계속 진행
    }
  },
  async write(slot, data) {
    try {
      localStorage.setItem(WEB_PREFIX + slot, JSON.stringify(data));
    } catch {
      /* 저장 실패는 무시 (체험판) */
    }
  },
};

export const saveStore: SaveStore = window.native ? electronStore(window.native) : webStore;
