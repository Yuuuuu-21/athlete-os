/* ==========================================================
   condition.js — shared Condition/Readiness logic.
   HOME and BODY both read and write the same conditionLogs
   record for a given date; this module is the single place
   that knows the schema and the readiness formula so the two
   screens can never drift apart.
   ========================================================== */

(function (global) {
  const DB = global.AthleteDB;

  const HELP = {
    sleep: {
      title: 'SLEEP',
      levels: [
        [5, 'よく眠れた。起きた時かなりスッキリ'],
        [4, 'だいたい良好。眠気は少ない'],
        [3, '普通。少し眠い'],
        [2, '寝不足感が強い'],
        [1, 'ほとんど眠れなかった、かなり眠い']
      ]
    },
    energy: {
      title: 'ENERGY',
      levels: [
        [5, 'かなり元気。体が軽く、やる気もある'],
        [4, '普通に元気。問題なくトレーニングできそう'],
        [3, '少しだるい。でも通常生活は問題ない'],
        [2, 'かなり疲れている。集中しづらい、体が重い'],
        [1, '強い疲労感。今日は休みたいレベル']
      ]
    },
    legs: {
      title: 'LEGS',
      levels: [
        [5, '軽い。張りや筋肉痛なし'],
        [4, '少し張るが問題なし'],
        [3, '軽い筋肉痛や重さあり'],
        [2, 'かなり重い、筋肉痛が強い'],
        [1, '痛みや強い違和感があり、運動したくない']
      ]
    }
  };

  const READINESS_LEVELS = [
    { min: 12, max: 15, status: 'GREEN', desc: '今日は良い状態です', action: '通常メニューでOK' },
    { min: 8, max: 11, status: 'YELLOW', desc: '今日は通常より少し軽め', action: '重量・セット数を少し調整' },
    { min: 3, max: 7, status: 'RED', desc: '今日は疲労が溜まっています', action: '短縮または低負荷を優先' }
  ];

  function levelFor(score) {
    return READINESS_LEVELS.find((l) => score >= l.min && score <= l.max) || READINESS_LEVELS[1];
  }

  function computeReadiness(condition) {
    const score = condition.sleep + condition.energy + condition.legs;
    return { score, level: levelFor(score) };
  }

  async function loadToday(dateKey) {
    const log = await DB.get('conditionLogs', dateKey);
    if (log) {
      return { sleep: log.sleep, energy: log.energy, legs: log.legs, logged: true };
    }
    return { sleep: 3, energy: 3, legs: 3, logged: false };
  }

  async function save(dateKey, condition) {
    const { score, level } = computeReadiness(condition);
    const record = {
      date: dateKey,
      sleep: condition.sleep,
      energy: condition.energy,
      legs: condition.legs,
      readinessScore: score,
      readinessStatus: level.status
    };
    await DB.put('conditionLogs', record);
    return record;
  }

  global.Condition = { HELP, computeReadiness, loadToday, save };
})(window);
