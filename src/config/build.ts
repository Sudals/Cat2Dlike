/** 빌드/플랫폼 플래그. 체험판 콘텐츠 제한은 반드시 IS_DEMO 로만 분기한다. */
export const EDITION = __EDITION__;
export const IS_DEMO = EDITION === 'demo';
export const IS_ELECTRON = typeof window !== 'undefined' && window.native?.platform === 'electron';
export const PLATFORM: 'electron' | 'web' = IS_ELECTRON ? 'electron' : 'web';
export const VERSION = __APP_VERSION__;
