# 无畏契约准星收集

一个 Windows 桌面软件，收集并展示《无畏契约》（Valorant）的准星，分为两个栏目：

- **社区准星**：网上分享的热门/经典准星
- **职业选手准星**：职业选手的准星，准星下方标注选手名字/ID 和队伍

功能：准星预览、搜索、一键复制代码（复制后到游戏「设置 → 准星 → 导入准星代码」粘贴即可使用）。

界面采用淡黄色简洁风格。

## 开发运行

```bash
npm install   # 安装依赖
npm start     # 启动软件
```

## 打包成安装包（发给朋友）

```bash
npm run dist
```

生成结果在 `release/` 目录下。

## 目录结构

- `main.js` / `preload.js` —— Electron 主进程与桥接（读取数据、复制到剪贴板）
- `renderer/` —— 界面（HTML/CSS/JS），其中 `crosshair.js` 负责解析准星代码并绘制预览
- `data/crosshairs.json` —— 准星数据（社区 + 职业选手）
