# hexu-app

禾序分销批发中台移动客户端，承载用户商城、代理业务与商家操作，通过 hexu-backend 与 hexu-admin 共享业务数据。

## 项目简介

使用 uni-app 和 Vue 3 开发，提供 H5 和微信小程序构建。现有页面目录包含 M01–M64、G01–G64 共 128 个页面入口，由统一页面组件、布局数据和业务绑定组合呈现。页面入口数量不代表全部功能均已完成生产验收。

- 用户商城：浏览商品、规格选择、购物车、订单结算、物流和退换货。
- 个人账户：积分、优惠券、地址、消息、售后和代理申请。
- 代理业务：团队关系、客户、收益、考核及提现。
- 商家操作：商品库存、订单履约、售后审批、财务、营销、报表和运营配置。

原有视觉布局集中维护，数据层通过统一 API 读取/提交订单、库存和资金相关业务。微信授权与真实支付、退款、转账需要后端渠道接入；本地身份切换和渠道模拟仅供开发联调。

## 技术栈

- Vue 3.4、JavaScript、uni-app 3 alpha。
- @dcloudio/uni-h5、@dcloudio/uni-mp-weixin。
- Vite 5.2、Sass、vue-i18n。
- Node.js 自定义 CLI 启动脚本、npm 锁文件。

## 关联仓库

| 项目 | 说明 | GitHub |
| --- | --- | --- |
| hexu-backend | 后端 API、业务规则与数据库 | [hexu-backend](https://github.com/jiangyi3265/hexu-backend) |
| hexu-admin | 平台 Web 管理后台 | [hexu-admin](https://github.com/jiangyi3265/hexu-admin) |
| hexu-app | 用户、代理与商家移动端 | [hexu-app](https://github.com/jiangyi3265/hexu-app) |

## 快速启动

准备 Node.js 22+、npm；先按照 hexu-backend README 启动本地后端。推荐将三个仓库放在同一级目录：

```text
workspace/
  hexu-backend/
  hexu-admin/
  hexu-app/
```

然后在 hexu-app 中执行：

```bash
npm ci
npm run dev:h5
```

H5 地址为 http://127.0.0.1:4177，Vite 将 /hexu 转发至本机后端 8088。开发代理在 Node 服务端读取 hexu-backend/.hexu-local/dev-key.txt，不将密钥打包给浏览器；也兼容旧的 RuoYi-Vue 目录。后端不在相邻目录时，可先在 PowerShell 设置 `$env:HEXU_BACKEND_DIR='你的后端绝对路径'`。

使用后端演示数据时的入口：

| 身份 | 本机入口 |
| --- | --- |
| 用户 | http://127.0.0.1:4177/#/pages/M03/index?member=201&shop=2 |
| 代理 | http://127.0.0.1:4177/#/pages/M33/index?member=104&shop=2 |
| 商家 | http://127.0.0.1:4177/#/pages/G03/index?member=101&shop=2 |

这些演示身份只适用于 localhost 开发服务；正式身份由服务端授权控制。

### 构建

```bash
npm run build:h5
npm run build:mp-weixin
```

H5 输出在 dist/build/h5，小程序输出在 dist/build/mp-weixin。使用微信开发者工具导入后者；需自行配置 manifest.json 的 mp-weixin.appid 和合法 API 域名，正式渠道配置由后端保管。运行 `npm test` 执行 `tests/` 中的回归测试；自动化结果和构建成功不代替真实页面验收。

H5 本地联调无需 .env；部署时将 .env.example 复制为 .env.production，设置公开的 VITE_HEXU_API 地址，再构建。该变量会进入客户端，禁止填写密钥。生产 H5 同源部署时也可保留空值，由服务器转发 /hexu。

微信小程序本地联调用 `npm run build:mp-weixin`；需要固定版本进行测试时用 `npm run build:mp-weixin:atomic`。正式发布必须用 `npm run build:mp-weixin:release`，并先设置 `VITE_HEXU_API` 为可从微信访问的公网 HTTPS 接口源站（不含 `/hexu` 路径）。正式命令会先在独立目录完成构建与 WXML/WXSS 校验，再发布到 `dist/releases/mp-weixin/<版本号>`，请导入输出的版本目录，不要覆盖开发者工具正在打开的旧目录。发布构建会拒绝空值、HTTP、localhost 和内网地址，避免把 `127.0.0.1:8088` 打进正式包。还需在微信公众平台配置对应的 request、downloadFile、uploadFile 合法域名；本地开发者工具展示成功不能替代真机发布验收。

### 本地模拟与正式渠道复测

登录页仅保留微信登录，手机号仍可用于收货地址和其他业务联系方式。本机开发包通过既有 `/hexu/dev/login` 登录开发账号，页面显示“开发环境登录，不调用微信授权”。明确点击“进入浏览”会清除本地会员会话，刷新后继续游客浏览，会员操作仍要求登录。

后端的 `hexu-dev` 配合 `hexu.sandbox.enabled=true` 用于缺配置时的本地流程模拟。七份协议正文由后端本地初始化或迁移脚本发布；未发布时客户端不能以占位协议代替。模拟资金结果仍带 `sandbox` / `SANDBOX-` 标识，不能作为真实微信、资金到账或承运商验收记录。

配置齐全后关闭 `hexu.sandbox.enabled`，以正式 profile 启动后端，设置公网 HTTPS `VITE_HEXU_API` 并重新执行发布构建。正式上线前需将后端 `policies/operator-info.json` 中的占位主体资料换成真实登记信息，升级协议版本并重新发布，同时核实商城公示信息、客服渠道、真实授权及外部回执。原生复测应导入完整的同一次构建；不要混用 HBuilder 增量生成文件和 CLI 构建的 WXML/WXSS/JS。

## 项目结构

```text
pages/M01…M64/       用户与代理页面入口
pages/G01…G64/       商家业务页面入口
components/         DesignScreen、UiBlock、Photo 等页面组件
data/backend.js     后端请求、鉴权状态与业务绑定
data/store.js       客户端状态、导航及本地持久化
data/screens.js     页面布局和文案数据
data/catalog.js     页面目录
scripts/run.mjs     uni-app CLI 启动与输出路径处理
scripts/backend-proxy.mjs  仅本机可用的开发接口代理
static/             商品素材和图标
styles/             公共视觉样式
pages.json          uni-app 页面注册
manifest.json       平台构建配置
```

## 简历描述示例

参与禾序分销批发移动端开发，基于 uni-app 与 Vue 3 复用用户、代理和商家页面体系，完成 H5 与微信小程序构建。通过统一 API 对接购物车、订单售后、积分、代理收益及商家经营操作，并保留既定页面视觉设计。
