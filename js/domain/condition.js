/* ==========================================================
   condition.js — the single source of truth for the three
   morning ratings, the readiness score, and what that score
   should change about today's session.

   Ver1 only displayed the score. Here the score also produces
   a prescription (load %, set delta, whether to jump), which
   TRAINING applies to the prescribed sets — that is the whole
   point of rating your condition before training.
   ========================================================== */

(function (global) {
  const AOS = global.AOS = global.AOS || {};
  const db = AOS.db;

  const FIELDS = [
    { id: 'sleep',  label: '睡眠',   en: 'SLEEP' },
    { id: 'energy', label: '気力',   en: 'ENERGY' },
    { id: 'legs',   label: '脚の状態', en: 'LEGS' }
  ];

  const HELP = {
    sleep: [
      [5, 'よく眠れた。起きた時かなりスッキリ'],
      [4, 'だいたい良好。眠気は少ない'],
      [3, '普通。少し眠い'],
      [2, '寝不足感が強い'],
      [1, 'ほとんど眠れなかった。かなり眠い']
    ],
    energy: [
      [5, 'かなり元気。体が軽く、やる気もある'],
      [4, '普通に元気。問題なくトレーニングできそう'],
      [3, '少しだるい。でも通常生活は問題ない'],
      [2, 'かなり疲れている。集中しづらい、体が重い'],
      [1, '強い疲労感。今日は休みたいレベル']
    ],
    legs: [
      [5, '軽い。張りや筋肉痛なし'],
      [4, '少し張るが問題なし'],
      [3, '軽い筋肉痛や重さあり'],
      [2, 'かなり重い。筋肉痛が強い'],
      [1, '痛みや強い違和感があり、運動したくない']
    ]
  };

  const LEVELS = [
    {
      min: 12, max: 15, status: 'GREEN', tone: 'green',
      title: '良い状態',
      desc: '狙い通りに追い込める日。重量を1段上げにいく。',
      prescription: '通常メニュー。前回を1つ上回ることだけ考える。',
      loadFactor: 1, setDelta: 0, jumps: 'full'
    },
    {
      min: 8, max: 11, status: 'YELLOW', tone: 'amber',
      title: 'やや疲労',
      desc: '動けるが伸ばしにいく日ではない。質を保つ。',
      prescription: '重量は5%落として、セット数は維持。フォーム優先。',
      loadFactor: 0.95, setDelta: 0, jumps: 'reduced'
    },
    {
      min: 3, max: 7, status: 'RED', tone: 'red',
      title: '疲労が強い',
      desc: '無理に押すと今週末のバレーに残る。回収する日。',
      prescription: '重量を15%落として1セット減。跳ぶ量は半分に。',
      loadFactor: 0.85, setDelta: -1, jumps: 'minimal'
    }
  ];

  const NEUTRAL = { sleep: 3, energy: 3, legs: 3 };

  function levelFor(score) {
    return LEVELS.find((l) => score >= l.min && score <= l.max) || LEVELS[1];
  }

  function score(condition) {
    return Number(condition.sleep) + Number(condition.energy) + Number(condition.legs);
  }

  function evaluate(condition) {
    const total = score(condition);
    const level = levelFor(total);

    // A bad legs score overrides a decent total: jumping and heavy
    // lower body work is what actually carries over to Saturday.
    const legs = Number(condition.legs);
    const warnings = [];
    if (legs <= 2) warnings.push('脚の状態が悪い。ジャンプ系と下半身の高重量は今日は避ける。');
    if (Number(condition.sleep) <= 2) warnings.push('睡眠不足。神経系が上がりにくいのでMAX更新は狙わない。');

    return {
      score: total,
      max: 15,
      level,
      warnings,
      jumps: legs <= 2 ? 'minimal' : level.jumps,
      loadFactor: legs <= 2 ? Math.min(level.loadFactor, 0.9) : level.loadFactor,
      setDelta: level.setDelta
    };
  }

  function hintFor(field, value) {
    const row = (HELP[field] || []).find(([n]) => n === Number(value));
    return row ? row[1] : '';
  }

  // ---------- persistence ----------

  function load(dateKey) {
    return db.get('conditionLogs', dateKey).then((record) => {
      if (!record) return Object.assign({ logged: false }, NEUTRAL);
      return {
        logged: true,
        sleep: record.sleep,
        energy: record.energy,
        legs: record.legs,
        note: record.note || ''
      };
    });
  }

  function save(dateKey, condition) {
    const result = evaluate(condition);
    const record = {
      date: dateKey,
      sleep: Number(condition.sleep),
      energy: Number(condition.energy),
      legs: Number(condition.legs),
      note: condition.note || '',
      readinessScore: result.score,
      readinessStatus: result.level.status
    };
    return db.put('conditionLogs', record).then(() => {
      AOS.store.changed('condition');
      return record;
    });
  }

  AOS.condition = { FIELDS, HELP, LEVELS, NEUTRAL, evaluate, score, levelFor, hintFor, load, save };
})(window);
