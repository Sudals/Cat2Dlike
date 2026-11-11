/**
 * HUD 전용 씬 — 게임 씬 위에 겹쳐 실행된다. 게임 카메라의 줌/흔들림 영향을 받지 않는다.
 * 매 프레임 SandboxScene.hudState() 를 읽어 그린다.
 */
import Phaser from 'phaser';
import { DEPTH, VIEW_H, VIEW_W } from '../config/game';
import { EDITION, IS_DEMO, PLATFORM, VERSION } from '../config/build';
import { FONT } from '../art/fonts';
import { SkillBar, type BarSlot, type BarState } from '../ui/SkillBar';
import { cutIn } from '../ui/announce';
import { HERO_NAMES, SKILLS, SKILL_KEYS, type HeroKey } from '../skills';
import { RARITY_INFO, type AugmentDef } from '../augments/augments';

export interface HudState {
  hero: HeroKey;
  bar: BarState;
  hp: number;
  maxHp: number;
  kills: number;
  boss?: { name: string; hp: number; maxHp: number; phase: number };
  wave: number;
  enemies: number;
}

export interface HudSource {
  hudState(): HudState;
}

const TEXT = { fontFamily: FONT.small, fontSize: '9px', stroke: '#140c1c', strokeThickness: 3 };

export class HudScene extends Phaser.Scene {
  private skillBar?: SkillBar;
  private info!: Phaser.GameObjects.Text;
  private help!: Phaser.GameObjects.Text;
  private hpBar!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private hero?: HeroKey;
  private wave = 0;
  private shownHp = 0;
  private lastHp = 0;
  private hpFlash = 0;
  private infoT = 0;
  private bossBar!: Phaser.GameObjects.Graphics;
  private bossText!: Phaser.GameObjects.Text;
  private bossShown = -1;

  constructor() {
    super('hud');
  }

  /** 재시작 때마다 호출 — 같은 씬 객체를 재사용하므로 이전 판의 상태를 지운다 */
  init(): void {
    this.hero = undefined;
    this.wave = 0;
    this.shownHp = 0;
    this.lastHp = 0;
    this.hpFlash = 0;
    this.infoT = 0;
    this.bossShown = -1;
  }

