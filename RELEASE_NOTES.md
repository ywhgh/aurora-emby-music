# v0.92.83 Release Notes

本版本重点是把正在播放体验和歌词稳定性再往前推进一段，方便后续继续参考 SPlayer、YesPlayMusic、Feishin 等项目做 UI 和播放器体验优化。

## Highlights

- 唱片机唱臂更自然：停靠在唱片机边缘，播放时小幅落针。
- 三处歌词显示统一：普通歌词、同步歌词、沉浸式歌词均为原文在上、中文翻译在下。
- 支持更可靠的英文/日文/韩文原文 + 中文翻译解析。
- 播放加载时有统一反馈，公网或转码等待时不会像“没反应”。
- 增加 smoke 检查脚本，后续改 UI 时能快速发现歌词或版本缓存回归。

## Smoke Check

```powershell
node .\scripts\smoke-check.js
```

## GitHub Release

Tag: `v0.92.83`

