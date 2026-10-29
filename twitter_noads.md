# twitter_noads

X（Twitter）iOS App 信息流推广过滤，v1.0.0，2026-10-29。**尚未在你的 X App 版本上真机验证，不保证所有广告均可去除。**

## 安装

[一键导入 Loon](https://www.nsloon.com/openloon/import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2FTIKTOOOO%2Floon%2Fmain%2F%25E6%258F%2592%25E4%25BB%25B6%2Ftwitter_noads.lpx)

[插件直链](https://raw.githubusercontent.com/TIKTOOOO/loon/main/%E6%8F%92%E4%BB%B6/twitter_noads.lpx) · [过滤脚本](https://raw.githubusercontent.com/TIKTOOOO/loon/main/%E6%8F%92%E4%BB%B6/scripts/twitter_noads.js)

插件自动引用同仓库脚本，无需单独安装脚本或规则订阅。

1. 导入并更新插件和脚本资源；如果 Loon 询问是否允许脚本，需允许本插件脚本运行。
2. 开启 MITM，在 iOS 安装并完全信任自己的 Loon 证书。不要关闭服务器证书验证。
3. 完全退出 X 后重开并刷新首页。在 Loon 请求记录中检查 api.x.com / api.twitter.com 的时间线请求是否成功解密及匹配本脚本。已有缓存不会因规则安装立即消失。
4. 如有其他 X 去广告脚本，先暂停，避免同一响应的脚本抢先匹配；不要启用其他插件要求的宽泛媒体域名封锁。

手动合并到已有区块：

```ini
[Plugin]
https://raw.githubusercontent.com/TIKTOOOO/loon/main/%E6%8F%92%E4%BB%B6/twitter_noads.lpx, tag=twitter_noads, enabled=true
```

## 实现与边界

- 目标：首页推荐/关注、帖子详情回复、搜索和个人时间线等使用已列出 GraphQL 操作或旧版 timeline JSON 的响应。
- 删除 entries / items / moduleItems 数组中明确带有 promotedMetadata、promoted_metadata 或推广条目 ID 的内容。保留普通帖子、回复、关注推荐、游标和翻页信息。
- 仅修改命中接口且 HTTP 200 的有效 JSON；无广告、错误响应、未知格式、解析失败或超出处理上限时原样放行。不会改写登录、发帖、点赞、私信、支付接口。
- 不封锁 api.x.com 或图片/视频 CDN，不因帖子正文出现“广告”或“promoted”字样就删除。
- 未实现视频流中嵌入的贴片、直播赞助、创作者正文软广或没有明确推广标记的广告。不保证新接口、二进制协议、证书固定或其他不可解密流量上的效果。部分操作的证据来自公开 Web 时间线结构，不能当作当前 iOS App 实测结果。
- 脚本无网络请求、持久化存储或日志输出，不收集 Cookie、Token、账号或浏览内容。MITM 范围内的数据由你设备上的 Loon 本地处理。

## 检查与回退

已进行合成响应样例测试（推广条目、混合模块、翻页游标、普通引用帖、坏 JSON 等）与精确 URL 匹配测试；不等同于 Loon 内核和 iPhone 真机验证。

若广告仍存在，请提供 X/Loon 版本、广告所在页面，以及请求记录里相关主机和路径，先确认是否命中。不要发送 Cookie、Authorization、Token 或完整私信内容。若首页/详情加载异常，关闭本插件并重开 X 即可回退。

## 来源

脚本与配置独立编写，没有复制第三方去广告脚本。接口结构依据：[trekhleb 的 X 时间线类型研究](https://github.com/trekhleb/trekhleb.github.io/blob/master/src/posts/2024/api-design-x-home-timeline/types/x.ts)；推广标记依据：[Twitter Prime 作者公开实现](https://greasyfork.org/en/scripts/474045-twitter-prime/code)。

语法参考：[Loon Script](https://nsloon.app/docs/Script/)、[新版兼容说明](https://nsloon.app/docs/Script/script_v2/)、[导入链接](https://nsloon.app/docs/Scheme/)。
