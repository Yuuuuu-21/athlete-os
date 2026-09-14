/* Athlete OS アイコン（原本）
 *
 * 図案：バレーボール。アプリの目的そのもの。
 * 縫い目は球面に投影された弧なので、球の輪郭(r=166)より
 * ずっと大きい半径(R=440)の弧を、端点を輪郭上に置いて 120°ずつ回す。
 * Rを小さくすると膨らみ過ぎて盾や三角形に見えるので触らないこと。
 *
 * 制約
 *  - 背景は不透明（iOSは透過を黒く塗る）
 *  - 図形は中心から半径205px以内（Androidのマスカブルが中心80%で切り抜く）
 *    実際の最外＝166+16=182 < 205
 */
function iconSVG(size) {
  const R = 166;          // ボールの輪郭
  const SEAM_R = 440;     // 縫い目の曲率（大きいほど緩い）
  const SPAN = 170;       // 縫い目が覆う角度
  const p = (a) => [
    (256 + R * Math.cos(a * Math.PI / 180)).toFixed(1),
    (256 + R * Math.sin(a * Math.PI / 180)).toFixed(1)
  ];

  let seams = '';
  for (let k = 0; k < 3; k++) {
    const [x1, y1] = p(90 - SPAN / 2);
    const [x2, y2] = p(90 + SPAN / 2);
    seams += `<path transform="rotate(${k * 120} 256 256)"
      d="M ${x1} ${y1} A ${SEAM_R} ${SEAM_R} 0 0 1 ${x2} ${y2}"
      fill="none" stroke="#fff" stroke-width="22" stroke-linecap="round"/>`;
  }

  return `<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3B82F6"/>
      <stop offset="1" stop-color="#1D4ED8"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="${R}" fill="none" stroke="#fff" stroke-width="32"/>
  ${seams}
</svg>`;
}

/* 作り直すとき（このファイルが唯一の原本）
 *
 *   for s in 512 192 180; do
 *     printf '<!DOCTYPE html><meta charset=utf-8><style>html,body{margin:0}svg{display:block}</style><body><script>%s document.body.innerHTML=iconSVG(%s);</script>' \
 *       "$(cat icons/src/icon.js)" "$s" > /tmp/icon-$s.html
 *     "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
 *       --window-size=$s,$s --hide-scrollbars --screenshot=/tmp/icon-$s.png "file:///tmp/icon-$s.html"
 *   done
 *
 *   512 -> icons/icon-512.png / 192 -> icons/icon-192.png / 180 -> icons/apple-touch-icon.png
 */
