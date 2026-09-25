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

H5 输出在 dist/build/h5，小程序输出在 dist/build/mp-weixin。使用微信开发者工具导入后者；需自行配置 manifest.json 的 mp-weixin.appid 和合法 API 域名，正式渠道配置由后端保管。当前 package.json 中遗留的 test 脚本指向尚未提供的 tests 目录，不能将该命令视为已具备的测试套件。

H5 本地联调无需 .env；部署时将 .env.example 复制为 .env.production，设置公开的 VITE_HEXU_API 地址，再构建。该变量会进入客户端，禁止填写密钥。生产 H5 同源部署时也可保留空值，由服务器转发 /hexu。

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
