#!/usr/bin/env bash
# GuitarLiveFlow 部署/更新脚本（服务器端）
# 环境：CentOS 8 + Nginx(复用服务器上已有的 HTTPS 证书) + systemd 原生 Node 部署
#
# 流程：（代码已由本地 rsync 同步好）-> 依赖没变就跳过（装依赖/编译 better-sqlite3）
#       -> 构建 -> 重启 -> 补 seed -> 健康检查
# 优化：better-sqlite3 编译产物和依赖指纹缓存在 .deploy-cache/，
#       日常只改内容（谱子、前端页面）时跳过 npm ci 与编译，全程 30 秒左右。
#
# 代码同步方式：本地 `bash deploy/deploy-local.sh` 通过 rsync 直传，不再由本脚本
# 从 GitHub 拉取（服务器到 GitHub 的连通性不稳定，超时/空响应时有发生）。
# 是否需要重建前端/后端由本地 rsync 后的变更文件判断，通过环境变量传入：
#   NEED_CLIENT=0|1  NEED_SERVER=0|1（未传时默认都当作 1，保守全量构建）
#
# 用法：ssh <服务器地址> "NEED_CLIENT=1 NEED_SERVER=1 bash /root/deploy-guitar.sh"
# （一般不用手动传参，由 deploy/deploy-local.sh 自动算好并传入）
set -euo pipefail

APP_DIR=/opt/guitar-live-flow
NODE=/opt/node24/bin/node
NPM=/opt/node24/bin/npm
GYP=/opt/node24/lib/node_modules/npm/node_modules/node-gyp/bin/node-gyp.js
TOOLSET=/opt/rh/gcc-toolset-10/root/usr/bin
PYTHON=/usr/bin/python3.9
# 国内服务器走 npmmirror，比官方源快得多
REGISTRY=https://registry.npmmirror.com

: "${NEED_CLIENT:=1}"
: "${NEED_SERVER:=1}"

CACHE_DIR=$APP_DIR/.deploy-cache
BS=$APP_DIR/node_modules/better-sqlite3
BS_BIN=$BS/build/Release/better_sqlite3.node
BS_CACHE=$CACHE_DIR/better_sqlite3.linux-x64.node
DEPS_STAMP=$CACHE_DIR/deps.stamp
SEED_STAMP=$CACHE_DIR/seed.tree

# 无论成败都打印结束标记，方便后台运行时判断进度
trap 'echo "==> DEPLOY_EXIT=$?"' EXIT

cd "$APP_DIR"
as_guitar() { sudo -u guitar env HOME="$APP_DIR" PATH=/opt/node24/bin:/usr/bin:/bin "$@"; }

echo "==> [0/6] 代码已由本地 rsync 同步，修正文件属主"
chown -R guitar:guitar client server shared seed package.json package-lock.json 2>/dev/null || true
echo "    NEED_CLIENT=$NEED_CLIENT NEED_SERVER=$NEED_SERVER"

mkdir -p "$CACHE_DIR"

# 依赖指纹：lockfile + node 版本 + 编译器版本，任一变化才重装/重编译
DEPS_FP="$(sha256sum package-lock.json | cut -d' ' -f1)|$("$NODE" -v)|$("$TOOLSET/gcc" -dumpversion)"

NEED_DEPS=1
if [ -f "$DEPS_STAMP" ] && [ "$(cat "$DEPS_STAMP")" = "$DEPS_FP" ] && [ -d node_modules ]; then
  echo "==> [1/6] 依赖与编译器未变化，尝试复用缓存的 better-sqlite3 二进制"
  mkdir -p "$BS/build/Release" "$BS/prebuilds"
  if [ -f "$BS_CACHE" ]; then
    cp "$BS_CACHE" "$BS_BIN"
    cp "$BS_CACHE" "$BS/prebuilds/linux-x64.node"
    chown -R guitar:guitar "$BS/build" "$BS/prebuilds"
    # 真的能加载才算数（缓存损坏时自动回退到全量重建）
    if as_guitar "$NODE" -e 'require("better-sqlite3")' >/dev/null 2>&1; then
      NEED_DEPS=0
      echo "    缓存可用，跳过 npm ci 与编译"
    else
      echo "    缓存二进制无法加载，回退全量重建"
    fi
  fi
