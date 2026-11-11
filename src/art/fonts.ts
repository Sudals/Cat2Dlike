/**
 * Galmuri 한글 도트 폰트 (SIL OFL 1.1, https://github.com/quiple/galmuri)
 * 게임 시작 전에 로드해 두어야 Phaser 텍스트가 대체 폰트로 그려지지 않는다.
 */
import galmuri11 from 'galmuri/dist/Galmuri11.woff2?url';
import galmuri11Bold from 'galmuri/dist/Galmuri11-Bold.woff2?url';
import galmuri9 from 'galmuri/dist/Galmuri9.woff2?url';

export const FONT = { body: 'Galmuri11', small: 'Galmuri9' } as const;

export async function loadFonts(): Promise<void> {
  const faces = [
    new FontFace('Galmuri11', `url(${galmuri11})`),
    new FontFace('Galmuri11', `url(${galmuri11Bold})`, { weight: 'bold' }),
    new FontFace('Galmuri9', `url(${galmuri9})`),
  ];
  await Promise.all(
    faces.map(async (f) => {
      try {
        document.fonts.add(await f.load());
      } catch (err) {
        console.warn('font load failed', err); // 폰트가 없어도 게임은 계속 (시스템 폰트로 대체)
      }
    }),
  );
}
