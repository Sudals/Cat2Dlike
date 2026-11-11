# 냥생은 한 번뿐 (Nyan Only Lives Once)

고양이 주인공 2D 횡스크롤 로그라이트 — Electron 정식판(exe) + 웹 체험판.
기획서: [docs/GAME_PLAN.md](docs/GAME_PLAN.md)

## 스택

Phaser 4.2 · TypeScript 7 · Vite 8 · Electron 45 · electron-builder 26

## 실행

```bash
npm install
npm run dev            # 브라우저 개발 서버 http://127.0.0.1:5173 (정식판 모드)
npm run dev:demo       # 브라우저 개발 서버 (체험판 모드)
npm run dev:electron   # Electron 창 + HMR
```

- `http://127.0.0.1:5173/#viewer` — 생성된 도트 프레임 검수 뷰어 (`#viewer-zoom` 확대)
- `http://127.0.0.1:5173/#showcase` — 스킬 자동 시연 (검객 → 마법사, 스모크 테스트용)
- `http://127.0.0.1:5173/#autoplay` — 자동 이동 (`#autoplay-mage` 마법사)

## 빌드

```bash
npm run build:web      # 웹 체험판 → dist-web/ (정적 호스팅에 그대로 업로드)
npm run preview:web    # 웹 체험판 서버 → http://localhost:4173 + 같은 네트워크 기기는 http://<내 IP>:4173
npm run dist:win       # Windows exe → release/ (NSIS 설치판 + 포터블)
npm run smoke          # 빌드 → Electron 실행 → release/smoke.png 캡처 후 자동 종료
```

## 조작 (기본 배치: WASD + 마우스)

키는 **Esc → 키 설정**(웹은 타이틀의 [키 설정] 버튼도 가능)에서 동작마다 2개까지 바꿀 수 있고, 바로 저장됩니다.
키는 물리 위치 기준이라 한/영 상태와 상관없이 동작합니다.

| 행동 | 키 | 패드 |
|---|---|---|
| 이동 (관성 있음) | A D (← → 도 가능) | 왼스틱 |
| 점프 (2단) | Space | A |
| 기본 공격 (연타 3타 콤보) | 좌클릭 | X |
| 위 공격 | W + 좌클릭 | ↑ + X |
| 스킬 1 / 2 / 3 | Q / E / R | LB / RB / RT |
| 궁극기 (게이지 100) | F | LT |
| 대시 | Shift / 우클릭 / 이동키 두 번 | B |
| 발판 아래로 | S + 점프 | ↓ + A |
| 일시정지 · 키 설정 | Esc | |
| 직업 전환 (검객 / 마법사) | 1 / 2 | |
| 전체화면 | F11 / Alt+Enter | |
| 개발자 도구 (개발 모드) | F12 | |

| 직업 | Q | E | R | F (궁극기) |
|---|---|---|---|---|
| 검객 | 발도 일섬 | 회오리 할퀴기 | 초승달 참격 | 천냥 난무 |
| 마법사 | 불꽃 털뭉치 | 꼬리 낙뢰 | 서리 발자국 | 달빛 낙하 |

적: 시궁쥐 · 칼잡이 쥐 · 비둘기 폭격기 · 떠돌이 들개 (웨이브로 출현, URL에 `#wave=5` 처럼 시작 웨이브 지정 가능)

## 서드파티

- 폰트: [Galmuri](https://github.com/quiple/galmuri) (SIL OFL 1.1) — 라이선스 `public/licenses/Galmuri-OFL.md`

## 메모

- VS Code 같은 Electron 기반 도구에서 실행하면 `ELECTRON_RUN_AS_NODE`가 상속될 수 있어서, Electron은 항상 `scripts/run-electron.mjs`로 실행한다.
- 체험판/정식판 분기는 `src/config/build.ts`의 `IS_DEMO`로만 한다.
- 앱 아이콘이 아직 없어서 기본 Electron 아이콘이 쓰인다 → `build/icon.ico` (256×256)를 추가하면 적용된다.
