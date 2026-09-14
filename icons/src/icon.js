// Athlete OS アイコン
// ・アプリのReadinessリングと同じ形（ゲージが上がる＝跳ぶ）
// ・マスカブル安全圏（中心80%＝半径205）に収める: 最外 168+19 = 187 < 205
// ・不透明背景（iOSは透過を黒く塗るため）
function iconSVG(size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3B82F6"/>
      <stop offset="1" stop-color="#1D4ED8"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <path d="M110.5 340 A 168 168 0 1 1 401.5 340" fill="none" stroke="#fff" stroke-width="38"
        stroke-linecap="round" opacity="0.30"/>
  <path d="M110.5 340 A 168 168 0 0 1 374.8 137.2" fill="none" stroke="#fff" stroke-width="38"
        stroke-linecap="round"/>
  <path d="M170 296 L 256 214 L 342 296" fill="none" stroke="#fff" stroke-width="42"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

/* 作り直すとき（アイコンはこのファイルが唯一の原本）
 *
 *   1. 上の iconSVG() を編集する
 *   2. 512 / 192 / 180 の3サイズを書き出す:
 *
 *      for s in 512 192 180; do
 *        printf '<!DOCTYPE html><meta charset=utf-8><style>html,body{margin:0}svg{display:block}</style><body><script>%s document.body.innerHTML=iconSVG(%s);</script>' \
 *          "$(cat icons/src/icon.js)" "$s" > /tmp/icon-$s.html
 *        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
 *          --window-size=$s,$s --hide-scrollbars --screenshot=/tmp/icon-$s.png "file:///tmp/icon-$s.html"
 *      done
 *
 *   3. icon-512.png / icon-192.png / apple-touch-icon.png(180) に置く
 *
 * 制約: 背景は不透明（iOSは透過を黒く塗る）。図形は中心から半径205px以内に
 *       収めること（Androidのマスカブルが中心80%の円で切り抜くため）。
 */
