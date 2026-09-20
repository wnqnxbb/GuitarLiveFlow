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

if [ -f "$BUILD_STAMP" ] && [ "$(cat "$BUILD_STAMP")" = "$HEAD_COMMIT" ] \
   && [ -f client/dist/index.html ] && [ -f server/dist/server/src/index.js ]; then
  echo "==> [3/6] 代码未变化，跳过构建"
else
  echo "==> [3/6] 构建前端与后端"
  as_guitar "$NPM" run build
  printf '%s\n' "$HEAD_COMMIT" > "$BUILD_STAMP"
  chown guitar:guitar "$BUILD_STAMP"
fi

echo "==> [4/6] 重启服务"
systemctl restart guitar-live-flow
sleep 2
systemctl is-active guitar-live-flow

echo "==> [5/6] 补齐 seed 目录里新增的谱子（按标题去重，可重复执行）"
cd "$APP_DIR/server"
sudo -u guitar env HOME="$APP_DIR" NODE_ENV=production "$NODE" dist/server/src/seed.js \
  || echo "    seed 步骤失败，不影响本次部署"

echo "==> [6/6] 健康检查"
curl -s http://127.0.0.1:3000/api/health; echo
echo "完成。"
