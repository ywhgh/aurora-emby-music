# v0.92.86 Release Notes

本版本修复音乐库加载报错，并优化手机端登录页与播放失败后的恢复路径。

## Highlights

- 修复 `getAlbumQualityBucket is not defined` 导致音乐库加载失败的问题。
- 手机端登录页调整为一屏内完成连接操作。
- 播放失败面板新增稳播方案，可直接切换不同在线音质链路重试。
- 本地检查脚本新增关键函数存在性校验。

## Smoke Check

```powershell
node .\scripts\smoke-check.js
```

## GitHub Release

Tag: `v0.92.86`
