import Phaser from 'phaser';
import { registerGeneratedTextures } from '../art/textures';
import { IS_ELECTRON } from '../config/build';

/** 텍스처/애니메이션 생성 후 다음 씬으로. M2 이후 PNG 아틀라스 preload 도 여기서 처리. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    registerGeneratedTextures(this);
    // 웹: 타이틀(Space 로 시작) / exe: 바로 게임. 테스트용 해시가 있으면 타이틀을 건너뛴다 (#title 은 강제 표시)
    const hash = location.hash;
    const testMode = /autoplay|showcase|wave=/.test(hash);
    if (hash.includes('viewer')) this.scene.start('viewer');
    else if (hash.includes('title') || (!IS_ELECTRON && !testMode)) this.scene.start('title');
    else this.scene.start('sandbox');
  }
}
