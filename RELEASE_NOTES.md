# v0.92.84 Release Notes

本版本重点增强双语歌词兼容性，并继续保持播放器 UI 与歌词显示链路的稳定性。

## Highlights

- 支持同一行双语歌词格式，例如 `Hello world // 你好世界`。
- 支持斜杠分隔的双语歌词，例如 `君の名は / 你的名字`。
- 普通歌词、同步歌词、沉浸式歌词继续统一显示为原文在上、中文翻译在下。
- 本地检查脚本新增同一行双语歌词用例，降低后续 UI 调整时的回归风险。

## Smoke Check

```powershell
node .\scripts\smoke-check.js
```

## GitHub Release

Tag: `v0.92.84`
