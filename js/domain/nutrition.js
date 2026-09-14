/* ==========================================================
   nutrition.js — protein-first food tracking.

   Counting every calorie by hand gets abandoned in a week. The
   one number that actually moves the needle here is protein, so
   the target is derived from body weight and everything else is
   a quick tap.
   ========================================================== */

(function (global) {
  const AOS = global.AOS = global.AOS || {};
  const db = AOS.db;

  const SLOTS = [
    { id: 'breakfast', label: '朝食' },
    { id: 'lunch', label: '昼食' },
    { id: 'dinner', label: '夕食' },
    { id: 'snack', label: '補食・間食' }
  ];

  // grams of protein per serving — rough but consistent, which is
  // what matters for tracking a trend.
  const PRESETS = [
    { name: 'プロテイン 1杯', protein: 21 },
    { name: '卵 2個', protein: 12 },
    { name: '鶏むね 100g', protein: 23 },
    { name: '鶏もも 100g', protein: 19 },
    { name: '牛赤身 100g', protein: 21 },
    { name: '豚ロース 100g', protein: 20 },
    { name: 'サバ缶 1缶', protein: 26 },
    { name: 'ツナ缶 1缶', protein: 14 },
    { name: '納豆 1パック', protein: 8 },
    { name: '豆腐 半丁', protein: 10 },
    { name: '牛乳 200ml', protein: 7 },
    { name: 'ギリシャヨーグルト', protein: 10 },
    { name: 'ごはん 1杯', protein: 4 },
    { name: 'プロテインバー', protein: 15 }
  ];

  function slotLabel(id) {
    const slot = SLOTS.find((s) => s.id === id);
    return slot ? slot.label : id;
  }

  // Target is g/kg of the most recent body weight. Without a weight
  // logged there is nothing honest to compute, so the caller shows
  // a prompt to log one instead.
  function proteinTarget(weightKg) {
    const s = AOS.store.settings();
    if (!weightKg) return null;
    return Math.round(weightKg * Number(s.proteinPerKg || 1.8));
  }

  function totals(meals) {
    return meals.reduce((sum, m) => sum + (Number(m.protein) || 0), 0);
  }

  function bySlot(meals) {
    const grouped = {};
    SLOTS.forEach((slot) => { grouped[slot.id] = []; });
    meals.forEach((meal) => {
      const key = grouped[meal.slot] ? meal.slot : 'snack';
      grouped[key].push(meal);
    });
    return grouped;
  }

  function load(dateKey) {
    return db.byDate('mealLogs', dateKey);
  }

  function add(dateKey, slot, name, protein) {
    return db.put('mealLogs', {
      date: dateKey,
      slot,
      name: String(name).trim() || '記録',
      protein: Number(protein) || 0,
      loggedAt: new Date().toISOString()
    }).then((row) => {
      AOS.store.changed('food');
      return row;
    });
  }

  function remove(id) {
    return db.remove('mealLogs', id).then(() => AOS.store.changed('food'));
  }

  // Water is stored on the day's condition-independent body log so
  // it survives alongside weight without a store of its own.
  function waterFor(bodyLog) {
    return (bodyLog && Number(bodyLog.water)) || 0;
  }

  AOS.nutrition = { SLOTS, PRESETS, slotLabel, proteinTarget, totals, bySlot, load, add, remove, waterFor };
})(window);
