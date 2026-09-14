/* ==========================================================
   dates.js — every date in the app is a local "YYYY-MM-DD"
   key. Nothing is stored as a timestamp-only value, so a
   session logged at 23:50 stays on the day it was trained.
   ========================================================== */

(function (global) {
  const AOS = global.AOS = global.AOS || {};

  const WD_JP = ['日', '月', '火', '水', '木', '金', '土'];
  const WD_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const WD_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function pad(n) { return String(n).padStart(2, '0'); }

  function key(date) {
    const d = date || new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function today() { return key(new Date()); }

  function parse(dateKey) {
    const [y, m, d] = String(dateKey).split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(dateKey, days) {
    const d = parse(dateKey);
    d.setDate(d.getDate() + days);
    return key(d);
  }

  function weekday(dateKey) {
    return parse(dateKey).getDay();
  }

  // Monday-start week, matching how a training week is planned.
  function startOfWeek(dateKey) {
    const dow = weekday(dateKey);
    return addDays(dateKey, dow === 0 ? -6 : 1 - dow);
  }

  function weekKeys(startKey) {
    const out = [];
    for (let i = 0; i < 7; i++) out.push(addDays(startKey, i));
    return out;
  }

  // The last `count` days ending today, oldest first.
  function lastDays(count, endKey) {
    const end = endKey || today();
    const out = [];
    for (let i = count - 1; i >= 0; i--) out.push(addDays(end, -i));
    return out;
  }

  function diffDays(fromKey, toKey) {
    return Math.round((parse(toKey) - parse(fromKey)) / 86400000);
  }

  function formatJP(dateKey) {
    const d = parse(dateKey);
    return `${d.getMonth() + 1}月${d.getDate()}日(${WD_JP[d.getDay()]})`;
  }

  function formatShort(dateKey) {
    const d = parse(dateKey);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  function relativeJP(dateKey) {
    const delta = diffDays(dateKey, today());
    if (delta === 0) return '今日';
    if (delta === 1) return '昨日';
    if (delta < 7) return `${delta}日前`;
    return formatJP(dateKey);
  }

  function greeting(date) {
    const hour = (date || new Date()).getHours();
    if (hour < 5) return 'おつかれさま';
    if (hour < 11) return 'おはよう';
    if (hour < 18) return 'こんにちは';
    return 'こんばんは';
  }

  // Days until the next occurrence of a weekday (0 = today).
  function daysUntilWeekday(targetDow, fromKey) {
    return (targetDow - weekday(fromKey || today()) + 7) % 7;
  }

  AOS.dates = {
    WD_JP, WD_EN, WD_FULL,
    key, today, parse, addDays, weekday, startOfWeek, weekKeys,
    lastDays, diffDays, formatJP, formatShort, relativeJP,
    greeting, daysUntilWeekday
  };
})(window);
