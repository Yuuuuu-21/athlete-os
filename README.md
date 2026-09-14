# Athlete OS — アスリート化計画

週末のバレーボールで高く跳び、速く動き、怪我をしないための個人用トレーニングアプリ。
ビルド不要の PWA（素の HTML / CSS / JS + IndexedDB）。記録はすべて端末内に保存されます。

## 毎日の流れ

1. **HOME** — 睡眠・気力・脚を1〜5で選ぶ → Readiness（15点満点）が出る
2. その点数で **今日のメニューが自動で調整される**（重量 %・セット数・跳ぶ量）
3. **TRAINING** — 前回の値と目標が出た状態でセットを記録。セット完了で休憩タイマー
4. **BODY** — 体重と、垂直跳び・到達点・スプリントなどのパフォーマンステスト
5. **FOOD** — 体重から計算したタンパク質目標に対して記録。水分も1タップ
6. **REVIEW** — 週単位で「予定どおり動けたか」と推移を確認。バレー当日の出来も記録

Readiness が実際にメニューを変えるところが、このアプリの中心です。

| Readiness | 状態 | 今日の調整 |
|---|---|---|
| 12–15 GREEN | 良い状態 | 通常メニュー。前回を1つ上回る |
| 8–11 YELLOW | やや疲労 | 重量 −5%、セット数は維持 |
| 3–7 RED | 疲労が強い | 重量 −15%、1セット減、跳ぶ量は半分 |

脚が1〜2のときは、合計点が高くてもジャンプ系と下半身の高重量は抑えられます。

## 使い方

ローカルで開くだけなら `index.html` をブラウザで開けば動きます。
Service Worker（オフライン動作）とホーム画面追加を使うには、HTTP で配信してください。

```bash
python3 -m http.server 8765   # → http://localhost:8765
```

iPhone は Safari で開いて「ホーム画面に追加」。以降はオフラインでも起動します。

## データについて

- 保存先はこの端末のブラウザの IndexedDB（DB名 `athlete-os`）だけです。サーバーには何も送信しません。
- **機種変更や再インストールの前に、設定 → 「データを書き出す」で JSON を保存してください。** 復元は同じ画面から。
- Ver1 のデータ（コンディション・体重・セット記録・設定）はそのまま引き継がれます。

## 構成

```
index.html          画面の骨組みだけ。中身は JS が描画
css/tokens.css      配色・余白・タイポのトークン（ライト / ダーク）
css/base.css        リセットとページ枠
css/components.css  カード・ボタン・スケール・ステッパー・シート・ナビ
css/screens.css     各画面固有のレイアウト
js/core/            dom(テンプレート) / dates / db / store / sheet / router
js/domain/          condition · workouts · plan · sessions · nutrition · stats
js/ui/              icons · widgets · chart（チャートは自前の SVG、ライブラリなし）
js/screens/         home · training · body · food · review · settings
js/app.js           起動（DB → 設定 → 画面）
sw.js               オフライン用。ネットワーク優先、失敗時にキャッシュ
```

種目・セット数・レップ数を変えたいときは `js/domain/workouts.js` の1か所だけを直せば、
HOME のプレビューも TRAINING の記録画面も追従します。
曜日ごとのメニューとバレーの曜日は、アプリの設定画面から変更できます。
