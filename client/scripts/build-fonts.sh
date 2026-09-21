#!/usr/bin/env bash
# 生成大屏歌词用的自托管字体子集：client/public/fonts/*.woff2
#
# 字体都是 OFL 开源可商用：马善政毛笔楷书、志莽行书、刘建毛草、龙藏、站酷快乐体、站酷小薇。
# 子集范围 = GB2312 全部汉字/符号 + ASCII（约 7500 字），覆盖绝大多数歌词；
# 生僻字会回退到系统字体，属预期行为。
#
# 依赖：python3 + fonttools + brotli （pip install fonttools brotli）
# 用法：bash client/scripts/build-fonts.sh
# 产物：mashanzheng / zhimangxing / maocao / longcang / kuaile / xiaowei 的 .woff2（已提交进仓库，平时不用重跑）
# 注意：文件的 @font-face 声明写在 client/src/styles.css 里（不能单独放 public/：
# 固定文件名会被长期强缓存，新增字体后浏览器拿不到新的声明）。
set -euo pipefail

OUT="$(cd "$(dirname "$0")/.." && pwd)/public/fonts"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# 与 --output-file 里的名字对应
FONTS=(
  "MaShanZheng-Regular.ttf|https://raw.githubusercontent.com/google/fonts/main/ofl/mashanzheng/MaShanZheng-Regular.ttf|mashanzheng.woff2"
  "ZhiMangXing-Regular.ttf|https://raw.githubusercontent.com/google/fonts/main/ofl/zhimangxing/ZhiMangXing-Regular.ttf|zhimangxing.woff2"
  "LiuJianMaoCao-Regular.ttf|https://raw.githubusercontent.com/google/fonts/main/ofl/liujianmaocao/LiuJianMaoCao-Regular.ttf|maocao.woff2"
  "LongCang-Regular.ttf|https://raw.githubusercontent.com/google/fonts/main/ofl/longcang/LongCang-Regular.ttf|longcang.woff2"
  "ZCOOLKuaiLe-Regular.ttf|https://raw.githubusercontent.com/google/fonts/main/ofl/zcoolkuaile/ZCOOLKuaiLe-Regular.ttf|kuaile.woff2"
  "ZCOOLXiaoWei-Regular.ttf|https://raw.githubusercontent.com/google/fonts/main/ofl/zcoolxiaowei/ZCOOLXiaoWei-Regular.ttf|xiaowei.woff2"
)

echo "==> 生成字符子集清单（GB2312 + ASCII）"
python3 - "$WORK/chars.txt" <<'PY'
import sys
chars = set()
for hi in range(0xA1, 0xF8):
    for lo in range(0xA1, 0xFF):
        try:
            chars.add(bytes([hi, lo]).decode('gb2312'))
        except Exception:
            pass
chars |= {chr(i) for i in range(0x20, 0x7F)}
chars |= set('·—…“”‘’「」『』〈〉《》【】、。，．！？：；（）％＆＋－／＝')
open(sys.argv[1], 'w', encoding='utf-8').write(''.join(sorted(chars)))
print(f"    字符数 {len(chars)}")
PY

mkdir -p "$OUT"
for entry in "${FONTS[@]}"; do
  IFS='|' read -r ttf url out <<<"$entry"
  echo "==> 下载 $ttf"
  curl -fsSL -o "$WORK/$ttf" "$url"
  echo "==> 子集化 -> $out"
  pyftsubset "$WORK/$ttf" --text-file="$WORK/chars.txt" --flavor=woff2 \
    --layout-features=kern,liga --output-file="$OUT/$out"
  ls -l "$OUT/$out" | awk '{printf "    %.2f MB\n", $5/1048576}'
done

echo "完成。记得同步更新 client/src/styles.css 里的 @font-face 列表。"
