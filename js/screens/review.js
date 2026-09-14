/* ==========================================================
   review.js — the weekly loop closing.

   One week at a time: did the planned sessions happen, how did
   readiness and weight move, and how did Saturday's volleyball
   actually feel. The last question is the only real scoreboard,
   so it gets its own log.
   ========================================================== */

(function (global) {
  const AOS = global.AOS = global.AOS || {};
  const { h, delegate, num, signed, toast } = AOS.dom;
  const W = AOS.widgets;
  const dates = AOS.dates;

  const state = {
    weekStart: dates.startOfWeek(dates.today()),
    summary: null,
    sessions: [],
    conditions: [],
    bodyLogs: [],
    vbLogs: []
  };

  // ---------- data ----------

  function load() {
    return Promise.all([
      AOS.stats.weekSummary(state.weekStart),
      AOS.sessions.all(),
      AOS.db.getAll('conditionLogs'),
      AOS.stats.allBodyLogs(),
      AOS.db.getAll('volleyballLogs')
    ]).then(([summary, sessions, conditions, bodyLogs, vbLogs]) => {
      state.summary = summary;
      state.sessions = sessions.filter((s) => s.status !== 'in_progress');
      state.conditions = conditions;
      state.bodyLogs = bodyLogs;
      state.vbLogs = vbLogs.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    });
  }

  function isCurrentWeek() {
    return state.weekStart === dates.startOfWeek(dates.today());
  }

  // ---------- pieces ----------

  function weekHeader() {
    const end = dates.addDays(state.weekStart, 6);
    return W.card({
      body: h`
        <div class="card-head" style="margin-bottom:12px">
          <button class="icon-btn" data-week="-1" aria-label="前の週">
            <span style="transform:rotate(180deg)">${AOS.icons.chevron(18)}</span>
          </button>
          <div class="center">
            <p class="eyebrow">${isCurrentWeek() ? 'THIS WEEK' : 'WEEK'}</p>
            <p class="row-title">${dates.formatShort(state.weekStart)} 〜 ${dates.formatShort(end)}</p>
          </div>
          <button class="icon-btn" data-week="1" aria-label="次の週"
                  ${isCurrentWeek() ? AOS.dom.raw('disabled style="opacity:.3"') : ''}>
            ${AOS.icons.chevron(18)}
          </button>
        </div>
        ${weekGrid()}
      `
    });
  }

  function weekGrid() {
    const days = state.summary.days;
    return h`
      <div class="week-grid">
        ${days.map((day) => h`<div class="week-day-label">${dates.WD_JP[day.dow]}</div>`)}
      </div>
      <div class="week-grid">
        ${days.map((day) => {
          const workout = AOS.workouts.get(day.workoutId);
          const classes = [
            'week-cell',
            day.done ? (day.isVolleyball ? 'vb' : 'done') : '',
            day.isToday ? 'today' : ''
          ].join(' ');
          const label = day.isVolleyball ? 'VB' : (workout.trainable ? workout.id : '—');
          return h`<div class="${classes}">${label}</div>`;
        })}
      </div>
    `;
  }

  function summaryCard() {
    const s = state.summary;
    const readiness = s.avgReadiness === null ? '—' : num(s.avgReadiness);

    return W.card({
      title: 'WEEK SUMMARY',
      body: h`
        <div class="tiles">
          ${W.tile('セッション', `${s.sessionsDone}/${s.sessionsPlanned}`, '予定比')}
          ${W.tile('総ボリューム', s.volume ? s.volume.toLocaleString() : '—', 'kg')}
          ${W.tile('平均スコア', readiness, '/ 15')}
          ${W.tile('体重変化', s.weightChange === null ? '—' : signed(s.weightChange), 'kg',
            s.weightChange === null ? '' : (s.weightChange < 0 ? 'delta-down' : 'delta-up'))}
          ${W.tile('セット数', s.setsDone, '完了')}
          ${W.tile('タンパク質', s.proteinTarget ? `${s.proteinDaysHit}/7` : '—', '達成日')}
        </div>
      `
    });
  }

  function trendsCard() {
    const days = dates.lastDays(14);
    const readiness = AOS.stats.readinessSeries(state.conditions, days);
    const weights = AOS.stats.weightSeries(state.bodyLogs, dates.lastDays(30));

    // Volume per week for the last 6 weeks.
    const weeks = [];
    for (let i = 5; i >= 0; i--) {
      const start = dates.addDays(dates.startOfWeek(dates.today()), -7 * i);
      const keys = dates.weekKeys(start);
      const volume = state.sessions
        .filter((session) => keys.indexOf(session.date) >= 0)
        .reduce((sum, session) => sum + AOS.sessions.volume(session), 0);
      weeks.push({ label: dates.formatShort(start), value: volume, highlight: i === 0 });
    }

    return h`
      ${W.card({
        title: 'READINESS · 14日',
        body: AOS.chart.line(readiness, { height: 104, title: 'Readinessの推移' })
      })}
      ${W.card({
        title: 'BODY WEIGHT · 30日',
        body: AOS.chart.line(weights, { height: 104, title: '体重の推移' })
      })}
      ${W.card({
        title: 'VOLUME · 6週',
        body: AOS.chart.bars(weeks, { height: 112, title: '週ごとの総ボリューム' })
      })}
    `;
  }

  function volleyballCard() {
    const logs = state.vbLogs.slice(0, 5);
    return W.card({
      title: 'VOLLEYBALL',
      action: h`<button class="link-btn" data-action="log-vb">記録する</button>`,
      body: logs.length ? h`<div>${logs.map((log) => h`
        <div class="row">
          <span class="row-main">
            <span class="row-title">${dates.formatJP(log.date)}</span>
            <span class="row-sub">${log.note || '出来 ' + log.rating + ' / 跳べた感 ' + log.jump}</span>
          </span>
          <span class="row-value">${log.rating} / 5</span>
        </div>`)}</div>`
        : W.empty('練習の記録がまだありません', '練習後にその日の出来を残すと、効果が見えるようになる')
    });
  }

  function historyCard() {
    const recent = state.sessions
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 6);

    return W.card({
      title: 'RECENT SESSIONS',
      body: recent.length ? h`<div>${recent.map((session) => {
        const workout = AOS.workouts.get(session.workoutType);
        return h`
          <div class="row">
            <span class="row-main">
              <span class="row-title">${workout.label}</span>
              <span class="row-sub">${dates.formatJP(session.date)} · ${AOS.sessions.summaryLine(session)}</span>
            </span>
            <span class="badge ${session.status === 'completed' ? 'badge-green' : 'badge-quiet'} session-row-badge">
              ${AOS.sessions.statusLabel(session.status)}
            </span>
          </div>`;
      })}</div>` : W.empty('まだ記録がありません', 'トレーニングを1回終えると、ここに並びます')
    });
  }

  // ---------- volleyball form ----------

  function openVolleyballForm(dateKey) {
    const day = dateKey || AOS.plan.volleyball().dateKey;
    const target = day > dates.today() ? dates.today() : day;
    const existing = state.vbLogs.find((log) => log.date === target) || null;

    const el = AOS.sheet.open('バレーの振り返り', h`
      ${W.scaleRow('rating', '今日の出来', existing ? existing.rating : 3, '')}
      ${W.scaleRow('jump', '跳べた感じ', existing ? existing.jump : 3, '')}
      <label class="field" style="margin-top:14px">
        <span class="field-label">メモ</span>
        <textarea class="textarea" data-vb-note placeholder="良かった点 / 次に直す点">${existing ? existing.note || '' : ''}</textarea>
      </label>
      <button class="btn" data-save-vb style="margin-top:14px">保存する</button>
    `, { subtitle: dates.formatJP(target) });

    const picked = { rating: existing ? existing.rating : 3, jump: existing ? existing.jump : 3 };

    delegate(el, 'click', '[data-scale] .scale-btn', (e, button) => {
      const group = button.closest('[data-scale]');
      group.querySelectorAll('.scale-btn').forEach((b) => b.classList.toggle('selected', b === button));
      picked[group.dataset.scale] = Number(button.dataset.value);
    });

    delegate(el, 'click', '[data-save-vb]', () => {
      const record = Object.assign({}, existing, {
        date: target,
        rating: picked.rating,
        jump: picked.jump,
        note: el.querySelector('[data-vb-note]').value.trim()
      });
      AOS.db.put('volleyballLogs', record).then(() => {
        AOS.store.changed('volleyball');
        AOS.sheet.close();
        toast('記録しました');
        AOS.router.rerender();
      });
    });
  }

  // ---------- screen ----------

  function render() {
    return load().then(() => h`
      ${weekHeader()}
      ${summaryCard()}
      ${volleyballCard()}
      ${trendsCard()}
      ${historyCard()}
    `);
  }

  function topbar() {
    return { eyebrow: 'REVIEW', title: '振り返り' };
  }

  function bind(root) {
    const unbinds = [];

    unbinds.push(delegate(root, 'click', '[data-week]', (e, target) => {
      const direction = Number(target.dataset.week);
      if (direction > 0 && isCurrentWeek()) return;
      state.weekStart = dates.addDays(state.weekStart, direction * 7);
      AOS.router.rerender();
    }));

    unbinds.push(delegate(root, 'click', '[data-action="log-vb"]', () => openVolleyballForm()));

    return unbinds;
  }

  function onEnter() {
    state.weekStart = dates.startOfWeek(dates.today());
  }

  AOS.screens = AOS.screens || {};
  AOS.screens.review = {
    id: 'review', label: 'REVIEW', icon: 'review',
    topbar, render, bind, onEnter, openVolleyballForm
  };

  AOS.router.register(AOS.screens.review);
})(window);
