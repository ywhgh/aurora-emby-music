# v0.92.85 Release Notes

本版本重点加固 Emby 播放会话，减少服务器端 400 错误和播放记录异常。

## Highlights

- 播放地址、开始上报、进度上报、停止上报统一使用非空 `PlaySessionId`。
- 当服务器没有返回播放会话 ID 时，客户端会生成并复用本次播放 ID。
- 缓存版本已同步，刷新后会加载新的播放逻辑。
- 继续保留双语歌词与 UI 结构检查流程。

## Smoke Check

```powershell
node .\scripts\smoke-check.js
```

## GitHub Release

Tag: `v0.92.85`
