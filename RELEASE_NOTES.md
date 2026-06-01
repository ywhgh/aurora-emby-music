# v0.92.93 Release Notes

本版本重构主页顶部的播放入口，把“今日开播”和队列恢复融合为一个更紧凑的 Smart Playback Hub。

## Highlights

- 左侧保留当前播放封面、歌曲信息和音质/队列摘要。
- 右侧融合播放进度、下一首预告、继续队列和快捷操作。
- 删除旧的独立“继续队列”模块，减少主页重复信息。
- 通栏高度进一步压缩，桌面端左右分离，小屏端保持两行紧凑布局。
- 增加唱片旋转、进度流光、下一首跑马灯和继续按钮涟漪反馈。

## Smoke Check

```powershell
node .\scripts\smoke-check.js
```

## GitHub Release

Tag: `v0.92.93`
