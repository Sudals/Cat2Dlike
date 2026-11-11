// Electron 런처: VS Code 등에서 상속되는 ELECTRON_RUN_AS_NODE 를 제거하고 실행한다.
// (이 변수가 있으면 Electron 이 일반 Node 로 동작해 require('electron').app 이 undefined 가 된다)
import { spawn } from 'node:child_process';
import electronPath from 'electron';

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, ['.', ...process.argv.slice(2)], { stdio: 'inherit', env });
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