fi

if [ "$NEED_DEPS" -eq 1 ]; then
  echo "==> [1/6] 安装依赖（--ignore-scripts：跳过 npm 对 better-sqlite3 的隐式 node-gyp 构建）"
  as_guitar "$NPM" ci --ignore-scripts --no-audit --no-fund --registry="$REGISTRY" \
    || as_guitar "$NPM" ci --ignore-scripts --no-audit --no-fund

  echo "==> [2/6] 用 gcc-toolset-10 重新编译 better-sqlite3"
  echo "    （npm 包自带预编译需要 GLIBC_2.29，而 CentOS 8 只有 2.28）"
  # node-gyp 依赖当前目录下的 binding.gyp，必须先 cd 进去
  cd "$BS"
  sudo -u guitar env HOME="$APP_DIR" PATH=/opt/node24/bin:/usr/bin:/bin \
    CC="$TOOLSET/gcc" CXX="$TOOLSET/g++" \
    LDFLAGS="-static-libstdc++ -static-libgcc" \
    npm_config_python="$PYTHON" \
    "$NODE" "$GYP" rebuild --release --force_build=1
  cd "$APP_DIR"

  echo "    编译完成，产物写入缓存供下次复用"
  cp "$BS_BIN" "$BS/prebuilds/linux-x64.node"
  cp "$BS_BIN" "$BS_CACHE"
  printf '%s\n' "$DEPS_FP" > "$DEPS_STAMP"
  chown -R guitar:guitar "$CACHE_DIR" "$BS/build" "$BS/prebuilds"
  # 依赖重装/编译器换了，前后端都要重新构建
  NEED_CLIENT=1
  NEED_SERVER=1
fi

# 产物缺失时强制全量构建（比如第一次部署、或 dist 被手动清理过）
[ -f client/dist/index.html ] || NEED_CLIENT=1
[ -f server/dist/server/src/index.js ] || NEED_SERVER=1

if [ "$NEED_CLIENT" -eq 0 ] && [ "$NEED_SERVER" -eq 0 ]; then
  echo "==> [3/6] 前后端代码均未变化，跳过构建"
else
  # 按需分别构建：只改前端时跳过慢的 server tsc，只改后端时跳过 vite
  if [ "$NEED_CLIENT" -eq 1 ]; then
    echo "==> [3/6] 构建前端（client tsc --noEmit + vite build）"
    as_guitar "$NPM" run build -w client
  fi
  if [ "$NEED_SERVER" -eq 1 ]; then
    echo "==> [3/6] 构建后端（server tsc）"
    as_guitar "$NPM" run build -w server
  fi
fi

echo "==> [4/6] 重启服务"
systemctl restart guitar-live-flow
# 轮询健康检查，就绪就往下走：比固定 sleep 2 更快，也更可靠
for _ in $(seq 1 40); do
  curl -fsS -m 2 http://127.0.0.1:3000/api/health >/dev/null 2>&1 && break
  sleep 0.5
done
systemctl is-active guitar-live-flow

# seed 版本判断改成对目录内容算 hash（不再依赖 git rev-parse）
SEED_TREE="$(find seed -type f 2>/dev/null | sort | xargs -r sha256sum | sha256sum | cut -d' ' -f1)"
if [ -n "$SEED_TREE" ] && [ -f "$SEED_STAMP" ] && [ "$(cat "$SEED_STAMP")" = "$SEED_TREE" ]; then
  echo "==> [5/6] seed 目录未变化，跳过导入"
else
  echo "==> [5/6] 补齐 seed 目录里新增的谱子（按标题去重，可重复执行）"
  cd "$APP_DIR/server"
  sudo -u guitar env HOME="$APP_DIR" NODE_ENV=production "$NODE" dist/server/src/seed.js \
    || echo "    seed 步骤失败，不影响本次部署"
  cd "$APP_DIR"
  printf '%s\n' "$SEED_TREE" > "$SEED_STAMP"
  chown guitar:guitar "$SEED_STAMP"
fi

echo "==> [6/6] 健康检查"
curl -s http://127.0.0.1:3000/api/health; echo
echo "完成。"
