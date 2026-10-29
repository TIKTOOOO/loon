# loon

自用 Loon 远程规则和插件库。只发布规则、插件与使用说明；第三方订阅继续使用原上游。

## 资源

| 文件 | 用途 | 远程链接 |
| --- | --- | --- |
| 规则/Apple直连.list | 直连补丁 | [Raw](https://raw.githubusercontent.com/TIKTOOOO/loon/main/%E8%A7%84%E5%88%99/Apple%E7%9B%B4%E8%BF%9E.list) |
| 规则/微信直连.list | 直连补丁 | [Raw](https://raw.githubusercontent.com/TIKTOOOO/loon/main/%E8%A7%84%E5%88%99/%E5%BE%AE%E4%BF%A1%E7%9B%B4%E8%BF%9E.list) |
| 规则/国内服务直连.list | 直连补丁 | [Raw](https://raw.githubusercontent.com/TIKTOOOO/loon/main/%E8%A7%84%E5%88%99/%E5%9B%BD%E5%86%85%E6%9C%8D%E5%8A%A1%E7%9B%B4%E8%BF%9E.list) |
| 插件/携程开屏广告补丁.lpx | 携程广告精确拦截 | [Raw](https://raw.githubusercontent.com/TIKTOOOO/loon/main/%E6%8F%92%E4%BB%B6/%E6%90%BA%E7%A8%8B%E5%BC%80%E5%B1%8F%E5%B9%BF%E5%91%8A%E8%A1%A5%E4%B8%81.lpx) |
| 插件/wechat_noads.lpx | 微信广告部分过滤（覆盖限制见说明） | [Raw](https://raw.githubusercontent.com/TIKTOOOO/loon/main/%E6%8F%92%E4%BB%B6/wechat_noads.lpx) |
| 插件/twitter_noads.lpx | X / Twitter 信息流推广过滤 | [Raw](https://raw.githubusercontent.com/TIKTOOOO/loon/main/%E6%8F%92%E4%BB%B6/twitter_noads.lpx) |

## X / Twitter 广告插件

[twitter_noads 使用说明与一键导入](twitter_noads.md)。通过本仓库脚本过滤明确标记的推广条目，需启用 MITM；尚待 App 真机验证。

## 微信广告插件

[wechat_noads 使用说明与一键导入](wechat_noads.md)。支持公众号文章接口和部分小程序独立广告；公众号列表、视频号、朋友圈广告卡片未实现可靠清除，尚待真机验证。

## 引用方式

将以下条目合并进本地配置已有区块，不要重复创建同名区块。三项直连订阅放在其他远程规则之前。

```ini
[Remote Rule]
https://raw.githubusercontent.com/TIKTOOOO/loon/main/%E8%A7%84%E5%88%99/Apple%E7%9B%B4%E8%BF%9E.list, policy=DIRECT, tag=Apple直连, enabled=true
https://raw.githubusercontent.com/TIKTOOOO/loon/main/%E8%A7%84%E5%88%99/%E5%BE%AE%E4%BF%A1%E7%9B%B4%E8%BF%9E.list, policy=DIRECT, tag=微信直连, enabled=true
https://raw.githubusercontent.com/TIKTOOOO/loon/main/%E8%A7%84%E5%88%99/%E5%9B%BD%E5%86%85%E6%9C%8D%E5%8A%A1%E7%9B%B4%E8%BF%9E.list, policy=DIRECT, tag=国内服务直连, enabled=true

[Plugin]
https://raw.githubusercontent.com/TIKTOOOO/loon/main/%E6%8F%92%E4%BB%B6/%E6%90%BA%E7%A8%8B%E5%BC%80%E5%B1%8F%E5%B9%BF%E5%91%8A%E8%A1%A5%E4%B8%81.lpx, tag=携程开屏广告补丁, enabled=true
```

也可在 Loon 的规则订阅或插件页面添加对应 Raw 链接，直连规则策略选择 DIRECT。

## 优先级与迁移

Loon 3.0.3 及以上的规则来源优先级：本地规则 > 插件规则 > 订阅规则。把直连订阅排在前面，只能保证其在订阅规则中的顺序，不能覆盖插件中的拦截。

为保持旧配置的分流行为，保留本地 [Rule] 中已有的 Apple、微信、国内服务精确 DIRECT 补丁。远程列表用于独立订阅与后续维护；只有真机确认插件不存在冲突后，才考虑删除相应本地补丁。不要删除 FINAL。

携程补丁从主配置迁至插件后，主配置中的重写仍然优先。初次接入保留本地重写，验证插件更新及命中后，才删除原有三条携程重写；将本插件排在其他通用广告插件之前。MITM hostname 中其他域名继续保留。

## MITM 与验证

携程 HTTPS 拦截需要在 Loon 本地生成或导入证书、安装并完全信任证书，启用 MITM。本插件只声明 m.ctrip.com 和 ma-adx.ctrip.com，不提供证书或密钥。不要关闭服务器证书验证。

在手机端更新远程资源，检查规则条数与请求命中；携程冷启动后验证开屏、登录、搜索、下单和支付。接口可能随 App 更新变化，本仓库不保证所有版本均能去广告。遇到问题可先关闭本插件，恢复原有本地补丁。

## 来源

规则和携程补丁整理自既有自用配置；保留原有域名与重写表达式，不额外扩大匹配范围。国内服务列表包含 kelee.one，以沿用资源域名直连设置。

携程规则参考：[blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script/blob/master/rewrite/Loon/Advertising/Advertising.plugin)，相关上游内容权利归原作者，使用和再分发应遵循其许可。

语法和优先级参考：[Loon 规则](https://nsloon.app/docs/Rule/)、[订阅规则](https://nsloon.app/docs/Rule/sub_rule/)、[插件](https://nsloon.app/docs/Plugin/)。
