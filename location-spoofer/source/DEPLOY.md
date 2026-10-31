# 自用定位插件：安装、Cloudflare 与备份

维护版本：2026-10-31。自动测试通过不等于 iOS 真机验证通过，真机记录见 TESTING.md。请停用原版或其他定位修改插件，避免同一请求重复改写。

## 1. 安装公开插件

发布后在 Loon 添加：

`https://raw.githubusercontent.com/TIKTOOOO/loon/main/插件/ios-location-spoofer.lpx`

保持已有的 MITM 证书安装与完全信任。插件只包含定位接口所需的主机名，不要扩大到全部 Apple 域名。插件内“启用定位修改”是本地最高优先级开关：关闭后两个处理阶段均直接放行；它不能清除 iOS 定位缓存。

## 2. Cloudflare 网页后台部署（无需命令行）

1. Workers & Pages 新建 Worker，名称 `ios-location-picker`。
2. 将 `location-picker/cloudflare-webui/worker.js` 整个文件替换默认 Worker 代码并部署。不要复制 GitHub HTML 页面源码。
3. 创建新的 Workers KV 命名空间 `ios-location-picker-kv`，在 Worker 绑定名称 **LOC_KV**；不要使用上游作者的 namespace ID。
4. 添加类型为 Secret 的 **TOKEN**，使用自己的随机长口令，不写进公开仓库；之后使用同一口令配置手机。
5. `/health` 应返回 `ok:true, kv:true, tokenConfigured:true`。没有口令访问地图或配置应返回 403。
6. 打开 `https://你的Worker地址/?token=你的口令`。选点、保存后再读取 `/loc.json?token=你的口令` 核对坐标。初次未保存的服务默认停止修改。

Worker 必须可由手机通过 HTTPS 访问。不要在配置接口前加交互登录页，否则 Loon 得到 HTML 而不是 JSON。口令配置接口仍应启用鉴权。

自定义域名可在 Worker 设置的 Domains & Routes 绑定；不需要自定义域名也可以使用 workers.dev。Leaflet、地图瓦片、搜索与海拔服务仍需要网络连接，不依赖原作者服务器。

## 3. Loon 首次连接

插件内“远程配置URL”填写：

`https://你的Worker地址/loc.json?token=你的口令`

“配置服务器”和“配置Token”留空，避免同时维护两套设置。以后通过网页选点或 [地图分享快捷指令](SHORTCUT.md) 改位置即可。

日常顺序：Loon 总开关及插件开启 → 网页/快捷指令保存 → 等待配置刷新 → 手动关闭再开启系统定位服务 → 打开地图验证。

原脚本的本地配置缓存有效期最长 5 分钟；缓存命中时先用旧值，再异步刷新，因此一次请求后可能下一次才采用新坐标。15 分钟定时同步是补充，不代表每天必须等 15 分钟。Cloudflare KV 还有最终一致性传播延迟，不能保证 60 秒内生效。

日志 `source=remote-fetch` / `remote-cache` 和采用的 `lat/lng` 用于确认脚本已读取；网页只能确认服务器保存，不代表 Loon 已读取。修改精度会被原脚本按最小改写规则应用；海拔等字段仍按上游行为透传，不能当作已修改海拔。

恢复时先关闭插件内部“启用定位修改”，检查 `action=pass-through`；手动关开定位服务并重新打开地图。若仍显示旧位置，按真机结果继续排查缓存；不承诺立即恢复，也不要求为了使用网页而关闭 Loon 总开关。

## 4. 私库与自动同步

私库 `TIKTOOOO/ios-location-spoofer-private` 是独立副本，不是 public Fork；已备份上游历史，维护修改在 main。
`Archive upstream and propose update` 每日北京时间 09:00 运行，也可手动运行。上游全部可获取分支/标签变化先保存到 `archive/时间/…`，再更新独立同步分支并建立更新请求；上游删库、分支删除或改写不会删除既有归档。

初始完整代码历史另有本地 Git bundle。Issues、讨论和 LFS 外部对象不在当前备份范围（初始源码无必需 LFS 对象）。上游不可访问时同步失败并保留已有备份，生产插件不受影响。

仓库 Settings → Actions → General 需要允许 Actions 创建 Pull Request。合并冲突须先解决；同步不自动合并或部署，修改合并后也要手动发布。Actions 定时任务可能排队，不保证精确到分钟。

## 5. 手动发布与回退

私库中配置 `production` 环境：

| 名称 | 类型 | 用途 |
|---|---|---|
| PUBLIC_REPO_TOKEN | Secret | 仅给 TIKTOOOO/loon Contents 读写权限，用于公开发布 |
| CLOUDFLARE_API_TOKEN | Secret | 仅目标账户所需 Workers 脚本与现有 KV 的部署权限 |
| CLOUDFLARE_ACCOUNT_ID | Variable | 自己的 Cloudflare 账户 ID |
| LOC_KV_NAMESPACE_ID | Variable | 自己的 KV namespace ID |

这些长期凭据必须由账户拥有者在服务的授权界面创建和保存，不放入聊天、公开源码或发布包。Worker 的 TOKEN 预先在 Cloudflare 配置，不作为公开构建参数。

审核更新请求，运行检查并合并后，在 Actions 手动运行 **Release reviewed location spoofer**，`ref` 填 `main` 或已审核提交 SHA。发布流程测试 → 生成公开源码 → 检查 Worker 打包 → 推送公开文件 → 部署同一提交的 Worker。公开插件引用按维护提交固定的脚本地址，旧插件不因脚本地址变化而加载另一版。

GitHub 与 Cloudflare 不是原子发布：如果公开推送成功而 Cloudflare 部署失败，Actions 会明确失败，旧 Worker 仍运行；修复后重跑同一 SHA。新旧接口保持兼容。Worker 不在每次部署时清空 KV。

回退时对先前已验证 SHA 再运行同一发布流程；公开旧版脚本保留在 `location-spoofer/releases/<SHA>/`，源码和上一生产 Worker 版本也仍保留。公开仓库历史中的对应源码可按发布提交查看。

本地复现：进入 `location-picker/worker` 执行 `npm ci`、`npm test`；在维护根目录执行 `node test-ios12-compat.js`、`node --test tests/local-disable.cjs`、`node tools/bundle-worker.mjs`。

## 接口

- `POST /api/parse`：Bearer 鉴权，JSON `{text:地图分享文本, datum:"auto"}`；成功返回 `ok,name,source,latitude,longitude,datum`，只解析不保存。datum 可选 `wgs84`、`gcj02`。
- `POST /set`：Bearer 或 token 查询参数鉴权，JSON `{lat:数字,lng:数字}`；成功 `ok:true,status:"saved"`，同时开启服务器修改状态。
- `POST /enable`：JSON `{enabled:false}` 停止服务器修改；不等于清除手机缓存。本地开关关闭时，即使服务器 true 也不能重新启用。
- `GET /loc.json?token=…`：Loon 配置。`GET /health` 不含坐标和口令。

解析仅访问列明的苹果/高德官方域名，每次重定向重新检查，最多 4 次跳转、总超时 8 秒、正文上限 256KB；不接受任意网址或页面中的裸数字。不能解析时不改动位置。
