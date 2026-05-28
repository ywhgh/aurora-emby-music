# Changelog

## v0.92.83

- 调整正在播放页唱片机唱臂：停靠位收回到唱片机右上边缘，播放落针幅度缩小，避免夸张摆动。
- 修复双语歌词链路：普通歌词列表、同步歌词卡片、沉浸式歌词统一显示“原文在上，中文翻译在下”。
- 改进双语歌词解析：英文、日文、韩文等原文会保留到 `originalText`，纯中文优先作为翻译主句。
- 新增播放加载/缓冲状态反馈：点歌、转码加载、等待和 seek 时播放按钮显示加载环。
- 新增 `scripts/smoke-check.js`，覆盖版本缓存一致性、CSS 结构和双语歌词关键回归点。

### 验证

```powershell
node .\scripts\smoke-check.js
node --check .\app.js
node --check .\src\lyrics.js
node --check .\src\config.js
node --check .\sw.js
```

