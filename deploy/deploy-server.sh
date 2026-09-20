#!/usr/bin/env bash
# GuitarLiveFlow 部署/更新脚本
# 环境：阿里云 CentOS 8 + Nginx(复用 *.example.com 证书) + systemd 原生 Node 部署
#
# 流程：拉代码 -> 依赖没变就跳过（装依赖/编译 better-sqlite3）-> 构建 -> 重启 -> 补 seed -> 健康检查
# 优化：better-sqlite3 编译产物和依赖指纹缓存在 .deploy-cache/，
#       日常只改内容（谱子、前端页面）时跳过 npm ci 与编译，全程 30 秒左右。
#
# 用法：ssh root@SERVER_IP bash /root/deploy-guitar.sh
set -euo pipefail

APP_DIR=/opt/guitar-live-flow
NODE=/opt/node24/bin/node
NPM=/opt/node24/bin/npm
GYP=/opt/node24/lib/node_modules/npm/node_modules/node-gyp/bin/node-gyp.js
TOOLSET=/opt/rh/gcc-toolset-10/root/usr/bin
PYTHON=/usr/bin/python3.9
BRANCH=main
# 国内服务器走 npmmirror，比官方源快得多
REGISTRY=https://registry.npmmirror.com

CACHE_DIR=$APP_DIR/.deploy-cache
BS=$APP_DIR/node_modules/better-sqlite3
BS_BIN=$BS/build/Release/better_sqlite3.node
BS_CACHE=$CACHE_DIR/better_sqlite3.linux-x64.node
DEPS_STAMP=$CACHE_DIR/deps.stamp
BUILD_STAMP=$CACHE_DIR/built.commit
SEED_STAMP=$CACHE_DIR/seed.tree

# 无论成败都打印结束标记，方便后台运行时判断进度
trap 'echo "==> DEPLOY_EXIT=$?"' EXIT

cd "$APP_DIR"
as_guitar() { sudo -u guitar env HOME="$APP_DIR" PATH=/opt/node24/bin:/usr/bin:/bin "$@"; }

echo "==> [0/6] 从 GitHub 拉取 $BRANCH"
as_guitar git fetch origin "$BRANCH"
as_guitar git reset --hard "origin/$BRANCH"
HEAD_COMMIT="$(as_guitar git rev-parse HEAD)"
as_guitar git log --oneline -1

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
fi

# 哪些部分需要重建：默认都不建，按「上次构建提交 -> 本次提交」的改动路径判断
NEED_CLIENT=0
NEED_SERVER=0
if [ -f "$BUILD_STAMP" ]; then
  PREV_COMMIT="$(cat "$BUILD_STAMP")"
  if [ -n "$PREV_COMMIT" ] && as_guitar git cat-file -e "$PREV_COMMIT^{commit}" 2>/dev/null; then
    CHANGED="$(as_guitar git diff --name-only "$PREV_COMMIT" "$HEAD_COMMIT" 2>/dev/null || true)"
    printf '%s\n' "$CHANGED" | grep -qE '^(client/|shared/|package(-lock)?\.json)' && NEED_CLIENT=1 || true
    printf '%s\n' "$CHANGED" | grep -qE '^(server/|shared/|package(-lock)?\.json)' && NEED_SERVER=1 || true
  else
    # 上次构建的提交已不存在（force push 等），保守全量构建
    NEED_CLIENT=1
    NEED_SERVER=1
  fi
else
  NEED_CLIENT=1
  NEED_SERVER=1
fi
# 产物缺失或这次重装了依赖/换了编译器，强制全量构建
[ -f client/dist/index.html ] || NEED_CLIENT=1
[ -f server/dist/server/src/index.js ] || NEED_SERVER=1
if [ "$NEED_DEPS" -eq 1 ]; then
  NEED_CLIENT=1
  NEED_SERVER=1
fi

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
printf '%s\n' "$HEAD_COMMIT" > "$BUILD_STAMP"
chown guitar:guitar "$BUILD_STAMP"

echo "==> [4/6] 重启服务"
systemctl restart guitar-live-flow
# 轮询健康检查，就绪就往下走：比固定 sleep 2 更快，也更可靠
for _ in $(seq 1 40); do
  curl -fsS -m 2 http://127.0.0.1:3000/api/health >/dev/null 2>&1 && break
  sleep 0.5
done
systemctl is-active guitar-live-flow

SEED_TREE="$(as_guitar git rev-parse "$HEAD_COMMIT:seed" 2>/dev/null || true)"
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
