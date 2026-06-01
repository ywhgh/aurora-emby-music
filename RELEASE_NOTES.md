# v0.92.94 Release Notes

本版本继续打磨主页 Smart Playback Hub，把“今日开播”的封面区域改为更轻量的居中唱片视觉。

## Highlights

- 专辑封面改为圆形盘面，居中嵌在小黑胶唱片上。
- 重新设计右上悬浮摆臂，移除旧底座和偏移效果，唱片对齐更稳定。
- 播放时专辑盘面与唱片慢速旋转，暂停时保持静止。
- 移动端同步缩小唱片元素，不增加主页通栏高度。
- 本地检查覆盖唱片结构、专辑旋转动画、摆臂播放状态，并防止旧底座回归。

## Smoke Check

```powershell
node .\scripts\smoke-check.js
```

## GitHub Release

Tag: `v0.92.94`
