# wechat_noads

Loon 微信广告过滤插件，v1.0.0，2026-10-23。**这是部分覆盖版本，尚未经过 iPhone 微信真机验证，不能承诺六类广告全部去除。**

## 导入

[一键导入 Loon](https://www.nsloon.com/openloon/import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2FTIKTOOOO%2Floon%2Fmain%2F%25E6%258F%2592%25E4%25BB%25B6%2Fwechat_noads.lpx)

[插件原始链接](https://raw.githubusercontent.com/TIKTOOOO/loon/main/%E6%8F%92%E4%BB%B6/wechat_noads.lpx)。也可复制此地址，在 Loon → 插件中添加。

```ini
[Plugin]
https://raw.githubusercontent.com/TIKTOOOO/loon/main/%E6%8F%92%E4%BB%B6/wechat_noads.lpx, tag=wechat_noads, enabled=true
```

只将条目合并进已有区块。插件包含规则和重写，无需另装规则订阅或 JS。

## 六类广告的覆盖情况

| 场景 | 本版本实现及限制 |
| --- | --- |
| 公众号之间/订阅号列表信息流 | 未实现可靠的卡片过滤；广告素材域名拦截可能影响部分图片，不能保证删除卡片。 |
| 公众号文章内 | 对 getappmsgad 的 JSON 广告字段清空，拒绝 cps_product_info 商品推广接口；仅适用于仍使用这些接口的平台广告。作者写在正文里的软文、图片不处理。 |
| 视频号 | 未实现可靠的信息流广告识别；不封锁正常视频接口，不承诺清除广告。 |
| 小程序启动广告 | 拦截已列出的独立广告域名和企迈广告请求；只覆盖部分小程序，不通用于所有小程序。 |
| 小程序内广告 | 同上；商户自有接口、内嵌素材、混合业务响应不作盲目修改。 |
| 朋友圈内广告 | 未实现可靠的卡片过滤；不会声称仅屏蔽素材就能删除朋友圈广告。 |

没有微信当前版本的接口样本，无法安全编写后三类信息流过滤。未加入猜测的朋友圈/视频号 API、共享 IP 或整个 weixin.qq.com、qq.com、wxs.qq.com 的拦截。

## 启用与兼容

1. 更新插件，开启 MITM，并在 iOS 安装、完全信任你自己的 Loon 证书。不要把证书或密钥上传到仓库，不要关闭服务器证书验证。
2. HTTPS 路径重写需要成功解密 mp.weixin.qq.com、webapi.qmai.cn；证书固定、非 HTTP 传输、接口变更或已有缓存均可能导致无效。
3. 使用支持 response-body-json-replace 的近期 Loon。旧版 Rewrite 语法在新版兼容，不要求启用远程脚本。返回体不是可解析的 JSON 时，文章过滤不应视为成功。
4. 已有本地 DIRECT 规则若覆盖广告域名，会优先于插件 Rule，造成域名拦截无效；核对请求记录中的实际命中，不要删除微信正常业务的直连配置。
5. 暂停其他微信广告插件，避免相同接口被提前拒绝。主配置 Rewrite 优先于插件 Rewrite，插件顺序也需要检查。

## 验证与回退

本地已做精确 URL 正反例、规则结构和隐私字段检查；这些不等同于 Loon 解析或微信真机效果验证。

更新资源后完全退出微信，再分别检查公众号正文/评论/图片、小程序启动/菜单/下单、视频号正常视频和朋友圈图片。确认请求记录命中了指定接口，且文章广告响应中的 advertisement_num 为 0、advertisement_info 为空数组。正常阅读、聊天、登录和支付也需检查。

广告视频/图片拦截可能留下空白卡片或触发重试。小程序的激励广告被拦截后可能不能领取奖励，插件不伪造观看完成。独立广告域名还可能影响其他 App。出现加载或业务异常时直接关闭 wechat_noads 并重开微信；不要继续叠加宽泛拦截。

如需进一步适配，请提供微信/Loon 版本、具体小程序名称、广告位置和已脱敏的请求主机/路径。不要公开 Cookie、Token、openid、手机号、聊天或支付内容。

## 接口依据与实现来源

本配置独立编写，仅按可核实的接口和精确域名定义行为，没有复制或重新分发受限制的 Kelee 插件/脚本。

- [NobyDa 的原始微信文章广告脚本](https://github.com/NobyDa/Script/blob/master/QuantumultX/File/Wechat.js)：用于核对 getappmsgad 及 advertisement_num / advertisement_info 字段；本插件采用 Loon 原生 JSON 字段改写，不包含该 JS。
- [社区维护者 wxs0625 的微信模块](https://github.com/wxs0625/loon-plugins/blob/main/blockAds_all.plugin)：用于核对小程序广告域名及企迈广告接口。社区名单是适配线索，不代表本设备已验证。
- [Loon Rewrite 文档](https://nsloon.app/docs/Rewrite/)、[新旧语法兼容说明](https://nsloon.app/docs/Rewrite/rewrite_v2/)、[导入链接格式](https://nsloon.app/docs/Scheme/)。

版本记录：v1.0.0 首次发布，部分覆盖，待真机验证。
