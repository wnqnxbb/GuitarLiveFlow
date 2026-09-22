#!/usr/bin/env bash
# GuitarLiveFlow 本地部署脚本：rsync 直传服务器，绕开 GitHub
#
# 原来的流程是服务器自己 git fetch GitHub，但服务器到 GitHub 的连通性经常不稳（超时/空响应）。
# 改成本地 rsync 源码到服务器后，再 ssh 触发服务器上的构建脚本，全程不依赖 GitHub。
#
# 用法（在仓库根目录执行）：
#   bash deploy/deploy-local.sh
set -euo pipefail

APP_DIR=/opt/guitar-live-flow
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$REPO_ROOT"

# 服务器地址不要写进仓库：放到被 gitignore 的 deploy/.env.deploy 里
# （内容形如 DEPLOY_HOST=root@1.2.3.4），或用环境变量 DEPLOY_HOST 传入。
if [ -f "$REPO_ROOT/deploy/.env.deploy" ]; then
  # shellcheck disable=SC1091
  . "$REPO_ROOT/deploy/.env.deploy"
fi
HOST="${DEPLOY_HOST:-}"
if [ -z "$HOST" ]; then
  echo "错误：未配置部署服务器。请把 deploy/.env.deploy.example 复制为 deploy/.env.deploy 并填写 DEPLOY_HOST，或先 export DEPLOY_HOST=root@<服务器 IP>" >&2
  exit 1
fi

if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "==> 提示：本地有未提交的改动，将按工作区当前内容部署（不影响 git 历史）"
fi

echo "==> [1/2] rsync 源码到服务器 $HOST:$APP_DIR"
# 不加 --delete：只同步新增/修改的文件，不删服务器上多出来的文件，更安全。
# 排除 node_modules/dist：一个是平台相关的编译产物，一个是服务器自己构建生成。
RSYNC_LOG="$(mktemp)"
trap 'rm -f "$RSYNC_LOG"' EXIT

rsync -az \
  --itemize-changes \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.git' \
  --exclude '.DS_Store' \
  client server shared seed package.json package-lock.json \
  "$HOST:$APP_DIR/" | tee "$RSYNC_LOG"

# seed 单独再同步一次并带 --delete：谱子改名/删除后，服务器上残留的旧文件会被清掉，
# 否则 seed 会把改名前的旧谱子当成「新增歌曲」再导入一份（曾踩过）。
rsync -az --delete --exclude '.DS_Store' seed "$HOST:$APP_DIR/"

# 按本次实际同步的文件路径判断要不要重建前端/后端，取代原来的 git diff 判断
NEED_CLIENT=0
NEED_SERVER=0
if grep -qE '^[<>ch].{8} (client/|shared/|package(-lock)?\.json)' "$RSYNC_LOG"; then
  NEED_CLIENT=1
fi
if grep -qE '^[<>ch].{8} (server/|shared/|package(-lock)?\.json)' "$RSYNC_LOG"; then
  NEED_SERVER=1
fi

echo "==> 同步完成：NEED_CLIENT=$NEED_CLIENT NEED_SERVER=$NEED_SERVER"

echo "==> [2/2] 触发服务器端构建/重启"
ssh "$HOST" "NEED_CLIENT=$NEED_CLIENT NEED_SERVER=$NEED_SERVER bash /root/deploy-guitar.sh"
