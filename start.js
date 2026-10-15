// 开发启动器：清除 ELECTRON_RUN_AS_NODE 环境变量后再启动 Electron。
// 某些环境会设置 ELECTRON_RUN_AS_NODE=1，导致 electron 以纯 Node 模式运行、
// require('electron') 返回路径字符串而无法启动 GUI 窗口。这里在 spawn 时移除该变量。
const { spawn } = require('child_process');

// 在 Node 环境下，require('electron')（npm 包）返回 electron.exe 的路径字符串
const electronPath = require('electron');

const env = Object.assign({}, process.env);
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, ['.'], { stdio: 'inherit', env: env, windowsHide: false });

child.on('close', function (code, signal) {
  if (code === null) {
    console.error(electronPath, 'exited with signal', signal);
    process.exit(1);
  }
  process.exit(code);
});