  create(): void {
    this.info = this.add.text(8, 6, '', { ...TEXT, color: '#e8e0ff', lineSpacing: 3 }).setDepth(DEPTH.hud);
    this.hpBar = this.add.graphics().setDepth(DEPTH.hud);
    this.hpText = this.add.text(140, 38, '', { ...TEXT, color: '#ffffff' }).setDepth(DEPTH.hud);
    this.waveText = this.add.text(VIEW_W / 2, 8, '', { fontFamily: FONT.body, fontSize: '11px', color: '#fff1c8', stroke: '#140c1c', strokeThickness: 3 }).setOrigin(0.5, 0).setDepth(DEPTH.hud);
    this.help = this.add.text(214, VIEW_H - 22, '', { ...TEXT, color: '#fff1c8' }).setDepth(DEPTH.hud);
    this.skillBar = new SkillBar(this);
    this.bossBar = this.add.graphics().setDepth(DEPTH.hud);
    this.bossText = this.add
      .text(VIEW_W / 2, 58, '', { fontFamily: FONT.body, fontSize: '11px', fontStyle: 'bold', color: '#ffd8d0', stroke: '#140c1c', strokeThickness: 4 })
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.hud);
    if (IS_DEMO) this.add.text(VIEW_W - 8, 6, 'WEB DEMO', { ...TEXT, color: '#ffd08a' }).setOrigin(1, 0).setDepth(DEPTH.hud);
  }

  pulse(slot: BarSlot): void {
    this.skillBar?.pulse(slot);
  }

  deny(slot: BarSlot): void {
    this.skillBar?.deny(slot);
  }

  cutIn(text: string, color: number, heroTexture: string): void {
    cutIn(this, text, color, heroTexture);
  }

  /** 보스 체력바 (화면 위 가운데, 60%·25% 페이즈 경계 표시) */
  private drawBossBar(s: HudState, dt: number): void {
    const g = this.bossBar.clear();
    if (!s.boss) {
      this.bossText.setVisible(false);
      this.bossShown = -1;
      return;
    }
    const { hp, maxHp, phase, name } = s.boss;
    if (this.bossShown < 0) this.bossShown = maxHp;
    this.bossShown += (hp - this.bossShown) * Math.min(1, dt * 3);
    const w = 300;
    const x = (VIEW_W - w) / 2;
    const y = 74;
    g.fillStyle(0x140c1c, 1).fillRect(x - 2, y - 2, w + 4, 11);
    g.fillStyle(0x4a1a24, 1).fillRect(x, y, w, 7);
    g.fillStyle(0xffffff, 1).fillRect(x, y, Math.round((w * this.bossShown) / maxHp), 7);
    g.fillStyle(phase >= 3 ? 0xff2a1a : phase === 2 ? 0xff5a2a : 0xe8452a, 1).fillRect(x, y, Math.round((w * hp) / maxHp), 7);
    g.fillStyle(0xff9a7a, 1).fillRect(x, y, Math.round((w * hp) / maxHp), 2);
    g.fillStyle(0xffd36e, 1).fillRect(x + Math.round(w * 0.6), y - 3, 1, 13).fillRect(x + Math.round(w * 0.25), y - 3, 1, 13);
    this.bossText.setVisible(true).setText(`${name}  ·  ${phase}페이즈`);
  }

  /** 증강 선택 (카드 3장). ←→ 또는 1·2·3 으로 고르고 Space·Enter·Z 로 확정, 마우스 클릭도 가능 */
  showAugments(choices: AugmentDef[], wave: number, onPick: (a: AugmentDef) => void): void {
    const D = DEPTH.cutin + 5;
    const ADD = Phaser.BlendModes.ADD;
    const bg = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x05030a, 1).setOrigin(0).setAlpha(0).setDepth(D);
    this.tweens.add({ targets: bg, alpha: 0.82, duration: 250 });
    const title = this.add
      .text(VIEW_W / 2, 40, '증강 선택', { fontFamily: FONT.body, fontSize: '22px', fontStyle: 'bold', color: '#ffd36e', stroke: '#140c1c', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(D + 1);
    const sub = this.add
      .text(VIEW_W / 2, 66, `WAVE ${wave} 돌파! 하나를 골라 강해지세요`, { ...TEXT, color: '#e8e0ff' })
      .setOrigin(0.5)
      .setDepth(D + 1);
    const hint = this.add
      .text(VIEW_W / 2, VIEW_H - 16, '←→ 선택   Space 확정   (1·2·3 바로 선택)', { ...TEXT, color: '#a8a0c0' })
      .setOrigin(0.5)
      .setDepth(D + 1);
    const W = 156;
    const H = 196;
    const cards = choices.map((a, i) => {
      const r = RARITY_INFO[a.rarity];
      const x = VIEW_W / 2 + (i - (choices.length - 1) / 2) * 176;
      const y = 196;
      const c = this.add.container(x, y + 260).setDepth(D + 2);
      const g = this.add.graphics();
      const frame = (sel: boolean) => {
        g.clear();
        if (sel) g.fillStyle(r.color, 0.25).fillRoundedRect(-W / 2 - 6, -H / 2 - 6, W + 12, H + 12, 10);
        g.fillStyle(0x140c1c, 1).fillRoundedRect(-W / 2, -H / 2, W, H, 8);
        g.lineStyle(sel ? 3 : 2, sel ? 0xffffff : r.color, 1).strokeRoundedRect(-W / 2, -H / 2, W, H, 8);
        g.fillStyle(r.color, 0.2).fillRoundedRect(-W / 2 + 4, -H / 2 + 4, W - 8, 28, 6);
      };
      frame(false);
      const rarity = this.add.text(0, -H / 2 + 18, r.label, { fontFamily: FONT.small, fontSize: '9px', color: r.css, stroke: '#140c1c', strokeThickness: 3 }).setOrigin(0.5);
      const glow = this.add.image(0, -34, 'fx_glow').setBlendMode(ADD).setTint(r.color).setScale(1.1).setAlpha(0.5);
      const icon = this.add.image(0, -34, 'aug_icons', a.icon).setScale(2);
      const name = this.add
        .text(0, 12, a.name, { fontFamily: FONT.body, fontSize: '11px', fontStyle: 'bold', color: '#ffffff', stroke: '#140c1c', strokeThickness: 3 })
        .setOrigin(0.5);
      const desc = this.add.text(0, 30, a.desc, { fontFamily: FONT.small, fontSize: '9px', color: '#e8e0ff', align: 'center', lineSpacing: 4 }).setOrigin(0.5, 0);
      const key = this.add.text(0, H / 2 - 14, `[ ${i + 1} ]`, { fontFamily: FONT.small, fontSize: '9px', color: '#a8a0c0' }).setOrigin(0.5);
      c.add([g, rarity, glow, icon, name, desc, key]);
      c.setInteractive(new Phaser.Geom.Rectangle(-W / 2, -H / 2, W, H), Phaser.Geom.Rectangle.Contains);
      c.scaleX = 0;
      this.tweens.add({ targets: c, y, scaleX: 1, duration: 380, delay: 120 + i * 110, ease: 'Back.Out' });
      this.tweens.add({ targets: glow, alpha: 0.9, scale: a.rarity === 'prism' ? 1.7 : 1.4, duration: 700, yoyo: true, repeat: -1 });
      return { c, frame, a };
    });

    let sel = Math.min(1, cards.length - 1);
    let ready = false;
    let picked = false;
    const highlight = () =>
      cards.forEach((cd, i) => {
        cd.frame(i === sel);
        cd.c.setScale(i === sel ? 1.06 : 1);
      });
    this.time.delayedCall(650, () => {
      ready = true;
      highlight();
    });
    const kb = this.input.keyboard!;
    const handlers: [string, () => void][] = [];
    const pick = (i: number) => {
      if (!ready || picked || i >= cards.length) return;
      picked = true;
      handlers.forEach(([e, fn]) => kb.off(e, fn));
      const chosen = cards[i];
      this.cameras.main.flash(220, 255, 240, 200);
      this.tweens.add({ targets: chosen.c, scale: 1.2, duration: 180, yoyo: true });
      cards.forEach((cd, j) => {
        if (j !== i) this.tweens.add({ targets: cd.c, alpha: 0, y: cd.c.y + 30, duration: 250 });
      });
      this.time.delayedCall(560, () => {
        [bg, title, sub, hint, ...cards.map((cd) => cd.c)].forEach((o) => o.destroy());
        onPick(chosen.a);
      });
    };
    const move = (d: number) => {
      if (!ready || picked) return;
      sel = (sel + d + cards.length) % cards.length;
      highlight();
    };
    handlers.push(
      ['keydown-LEFT', () => move(-1)],
      ['keydown-RIGHT', () => move(1)],
      ['keydown-ONE', () => pick(0)],
      ['keydown-TWO', () => pick(1)],
      ['keydown-THREE', () => pick(2)],
      ['keydown-SPACE', () => pick(sel)],
      ['keydown-ENTER', () => pick(sel)],
      ['keydown-Z', () => pick(sel)],
    );
    handlers.forEach(([e, fn]) => kb.on(e, fn));
    cards.forEach((cd, i) => cd.c.on('pointerdown', () => pick(i)));
  }

  /** 게임 오버 (목숨은 하나) — 도달 웨이브·처치 수 + 재도전 안내 */
  gameOver(wave: number, kills: number): void {
    const bg = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x05030a, 1).setOrigin(0).setAlpha(0).setDepth(DEPTH.cutin);
    this.tweens.add({ targets: bg, alpha: 0.6, duration: 500 });
    const big = { fontFamily: FONT.body, fontStyle: 'bold', stroke: '#140c1c' };
    const title = this.add
      .text(VIEW_W / 2, 130, 'GAME OVER', { ...big, fontSize: '44px', color: '#ff6a5a', strokeThickness: 8 })
      .setOrigin(0.5)
      .setDepth(DEPTH.cutin + 1)
      .setScale(2)
      .setAlpha(0);
    this.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 300, ease: 'Back.Out' });
    this.add
      .text(VIEW_W / 2, 178, `WAVE ${wave} 도달 · 처치 ${kills}`, { fontFamily: FONT.body, fontSize: '22px', color: '#fff1c8', stroke: '#140c1c', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(DEPTH.cutin + 1);
    const prompt = this.add
      .text(VIEW_W / 2, 226, 'SPACE 를 눌러 다시 도전', { fontFamily: FONT.body, fontSize: '22px', color: '#ffffff', stroke: '#140c1c', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(DEPTH.cutin + 1);
    this.tweens.add({ targets: prompt, alpha: 0.25, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  /** 화면 집중선 (줌 영향 없이 화면 가장자리에서 중앙으로) */
  speedlines(ms: number, tint = 0xffffff): void {
    const s = this.add
      .sprite(VIEW_W / 2, VIEW_H / 2, 'fx_speedlines', '0')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(tint)
      .setAlpha(0)
      .setDepth(DEPTH.hud - 50)
      .play('fx_speedlines');
    this.tweens.add({ targets: s, alpha: 0.6, duration: 110 });
    this.tweens.add({ targets: s, alpha: 0, delay: Math.max(0, ms - 200), duration: 200, onComplete: () => s.destroy() });
  }

  /** 화면 중앙 큰 글씨 배너 (웨이브 시작 등) */
  banner(text: string, color = '#ffffff'): void {
    const t = this.add
      .text(VIEW_W / 2, VIEW_H * 0.38, text, { fontFamily: FONT.body, fontSize: '22px', fontStyle: 'bold', color, stroke: '#140c1c', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(DEPTH.cutin)
      .setScale(2.4)
      .setAlpha(0);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 220, ease: 'Back.Out' });
    this.tweens.add({ targets: t, alpha: 0, y: t.y - 14, delay: 900, duration: 300, onComplete: () => t.destroy() });
  }

  update(time: number, deltaMs: number): void {
    const src = this.scene.get('sandbox') as unknown as HudSource & Phaser.Scene;
    if (!this.skillBar || !src.sys.isActive()) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    const s = src.hudState();

    if (s.hero !== this.hero) {
      this.hero = s.hero;
      this.skillBar.setHero(s.hero);
      const k = SKILLS[s.hero];
      this.help.setText(
        `${HERO_NAMES[s.hero]}  ${(['skill1', 'skill2', 'skill3', 'ult'] as const).map((sl) => `${SKILL_KEYS[sl]} ${k[sl].name}`).join(' · ')}`,
      );
    }
    this.skillBar.update(dt, s.bar, time);
    this.drawBossBar(s, dt);

    // 체력바 (피격 시 흰 잔상 + 깜빡)
    if (s.hp < this.lastHp) this.hpFlash = 0.25;
    if (this.shownHp < s.hp) this.shownHp = s.hp;
    this.lastHp = s.hp;
    this.shownHp += (s.hp - this.shownHp) * Math.min(1, dt * 3);
    this.hpFlash -= dt;
    const w = 124;
    const x = 10;
    const y = 38;
    const g = this.hpBar.clear();
    g.fillStyle(0x140c1c, 1).fillRect(x - 2, y - 2, w + 4, 11);
    g.fillStyle(this.hpFlash > 0 ? 0xffffff : 0x4a3050, 1).fillRect(x - 1, y - 1, w + 2, 9);
    g.fillStyle(0x140c1c, 1).fillRect(x, y, w, 7);
    g.fillStyle(0xffffff, 1).fillRect(x, y, Math.round((w * this.shownHp) / s.maxHp), 7);
    g.fillStyle(s.hp / s.maxHp < 0.3 ? 0xff5040 : 0xe8452a, 1).fillRect(x, y, Math.round((w * s.hp) / s.maxHp), 7);
    g.fillStyle(0xff9a7a, 1).fillRect(x, y, Math.round((w * s.hp) / s.maxHp), 2);
    this.hpText.setText(`${Math.ceil(s.hp)} / ${s.maxHp}   처치 ${s.kills}`);

    if (s.wave !== this.wave && s.wave > 0) {
      this.wave = s.wave;
      this.banner(`WAVE ${s.wave}`, '#ffd08a');
    }
    this.waveText.setText(s.wave > 0 ? `WAVE ${s.wave} · 남은 적 ${s.enemies}` : '');

    this.infoT -= dt;
    if (this.infoT <= 0) {
      this.infoT = 0.25;
      this.info.setText([
        `냥생은 한 번뿐 v${VERSION} · ${EDITION.toUpperCase()} · ${PLATFORM.toUpperCase()} · ${Math.round(this.game.loop.actualFps)}fps`,
        '이동 ←→  대시 ←← →→ / Shift  점프 Space  공격 Ctrl(연타 콤보, ↑+공격)  스킬 Z·X·C  궁극기 V  직업 1·2',
      ]);
    }
  }
}
