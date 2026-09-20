# GuitarLiveFlow · 手机看谱 / 大屏看词

弹唱时手机上看「和弦 + 歌词」并控制翻行，电脑或投影上同步显示大字歌词给观众；在家用电脑练琴时词谱和原图并排看。

## 四个页面

| 页面 | 地址 | 用途 |
| --- | --- | --- |
| 手机演出 | `/perform` | 控制端。和弦 + 歌词，点屏幕下方下一行、上方上一行，每次换行广播给大屏。选好歌后点顶栏的 `🖵` 生成大屏二维码和链接 |
| 大屏歌词 | `/display/:id` | 只读。当前句居中放大，前后句变淡，双击全屏，鼠标不动自动隐藏控件 |
| 电脑练习 | `/practice` | 本地控制，不广播。可并排显示原谱图片，或把多张原谱横向平铺铺满整屏（按 T 切换），支持移调、自动滚动 |
| 谱子管理 | `/admin` | 需要管理员密码。ChordPro 编辑器带实时预览，可上传原图 |

大屏链接跟着歌曲走：手机选好歌后点顶栏 `🖵`，弹窗里会出现这首歌的二维码和链接（形如
`https://你的域名/display/12`）。在大屏/投影上打开这个链接就能同步翻行，链接右侧可一键复制。
同一首歌的多个大屏和手机会连到同一个同步房间，不需要再手动填房间码。

## 谱子格式（ChordPro）

```
{title: 她}
{subtitle: 革命吉他制谱}
{key: E}
{capo: 4}

【前奏】
[C] [G] [Am] [F]

【主歌】
[C]她的眼[G]睛
[Am7]闪亮如灯[F]火
```

- 和弦写在方括号里，放在它开始弹的那个字前面。
- 每一行歌词就是大屏上的一句，也是翻行的最小单位。
- 段落标题独占一行，用 `【前奏】` 或 `{sov: 主歌}` 都可以。只有和弦没歌词的行（前奏/间奏）不会出现在大屏上，遇到时就继续停留在上一句歌词。
- `{key:}` 是移调的基准，`{capo:}` 只作展示。`#` 开头的行是注释。

`seed/` 目录下的 `.cho` 文件和同名图片会在数据库为空时自动导入，用来做示例。之后新增的
示例谱子可以用 `npm run seed` 补进来（按标题去重，已存在或已被删除的歌不会重复导入）。

## 本地开发

```bash
cp .env.example .env      # 改一下 ADMIN_PASSWORD
npm install
npm run dev               # 后端 :3000，前端 :5173
```

浏览器打开 <http://localhost:5173>。手机要在同一 Wi‑Fi 下访问电脑的局域网地址，例如 `http://192.168.1.10:5173`。

## 部署到服务器

需要 Docker 和已解析到服务器的域名。

```bash
git clone https://github.com/wnqnxbb/GuitarLiveFlow.git && cd GuitarLiveFlow
cp .env.example .env
# 编辑 .env：ADMIN_PASSWORD、DOMAIN
docker compose up -d --build
```

Caddy 会自动申请 HTTPS 证书，WebSocket 一并转发。数据库和上传的图片都在 `./data`，备份这个目录即可。

更新版本：`git pull && docker compose up -d --build`。

### 阿里云生产机（systemd 原生部署）

线上一台跑的不是 Docker，而是 systemd + 原生 Node：目录 `/opt/guitar-live-flow`，服务名
`guitar-live-flow`，由 Nginx 复用 `*.example.com` 证书反代到 `127.0.0.1:3000`。

一键更新：

```bash
ssh root@SERVER_IP bash /root/deploy-guitar.sh
```

脚本会按 `package-lock.json` 指纹跳过 `npm ci` 和 better-sqlite3 的源码编译（这两步在 CentOS 8
上因为没有 GLIBC 2.29、必须现场用 gcc-toolset-10 编译，原本是部署慢的主因）；每次部署还会自动把 `seed/` 里新增的谱子补进数据库。源码见
`deploy/deploy-server.sh`，改动后需同步到服务器 `/root/deploy-guitar.sh`。

进一步提速（2026-09-20 后）：

- `tsc` 开启增量编译，缓存放在仓库根的 `.cache/`（仅本机保留，gitignore 忽略），第二次起类型检查快一半左右；
- 按「上次构建提交 → 本次提交」的改动路径分别决定重建前端/后端：只改 `client/` 时不跑慢的
  server `tsc`，只改 `server/` 时不跑 vite；
- 重启后用轮询 `/api/health` 代替固定 `sleep 2`；`seed/` 目录树未变化时跳过导入。

实测（2 vCPU 阿里云 ECS，一次改代码的完整部署）：优化前约 15s，优化后全量重建约 8s、
只改前端约 5s。

## 演出现场建议

- 手机把网页「添加到主屏幕」，全屏且不会误触浏览器栏；页面会申请屏幕常亮。
- 蓝牙翻页踏板发出的方向键 / PageDown 直接生效。
- 现场没网时，可以在笔记本上 `npm run dev` 或 `docker compose up`，手机连笔记本热点访问。

## 目录结构

```
client/   React + Vite 前端
server/   Fastify + WebSocket + SQLite 后端
shared/   ChordPro 解析、移调、共享类型
seed/     示例歌曲（.cho + 图片）
deploy/   服务器部署脚本
data/     运行时数据（数据库、上传图片），已被 git 忽略
```
