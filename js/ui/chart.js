/* ==========================================================
   chart.js — two inline-SVG charts, no library.

   Both draw into a fixed 320-wide viewBox and scale with the
   card, and colour themselves from CSS variables so they follow
   the theme. Gaps in the data are simply absent points: a day
   without a weigh-in is not a zero.
   ========================================================== */

(function (global) {
  const AOS = global.AOS = global.AOS || {};
  const { h, raw, round } = AOS.dom;

  const W = 320;

  function empty(message) {
    return h`<div class="chart-empty">${message}</div>`;
  }

  // series: [{ date, value }] oldest first
  function line(series, options) {
    const o = options || {};
    const height = o.height || 110;
    const padX = 6;
    const padTop = 12;
    const padBottom = o.labels === false ? 10 : 20;

    if (!series || series.length < 2) {
      return empty(o.emptyText || 'データが2日分たまるとグラフが出ます');
    }

    const values = series.map((p) => p.value);
    let min = Math.min.apply(null, values);
    let max = Math.max.apply(null, values);
    if (max === min) { max += 1; min -= 1; }
    const span = max - min;
    const pad = span * 0.15;
    min -= pad;
    max += pad;

    const innerW = W - padX * 2;
    const innerH = height - padTop - padBottom;
    const x = (i) => round(padX + (innerW * i) / (series.length - 1), 2);
    const y = (v) => round(padTop + innerH * (1 - (v - min) / (max - min)), 2);

    const points = series.map((p, i) => `${x(i)},${y(p.value)}`);
    const linePath = `M${points.join(' L')}`;
    const areaPath = `${linePath} L${x(series.length - 1)},${padTop + innerH} L${x(0)},${padTop + innerH} Z`;

    const last = series[series.length - 1];
    const dots = series.length <= 14
      ? series.map((p, i) => `<circle class="chart-dot" cx="${x(i)}" cy="${y(p.value)}" r="${i === series.length - 1 ? 3.6 : 2}" opacity="${i === series.length - 1 ? 1 : .45}"/>`).join('')
      : `<circle class="chart-dot" cx="${x(series.length - 1)}" cy="${y(last.value)}" r="3.6"/>`;

    const labels = o.labels === false ? '' : `
      <text class="chart-label" x="${padX}" y="${height - 4}" text-anchor="start">${AOS.dates.formatShort(series[0].date)}</text>
      <text class="chart-label" x="${W - padX}" y="${height - 4}" text-anchor="end">${AOS.dates.formatShort(last.date)}</text>`;

    const guide = o.guides === false ? '' : `
      <line class="chart-grid" x1="${padX}" y1="${padTop + innerH}" x2="${W - padX}" y2="${padTop + innerH}"/>`;

    return raw(`
      <svg class="chart" viewBox="0 0 ${W} ${height}" role="img" aria-label="${AOS.dom.escape(o.title || 'グラフ')}">
        ${guide}
        <path class="chart-area" d="${areaPath}"/>
        <path class="chart-line" d="${linePath}"/>
        ${dots}
        ${labels}
      </svg>
    `);
  }

  // bars: [{ label, value }]
  function bars(data, options) {
    const o = options || {};
    const height = o.height || 110;
    const padX = 6;
    const padTop = 10;
    const padBottom = 20;

    if (!data || !data.length) return empty(o.emptyText || 'まだ記録がありません');

    const max = Math.max(1, Math.max.apply(null, data.map((d) => d.value)));
    const innerW = W - padX * 2;
    const innerH = height - padTop - padBottom;
    const slot = innerW / data.length;
    const barW = Math.min(28, slot * 0.62);

    const rects = data.map((d, i) => {
      const cx = padX + slot * i + slot / 2;
      const barH = Math.max(d.value > 0 ? 3 : 2, round((innerH * d.value) / max, 2));
      const y = padTop + innerH - barH;
      const cls = d.value > 0 ? 'chart-bar' : 'chart-bar empty';
      const fill = d.highlight ? ' style="fill: var(--green)"' : '';
      return `<rect class="${cls}"${fill} x="${round(cx - barW / 2, 2)}" y="${y}" width="${round(barW, 2)}" height="${barH}" rx="3.5"/>` +
        `<text class="chart-label" x="${round(cx, 2)}" y="${height - 5}" text-anchor="middle">${AOS.dom.escape(d.label)}</text>`;
    }).join('');

    return raw(`
      <svg class="chart" viewBox="0 0 ${W} ${height}" role="img" aria-label="${AOS.dom.escape(o.title || 'グラフ')}">
        ${rects}
      </svg>
    `);
  }

  AOS.chart = { line, bars, empty };
})(window);
