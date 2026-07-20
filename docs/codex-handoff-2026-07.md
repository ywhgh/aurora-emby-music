# Codex 提示词归档（2026-07）

> 这是本次审计产出的所有给 codex 的提示词 / 对话脚本的合订本。
> 任何 AI 助手接手此项目时，**先读本文件即可完成 onboarding**，再按需回到 [docs/audit-2026-07.md](./audit-2026-07.md) 查阅任务详情。
>
> 版本基线：v0.93.229 → 下一目标 v0.94.x
> 维护者：仓库所有者；执行者：codex / 其他 AI 助手

---

## 目录

1. [敏感字段与全局守则（适用于所有版本提示词）](#1-敏感字段与全局守则)
2. [代码审计结论（精要版）](#2-代码审计结论)
3. [提示词 A — 完整任务版（首次发送，2026-07-20）](#3-提示词-a--完整任务版)
4. [提示词 B — 修正敏感字段版（同日修正）](#4-提示词-b--修正敏感字段版)
5. [对话脚本 C — 开场对话（推荐先用这个）](#5-对话脚本-c--推荐先用这个)
6. [对话脚本 D — 三轮拆解版（备用，codex 上下文吃不下时用）](#6-对话脚本-d--三轮拆解备用)
7. [怎么给 codex 发](#7-怎么给-codex-发)
8. [看到 codex 响应后该做什么](#8-看到-codex-响应后该做什么)

---

## 1. 敏感字段与全局守则

这一节是**所有版本提示词的通用前置**，复制任何一段都必须带上。

### 1.1 敏感字段清单（禁止进入源码默认值 / 日志 / 错误 / 诊断）

| 字段 | 含义 |
|---|---|
| `serverUrl` | Emby 服务器地址 |
| `serverId` | Emby 服务器 ID |
| `userId` | Emby 用户 ID |
| `accessToken` | Emby 访问令牌 |
| `deviceId` / `deviceName` | 当前设备标识 / 名称 |
| `externalSourceApiUrl` | 音源桥 API 地址（用户自填） |
| `lyricsSourceBridgeApiUrl` | 歌词桥 API 地址（用户自填） |
| 任何出现在 `localStorage` / `IndexedDB` 中的外部 host | 包括用户配置的桥地址、Emby 服务器、企业内网代理等 |

### 1.2 强制脱敏规则

- UI 显示 server URL：保留 host 前两段 + 后两段，中间 `***`，端口打码（如 `http://192.168.*.*:****/emby`）。
- UI 显示 token：永远只显示 `***<last4>`。
- 任何 `console.log` / `setMessage` / 错误提示里如必须包含 URL，至少截断到 host，不带端口 / path。
- "复制诊断信息"功能在用户主动点击时可包含原值，但复制结果顶部必须加：
  > 本诊断包含你的服务器/账号信息，请勿在公开场合粘贴。

### 1.3 全局守则

- 不新增 npm 依赖（除非任务显式允许）。
- 每个 PR 单独可 `git revert`；禁止大爆炸重写。
- 不改 Emby 服务器契约（除非任务显式列出）。
- 不在 README / CHANGELOG 重复罗列修改；统一收口到 RELEASE_NOTES.md。

---

## 2. 代码审计结论

> 完整版见 [docs/audit-2026-07.md](./audit-2026-07.md)。这里只放精要让 codex 一眼看到全局。

### 2.1 高危安全（必须先做）

| 编号 | 文件 | 风险 |
|---|---|---|
| V1 | `scripts/source-bridge.js:139-169` | `/configure` 无鉴权，任意来源 POST 可改音乐目录 / 清单 |
| V2 | `scripts/source-bridge.js:1576 / 3114` | `/remote-stream` 开放 SSRF 代理 |
| V3 | `scripts/source-bridge.js:529-622` | `vm.createContext` 沙箱仍有外泄通道（fetch / axios / Buffer 可用） |
| V4 | `scripts/source-bridge.js:23` | 默认 manifest URL 硬编码公网域名 |
| V5 | `scripts/source-bridge.js:3299-3469` | `restorePluginTrackFromSnapshot` 可注入 `pluginUrl` 即插即跑 |
| V6 | `scripts/source-bridge.js:3853` | `Access-Control-Allow-Origin` 反射任意 origin |
| V7 | `scripts/source-bridge.js:37-38` | `--host` 可绑 `0.0.0.0`，无鉴权下放大攻击面 |

### 2.2 中危

| 编号 | 描述 |
|---|---|
| V8 / S7 | `src/config.js` 把用户私有桥地址写成代码默认值（敏感数据泄漏） |
| V9 | `index.html` 无 CSP meta |
| V10 | `accessToken` 原样存 localStorage |
| V11 | `src/ui-helpers.js` 内 `innerHTML = ... ${message}` 未转义（当前未被引用） |
| V12 | 歌词解析器接收不可信 .lrc 文本，需确认渲染路径是否转义 |
| V13 | SW install 立即 `skipWaiting()` 会强制接管 |
| V14 | localStorage 队列可能撞 5MB 配额 |

### 2.3 维护 / 性能 / 功能

完整列表见 [audit §1.1](./audit-2026-07.md#11-已发现的问题分布)。

---

## 3. 提示词 A — 完整任务版（首次发送，2026-07-20）

> 这版是最早的"全家桶"，可以整段发给 codex。如果它上下文够，一段就够。

```text
# 角色与目标
你是这个开源项目（Emby Music Web / Aurora Music）的高级代码审计与重构工程师。
请按 **"先安全 → 再健壮 → 再功能 → 再优化"** 的顺序，根据下面的"项目背景 + 任务清单 + 验收点"逐项交付。
每完成一项，在交付里给一段简短的 diff 摘要（不超 8 行）+ 一条可手动复现的验证命令。
**禁止**直接把用户私有配置（外网桥地址、Emby 服务器地址、账号、设备名）写进任何 log / console / 诊断字符串 / 上报通道里。涉及这些字段时统一脱敏。

# 项目背景
- 仓库位置：D:\emby-music-web（git 跟踪；当前分支 master；当前版本 v0.93.229）
- 前端纯静态：app.js（26k 行 / 920 KB）、styles.css（24k 行 / 570 KB）、index.html、src/*.js
- 服务端：scripts/source-bridge.js（Node，无外部依赖；用 `vm` 执行第三方插件）
- 测试：scripts/source-bridge-smoke.js、scripts/smoke-check.js、scripts/browser-smoke.js
- 命令：npm run check / smoke / smoke:bridge / smoke:browser
- 没有构建步骤、没有 CI

# 任务清单

## 安全任务

### S1. source-bridge `/configure` 加鉴权
- 新增 `--api-token` / `SOURCE_BRIDGE_API_TOKEN` 环境变量。
- 接受 POST 时校验 `X-Bridge-Token: <token>`，缺失/不匹配 → 401。
- token 为空时强制 `--allow-anonymous-configure=false`（默认 false），启动时打显眼的 WARNING。

### S2. `/remote-stream` SSRF 防护
- 新增 `BLOCKED_REMOTE_HOSTS`：localhost / 127.* / ::1 / 10.* / 172.16-31.* / 192.168.* / 169.254.* / 100.64-127.* / *.local / *.internal
- 接到 `url=` 后用 `dns.lookup` 解析；命中黑名单 → 403。
- 仅允许 http / https；拦截 `data:` / `javascript:` / `file:` / `gopher:` 等。
- CORS 改为受控白名单（默认拒绝跨域，除非 origin 在配置的白名单里）。
- source-bridge-smoke.js 新增用例：127.0.0.1 / 192.168.x / 10.x 都必须 403。

### S3. 插件清单与插件代码签名校验
- manifest JSON 新增 `signature` 字段，节点用 `crypto.verify` 校验。
- 公钥来自 `EMBY_BRIDGE_TRUSTED_KEYS` env（多个换行分隔）。
- 校验失败整张 manifest 拒绝。
- 保留 `--allow-unsigned-plugins` flag，默认 false，用于本地开发。

### S4. `restorePluginTrackFromSnapshot` 的任意 pluginUrl 注入
- `?track=<JSON>` 中的 `pluginUrl` 必须命中已加载的 manifest 中存在的 plugin。
- 移除 `createRuntimePluginFromSnapshot` 的"按 URL 自动加载并执行"分支。
- 重启后只能通过 manifest 二次确认插件存在；否则视为失效。

### S5. 改用更稳的隔离
- 把 `vm.createContext(...)` 替换为 `node:worker_threads`。
- 每个插件独立 worker；通信走 `parentPort.postMessage` 白名单方法：`search / getMediaSource / getLyric`。
- worker 加 CPU 时间预算 3s + `resourceLimits.maxOldGenerationSizeMb=256`；超时硬 kill。

### S6. 加 CSP / SRI
- index.html 加：
  ```html
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' https: data: blob:; media-src 'self' https: http://localhost:* http://127.0.0.1:*; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https: http://localhost:* http://127.0.0.1:*; object-src 'none'; base-uri 'self'; frame-ancestors 'none';">
  ```

### S7. 移除 src/config.js 中硬编码的私有桥地址
- 把 `DEFAULT_EMBY_LYRICS_SOURCE_BRIDGE_API_URL` 等用户私有配置的字面默认值**全部清空**。
- 改为动态来源：① 启动从 `localStorage["emby-music-web/lyrics-source-bridge-api-url"]` 读取；② 读不到返回空字符串；③ 不再回退到具体公网 IP。
- 同一规则适用于 `EXTERNAL_SOURCE_API_KEY`、`SOURCE_BRIDGE_*_KEY` 等。

### S8. 诊断信息全量脱敏
- 新增 src/redact.js，提供 redactUrl / redactServer / redactToken。
- app.js "复制诊断信息"按钮、setMessage、console.log 全过 redact helper。
- README 新增"诊断信息安全"段。

## 健壮性任务

### R1. 清理未使用模块
- 删 src/{state-management,accessibility,color-extractor,performance,theme,ui-helpers}.js（已 grep 确认无引用）
- 更新 index.html <script> 列表、sw.js APP_SHELL、CHANGELOG。
- 注：color-extractor 和 theme 的能力在 F3 / F4 重新引入。

### R2. 统一安全 DOM helper
- 新增 src/dom-helpers.js：appendLoading / appendEmpty / escapeHtml。
- 全文件扫描 `innerHTML = ... ${X}` 模式：来自 Emby / 插件 / 用户输入的 X 必须 escapeHtml(X)。

### R3. SW 升级流程升级
- sw.js install 不再 `skipWaiting()`；收到 `SKIP_WAITING` 消息才激活。
- fetch 策略改为 stale-while-revalidate。

### R4. 队列持久化换 IndexedDB
- 新增 src/idb-queue.js；接口与 storage.js queue API 兼容。
- 上限 10000 条；保留 localStorage 作为降级（仅 80 条）。

### R5. 拆 app.js
- R5a（player.js、queue.js）→ R5b（library.js、search.js）→ R5c（settings.js、bridge.js）。
- 入口改为 main.js 做 wiring；保持无构建（浏览器原生 ESM）。

### R6. 状态层收敛
- 新增 src/store.js（小型 pub/sub，100 行内）。
- app.js 内 `state.x = y` 替换为 `store.set({x: y})`；派生量按需计算 + requestIdleCallback 防抖。

## 功能任务

### F1. 本地数据导入 / 导出
- 设置页"维护"区：导出（队列 / 收藏 / 最近 / 偏好）为 JSON；导入时校验 version，冲突前弹确认。
- 文件名 `aurora-export-<date>.json`；导入数据写入前先 redact 校验。

### F2. 歌词淡入淡出 + 卡拉 OK 高亮
- 加 120ms 过渡，主行 / 次行两级颜色梯度。

### F3. 封面取色 → 主色 CSS 变量
- 新增 src/cover-color.js。
- currentTrack 变化时采样；不满足 CORS 时降级为固定主题红。
- 设置项"封面取色"开关；默认开。

### F4. 系统暗色模式跟随
- 设置项"主题：浅 / 深 / 跟随系统"。

### F5. 键盘 Cheat Sheet UI
- 按 `?` 弹出当前所有快捷键列表。

### F6. ReplayGain（轻量）
- 解析 Emby MediaSources / MediaStreams ReplayGain；存在则 WebAudio gain 调整。

### F7. 睡眠定时淡出
- 现版本硬切暂停；改为末 30 / 60 / 90 秒线性 fadeOut。

# 验收约定
```
npm run check
npm run smoke
npm run smoke:bridge
$env:BROWSER_SMOKE_RUN='1'; $env:BROWSER_SMOKE_TIMEOUT_MS='90000'; npm run smoke:browser
git diff --check
```

改动 source-bridge 时额外：
```
npm run smoke:bridge
```

# 交付格式（每条任务一份）
1. 一句风险摘要
2. 关键 diff（unified diff，最多 60 行）
3. 验证命令与预期输出片段
4. 是否破坏现有功能：是 / 否；若是，列出已验证的回退路径
5. 是否涉及敏感字段：是 / 否；若是，列出已经在哪走 src/redact.js

# 千万不要做
- 把任何"用户配置 / 私有桥地址 / 用户填的 API URL"写进 src/config.js 的字面默认值
- 不要新增 npm 依赖（除非任务里显式允许）
- 不要做大爆炸重写（每个 PR 单独可 revert）
- 不要把 accessToken 或 serverUrl 直接拼到 console.log / setMessage / 错误信息字符串里
- 不要在 README / CHANGELOG 重复罗列修改
- 不要让 vm / worker_threads 沙箱内有 process / globalThis / 原生 require
```

---

## 4. 提示词 B — 修正敏感字段版

> 这版是 A 的修正版，专门强调敏感字段脱敏。多数内容与 A 重复；选其一即可。
> 选这版如果：你想让 codex 第一眼就锁定"敏感字段"作为重点。

```text
# 角色与目标
你是这个开源项目（Emby Music Web / Aurora Music）的高级代码审计与重构工程师。
请按 **"先安全 → 再健壮 → 再功能 → 再优化"** 的顺序，根据下面的"项目背景 + 任务清单 + 验收点"逐项交付。
每完成一项，在交付里给一段简短的 diff 摘要（不超 8 行）+ 一条可手动复现的验证命令。

# 项目背景
- 代码位置：D:\emby-music-web（git 跟踪，已发到 v0.93.229；当前分支 master）
- 前端是纯静态：app.js（26k 行 / 920 KB）、styles.css（24k 行 / 570 KB）、index.html、src/*.js（config、format、lyrics、emby-api、external-source-api、storage、accessibility、color-extractor、performance、state-management、theme、ui-helpers）
- 服务端：scripts/source-bridge.js（Node，无外部依赖；插件代码用 `vm` 执行）
- 测试：scripts/source-bridge-smoke.js、scripts/smoke-check.js、scripts/browser-smoke.js；命令 `npm run check`、`npm run smoke`、`npm run smoke:bridge`、`npm run smoke:browser`
- 没有构建步骤，没有 CI

# 安全任务（必须先做，按顺序）

## S1. 修复 source-bridge `/configure` 鉴权
- 在 scripts/source-bridge.js 里新增一个 `--api-token` / `SOURCE_BRIDGE_API_TOKEN` 环境变量，监听时只接受带 `X-Bridge-Token: <token>` 的 POST；无 token 的请求一律 401。
- token 不存在时强制要求带 `--allow-anonymous-configure=false`（默认 false），启动日志显眼地警告。
- 文档更新 README.md 的"音源桥"段落。

## S2. 修复 `/remote-stream` SSRF
- 新增 `BLOCKED_REMOTE_HOSTS`（含 localhost / 127.* / ::1 / 10.* / 172.16-31.* / 192.168.* / 169.254.* / *.local / *.internal）。
- /remote-stream 接到 `url` 后必须 resolve 一次（如 `dns.lookup`），若结果命中黑名单直接 403。
- 仅允许 http/https scheme；大小写归一化；禁止 `data:`、`javascript:`。
- 出口 CORS 收紧：当 `Origin` 不在白名单（默认 `*`，改为受控）时不返回 `Access-Control-Allow-Origin`。

## S3. 插件清单与插件代码签名校验
- 引入 manifest 内的 `signature` 字段（用 node `crypto` + 公钥清单）。
- 启动时从 `EMBY_BRIDGE_TRUSTED_KEYS` 环境变量加载公钥；校验失败立即拒绝该插件。
- 保留 `--allow-unsigned-plugins` flag 用于本地开发，但默认 false；启动日志警告。
- 该任务**不影响**已有 fixture / smoke，但要新增最小签名 fixture。

## S4. 修复 `restorePluginTrackFromSnapshot` 的任意 `pluginUrl` 注入
- `?track=<JSON>` 里的 `pluginUrl` 必须命中已加载 manifest 中存在的 plugin 才允许走 `loadPluginRuntime`。
- 未命中的直接 404；不允许 `createRuntimePluginFromSnapshot` 接受任意 URL。

## S5. 改用更稳的隔离
- 把 `vm.createContext(...)` 替换为 `node:worker_threads` + `workerData` 序列化交互；每个插件独立 worker。
- 通信走 `parentPort.postMessage` 白名单方法（仅 search / getMediaSource / getLyric）。
- 给 worker 加 3 秒 CPU 时间预算与 256 MB RSS 上限（`resourceLimits`）。

## S6. 前端加 CSP + SRI
- index.html 加：
  ```html
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' https: data: blob:; media-src https: http://localhost:* http://127.0.0.1:*; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https: http://localhost:* http://127.0.0.1:*; object-src 'none'; base-uri 'self'; frame-ancestors 'none';">
  ```
- 联调确认顶部图标 SVG 不被拦；若被拦再放宽对应源。
- 加 `referrer` 与 `X-Content-Type-Options: nosniff` 在 index.html 同源服务脚本里（README 文档）。

## S7. 移除 `DEFAULT_EMBY_LYRICS_SOURCE_BRIDGE_API_URL` 硬编码 IP
- src/config.js 删掉这个 key；改为设置页"歌词源"里让用户自行填写；并把 login sheet 里"音源桥"提示去掉对它的暗示。
- 留 ENV 入口：`process.env.SOURCE_BRIDGE_LYRIC_API_URL`（不在前端曝光）。

# 健壮性任务

## R1. 删除从未使用的 6 个文件
- 删 src/state-management.js、src/accessibility.js、src/color-extractor.js、src/performance.js、src/theme.js、src/ui-helpers.js（先 grep 确认 app.js / index.html / scripts 全部 0 引用；如有引用，一并迁移）
- 更新 app.js / index.html 的 `<script>` 列表；
- 更新 sw.js 的 APP_SHELL；
- 在 CHANGELOG 列入"v0.94.x 移除未使用模块"。

## R2. 统一化前端 helper
- 仅保留 src/{format, lyrics, emby-api, external-source-api, storage, config}.js；新增 src/dom-helpers.js 提供安全的 `appendLoading(container, text)`、`appendEmpty(container, opts)`、`escapeHtml` 重复但统一命名；
- 所有 `innerHTML = `... `${X}` ...``（app.js 第 25419 / 25440 / 25444 行外加全文 40 处内联）改为 `createElement + textContent`，或用模板 + `escapeHtml(X)`，并跑一遍回归 smoke。

## R3. SW 升级提示
- sw.js 的 install 不再 `skipWaiting()`；新 SW 等到收到 `SKIP_WAITING` 消息后才激活（app.js 已有版本提示逻辑，确认联通）。
- cacheFirst 改为 stale-while-revalidate 以减少旧资源阻塞。

## R4. 队列持久化换 IndexedDB
- 新增 src/idb-queue.js：
  - 提供 `saveQueue(state)`、`loadQueue(session)`，按 session 分割；
  - 上限 10000 条；
  - 保留 localStorage 作为最后兜底（仅 80 条），但优先 IDB。
- 不破坏 storage.js 现有接口，向后兼容。
- 加 browser-smoke 验证：刷新后队列存在。

## R5. 拆 app.js
- 拆出 app/shell.js、app/library.js、app/player.js、app/queue.js、app/lyrics.js、app/search.js、app/settings.js、app/bridge.js 等；
- main.js 只做 wiring；
- 保持无构建（用 `<script type="module">` + 浏览器原生 ESM，注意浏览器的缓存策略和 `app.js?v=…` query 替换）。
- 若一次拆完动静过大，可以按"先抽出 player + queue"两片，再后续发版拆剩余的；每片要保证 `npm run check` 和 smoke 通过。

## R6. 状态层收敛
- 引入 src/store.js（小型 pub/sub，类似 state-management.js 那种但 100 行内），app.js 内的 `state.x = y` 改成 `store.set({x: y})`；
- 派生数据（filteredTracks / filteredAlbums）改为订阅者按需计算 + `requestIdleCallback` 防抖。

# 功能任务

## F1. 本地数据导出/导入
- 设置页"维护"区加按钮：导出队列 / 收藏 / 最近 / 偏好 设置 为 JSON；导入时版本号校验，向用户展示将覆盖的字段；冲突时弹确认。

## F2. 歌词同步淡入淡出 + 卡拉 OK 高亮
- 现有歌词同步已经成熟；加 0.12s 过渡和前景 / 次行两级颜色梯度。

## F3. 主题色提取
- color-extractor.js 重写并接入 player-runtime：在每次 current track 切换时对当前封面（带 CORS）调一次采样，落到 CSS 变量 `--now-accent`。
- 加 switch 设置："封面取色 开/关"。

## F4. 系统暗色模式跟随
- theme.js 已实现；接入：监听 `prefers-color-scheme`，加设置项"主题：浅/深/跟随系统"。

## F5. 全键盘 cheat sheet UI
- 按 `?` 弹出当前所有快捷键；accessibility.js 已导出 `getKeyboardShortcuts`。

## F6. 播放回放增益（ReplayGain）轻量版
- 用本地存储专辑级 / 曲目级 ReplayGain tag（若 Emby 媒体包含）；首次播放按 -7 LUFS + album gain 调整 WebAudio GainNode。

## F7. 播放睡眠定时淡出
- 现有硬改 wait → 末 60 秒 线性 fadeOut。
- 在设置睡眠定时弹层加选项"淡出时长：30 / 60 / 90 秒"。

# 验收约定
- 每次发布前必须跑：
  ```
  npm run check
  npm run smoke
  npm run smoke:bridge
  $env:BROWSER_SMOKE_RUN='1'; $env:BROWSER_SMOKE_TIMEOUT_MS='90000'; npm run smoke:browser
  git diff --check
  ```
- 若改 source-bridge，还必须跑：
  ```
  npm run smoke:bridge
  ```

# 交付格式
对每项任务（S1-R5-F7）：
1. 一句风险摘要；
2. 关键 diff（用 unified diff，最多 60 行）；
3. 验证命令与预期输出片段；
4. 是否破坏现有功能：是/否，若是，列出已验证的回退路径。

# 不要做
- 不要新增依赖（除非显式指明）；
- 不要做大爆炸重写（每个 PR 必须能 `git revert`）；
- 不要改 Emby 服务器契约（除非任务 S/R/F 中明列）；
- 不要在 README / CHANGELOG 重复罗列修改——只记到 RELEASE_NOTES.md 的"未发布"段。
```

---

## 5. 对话脚本 C — 开场对话（推荐先用这个）

> 这是最近一次发送的版本，最聚焦。每段复制走即可。
> 推荐场景：你想让 codex 一次性读完 context 然后从 M1 开始动手。

```text
# 角色
你是 Emby Music Web 项目（仓库在当前工作目录，分支 docs/audit-2026-07 即将合并到 master）的高级代码审计与重构工程师。

# 第一件事
通读 docs/audit-2026-07.md。这是 2026-07-20 完成的代码审计索引文档，包含全部任务、敏感字段规则、里程碑顺序（M1-M7）、验收约定、交付格式、禁区清单。读完先回答我对清单的理解，再开始动手。

# 你必须遵守的全局约束
1. 敏感字段（serverUrl、serverId、userId、accessToken、deviceId、deviceName、externalSourceApiUrl、lyricsSourceBridgeApiUrl、以及 localStorage / IndexedDB 里任何 host）严禁：
   - 写进 src/config.js 的字面默认值；
   - 出现在 console.log / setMessage / 错误信息字符串里；
   - 出现在"复制诊断"输出里，除非用户在当前会话主动要求并已确认；
   - 上报给任何外部端点。
2. UI 显示 server URL 一律走 §0.2 的脱敏形式（如 192.168.*.*:****）；token 仅显示 ***<last4>。
3. 不新增 npm 依赖；不改 Emby 服务器契约；不动 README / CHANGELOG 的细节描述（写到 RELEASE_NOTES.md 的对应段）。
4. 每个 PR 单独可 git revert；禁止大爆炸重写。

# 你的第一个目标
按 M1 安全收口推进：一共 4 项 + 1 个共用底座，1 个 PR 一次性发：
- 共用底座：新增 src/redact.js（redactUrl / redactServer / redactToken），scripts/smoke-check.js 加单元用例。
- S1 source-bridge /configure 加鉴权（--api-token / X-Bridge-Token）。
- S2 /remote-stream SSRF 防护（BLOCKED_REMOTE_HOSTS + dns.lookup + scheme 白名单 + CORS 白名单）。
- S6 index.html 加 CSP + referrer meta。
- S7 移除 src/config.js 里所有用户私有配置的字面默认值，运行时从 localStorage 读。
- S8 诊断信息全量脱敏（app.js 的复制诊断按钮、setMessage、console.log 全走 redact）。

# 验收命令（M1 提交前必须全绿）
npm run check
npm run smoke
npm run smoke:bridge
$env:BROWSER_SMOKE_RUN='1'; $env:BROWSER_SMOKE_TIMEOUT_MS='90000'; npm run smoke:browser
git diff --check

# 你的交付格式（每个任务一份）
1. 一句风险摘要
2. 关键 diff（unified diff，最多 60 行）
3. 验证命令与预期输出片段
4. 是否破坏现有功能：是/否，回退路径
5. 是否涉及敏感字段：是/否，已经在哪走 src/redact.js

# 开始
请先用 5-10 行告诉我：
- 你对 docs/audit-2026-07.md 的理解摘要；
- 你打算怎么拆 M1 的几个 PR 顺序（哪些可以并入一个、哪些要拆开）；
- 你打算先动哪个文件、为什么。

我同意后你再动代码。任何"我猜是这样"的不确定点，先停下来问我。
```

---

## 6. 对话脚本 D — 三轮拆解版（备用）

> 当你怀疑 codex 一次吃不下 5-10 节内容时用。
> 三轮：① 读文档复述理解 ② 拆 PR 范围 ③ 开干。

### 第 1 轮（让 codex 先读文档、复述理解）

```text
你是这个 Emby Music Web 项目的高级重构工程师。通读 docs/audit-2026-07.md（也请 cat 一下它确认是 270 行）。读完后用 8-15 行告诉我：(1) 文档里说的全局约束有哪些；(2) 三个里程碑 M1 / M2 / M7 各自要做什么；(3) 哪些任务涉及"敏感字段"。先不要动代码。
```

### 第 2 轮（明确首单 PR 范围）

```text
OK，目标定为 M1，一次性包含：S1 / S2 / S6 / S7 / S8 共 5 项；另需新增 src/redact.js 作为共用底座。请你：
1. 列出这 5 项 + redact.js 的 PR 拆分建议（哪些并一个 PR、哪些拆开）；
2. 简述每个文件的关键改动点（不写代码）；
3. 列出我会审的 diff 焦点。
仍然不要动代码。
```

### 第 3 轮（开始干）

```text
同意你的拆分。开始 M1 第一刀：先只动 src/redact.js + scripts/smoke-check.js 的单元用例。完成后给我：
- 文件路径
- unified diff
- npm run check 的输出片段
等我审完再说下一步。
```

---

## 7. 怎么给 codex 发

按场景选一个即可：

| 场景 | 用谁 | 怎么给 |
|---|---|---|
| codex 能直接读仓库文件（CLI / IDE 集成 / agent SDK） | **C** | 把它贴在第一条对话，告诉 codex 自己 `cat docs/audit-2026-07.md` |
| codex 不读文件、只能看上下文窗口 | **A 或 B** | 整段贴上 C 也行 + 也贴 audit 链接 |
| codex 上下文吃不动 | **D** | 三轮逐条发 |
| 只想 review 一个具体小改动 | 不需要整版 | 直接说："改 src/redact.js，按 audit §S8 第一条" |

---

## 8. 看到 codex 响应后该做什么

| 你看到 | 说明 | 你怎么回 |
|---|---|---|
| codex 复述 §0.x 的规则和对 §3 里程碑的理解 | 它读懂了 | "OK，开干" |
| codex 反问几个澄清问题（如"敏感字段里 token 是否要记哈希？"） | 正常 | 回答它再继续 |
| codex 准备一次性写很多文件跨越多个里程碑 | 越界了 | "停，先做 M1，redact.js 优先，单独 PR" |
| codex 提出"加 ESLint / 加 vite 打包"等额外建议 | 偏离约束 | "暂时不做，audit 文档禁区清单里写了" |
| codex 推完 M1 第一个 PR | 验收点 | 跑 §验收命令，逐项给"✅/❌" |
| codex 提了一个新需求（如想顺手改 index.html） | 偏离当前 PR 范围 | "这个放下一刀，本次只动 §S8 涉及的" |

---

## 9. 关联文档

- [docs/audit-2026-07.md](./audit-2026-07.md) — 完整审计 + 任务清单 + 里程碑
- [RELEASE_NOTES.md](../RELEASE_NOTES.md) — "未发布"段；每个 PR 完成后追加
- [docs/release.md](./release.md) — 发版流程

---

> 最后更新：2026-07-20 · 计划基线：v0.93.229
