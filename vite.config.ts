import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };

// mode: development | full → 정식판(Electron), demo → 웹 체험판
export default defineConfig(({ mode }) => {
  const edition = mode === 'demo' ? 'demo' : 'full';

  return {
    // file/app 프로토콜과 정적 호스팅(itch.io 등) 모두에서 동작하도록 상대 경로
    base: './',
    define: {
      __EDITION__: JSON.stringify(edition),
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
    // 웹 체험판 미리보기는 같은 네트워크의 다른 기기(폰·다른 PC)에서도 접속 가능하도록 모든 주소에서 수신
    preview: { host: '0.0.0.0', port: 4173, strictPort: true },
    build: {
      outDir: edition === 'demo' ? 'dist-web' : 'dist',
      emptyOutDir: true,
      target: 'es2022',
      assetsInlineLimit: 0,
      // Phaser 단일 청크가 1MB를 넘으므로 경고 기준 상향
      chunkSizeWarningLimit: 2500,
    },
  };
});
