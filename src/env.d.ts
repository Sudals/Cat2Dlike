/// <reference types="vite/client" />

/** vite.config.ts 의 define 으로 주입 */
declare const __EDITION__: 'demo' | 'full';
declare const __APP_VERSION__: string;

/** electron/preload.cjs 가 노출하는 브리지 (웹 빌드에서는 undefined) */
interface NativeBridge {
  platform: 'electron';
  versions: { electron: string; chrome: string };
  save: {
    read(slot: string): Promise<string | null>;
    write(slot: string, data: string): Promise<void>;
  };
  setFullscreen(on: boolean): Promise<void>;
  isFullscreen(): Promise<boolean>;
  quit(): Promise<void>;
}

interface Window {
  native?: NativeBridge;
}
