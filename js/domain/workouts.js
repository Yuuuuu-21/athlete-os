/* ==========================================================
   workouts.js — the training catalogue.

   The five built-in workouts below are defaults, not the truth:
   whatever the user saves into `workoutTemplates` wins. That makes
   the catalogue editable in-app (add a home-training day, change
   A's exercises) without any screen needing to know it happened —
   `WORKOUTS` and `ORDER` are rebuilt in place, so every existing
   caller keeps working.

   Exercise ids keep Ver1's `<workout>-<slug>` shape so sessions
   already logged still match up as "last time" references. Ids of
   custom exercises are generated once and never change, even when
   the exercise is renamed, so progression keeps following them.

   metric decides what a set asks for:
     weight_reps — kg x reps      reps — reps only      time — seconds
   `core30: true` marks the exercises that survive in the
   30-minute version of a session.
   type drives the automatic adjustments: jump/power get cut when
   readiness is low, lower triggers the eve-of-match warning, and
   core/cardio never lose sets.
   ========================================================== */

(function (global) {
  const AOS = global.AOS = global.AOS || {};

  // Editor vocabulary. `note` explains what the app does with each
  // choice, because the choice changes behaviour, not just labels.
  const METRICS = [
    { id: 'weight_reps', label: '重量 × 回数', note: 'バーベル・ダンベル種目' },
    { id: 'reps', label: '回数のみ', note: '自重・ジャンプ系' },
    { id: 'time', label: '時間', note: 'プランク・有酸素' }
  ];

  const EXERCISE_TYPES = [
    { id: 'jump', label: 'ジャンプ', note: '疲労時に本数を減らす' },
    { id: 'power', label: 'パワー', note: '疲労時に本数を減らす' },
    { id: 'lower', label: '下半身', note: 'バレー前日に警告を出す' },
    { id: 'upper', label: '上半身', note: '' },
    { id: 'core', label: '体幹', note: 'セット数は減らさない' },
    { id: 'cardio', label: '有酸素', note: 'セット数は減らさない' }
  ];

  const BUILTIN = {
    A: {
      id: 'A',
      label: 'ワークアウト A',
      sub: 'LOWER + JUMP',
      trainable: true,
      focusTitle: 'JUMP QUALITY',
      focusDesc: '毎回きれいに、高く跳ぶ。着地の音を小さく。',
      exercises: [
        { id: 'A-cmj', name: 'カウンタームーブメントジャンプ', abbr: 'CMJ', metric: 'reps', sets: 3, reps: 5, type: 'jump', core30: true, cue: '毎回全力。間を空けて質を落とさない' },
        { id: 'A-box-jump', name: 'ボックスジャンプ', metric: 'reps', sets: 3, reps: 5, type: 'jump', core30: true, cue: '高さより着地の静かさ' },
        { id: 'A-squat', name: 'スクワット', metric: 'weight_reps', sets: 4, reps: 6, type: 'lower', core30: true, cue: '立ち上がりは爆発的に' },
        { id: 'A-romanian-deadlift', name: 'ルーマニアンデッドリフト', metric: 'weight_reps', sets: 3, reps: 8, type: 'lower', core30: true, cue: 'ハムの伸びを感じる範囲で' },
        { id: 'A-bulgarian-split-squat', name: 'ブルガリアンスクワット', metric: 'weight_reps', sets: 3, reps: 8, type: 'lower', core30: false, cue: '左右差を埋める種目' },
        { id: 'A-calf-raise', name: 'カーフレイズ', metric: 'weight_reps', sets: 3, reps: 12, type: 'lower', core30: false, cue: '一番上で1秒止める' },
        { id: 'A-core', name: '体幹（プランク）', metric: 'time', sets: 3, seconds: 45, type: 'core', core30: true, cue: '腰を反らさない' }
      ]
    },

    B: {
      id: 'B',
      label: 'ワークアウト B',
      sub: 'UPPER + POWER',
      trainable: true,
      focusTitle: 'MOVE FAST',
      focusDesc: '重量より動作速度。押す・引く瞬間は全力で。',
      exercises: [
        { id: 'B-med-ball-throw', name: 'メディシンボールスロー', metric: 'reps', sets: 3, reps: 6, type: 'power', core30: true, cue: '全身を連動させて投げる' },
        { id: 'B-bench-press', name: 'ベンチプレス', metric: 'weight_reps', sets: 4, reps: 6, type: 'upper', core30: true, cue: '下ろすのはゆっくり、上げるのは速く' },
        { id: 'B-lat-pulldown', name: 'ラットプルダウン', metric: 'weight_reps', sets: 3, reps: 8, type: 'upper', core30: true, cue: '肩甲骨から引く' },
        { id: 'B-shoulder-press', name: 'ショルダープレス', metric: 'weight_reps', sets: 3, reps: 8, type: 'upper', core30: true, cue: '肋骨を締めたまま' },
        { id: 'B-row', name: 'ロウイング', metric: 'weight_reps', sets: 3, reps: 10, type: 'upper', core30: false, cue: '反動を使わない' },
        { id: 'B-lateral-raise', name: 'サイドレイズ', metric: 'weight_reps', sets: 3, reps: 12, type: 'upper', core30: false, cue: '軽くていい。肩を守る種目' },
        { id: 'B-face-pull', name: 'フェイスプル', metric: 'weight_reps', sets: 3, reps: 15, type: 'upper', core30: false, cue: 'スパイク肩の予防。必ずやる' },
        { id: 'B-core', name: '体幹（回旋あり）', metric: 'time', sets: 3, seconds: 40, type: 'core', core30: true, cue: '体幹で止めて腕で振らない' }
      ]
    },

    C: {
      id: 'C',
      label: 'ワークアウト C',
      sub: 'FULL BODY',
      trainable: true,
      focusTitle: 'MOVE WELL',
      focusDesc: '疲労を残さず、可動域いっぱいに動かす。',
      exercises: [
        { id: 'C-light-jump', name: '軽めのジャンプ', metric: 'reps', sets: 3, reps: 5, type: 'jump', core30: true, cue: '疲れる前にやめる' },
        { id: 'C-upper-body', name: 'プッシュアップ', metric: 'reps', sets: 3, reps: 12, type: 'upper', core30: true, cue: '体を一直線に' },
        { id: 'C-shoulder', name: 'ショルダー補強', metric: 'weight_reps', sets: 3, reps: 12, type: 'upper', core30: true, cue: '軽い重量で丁寧に' },
        { id: 'C-arms', name: 'アーム', metric: 'weight_reps', sets: 3, reps: 12, type: 'upper', core30: false, cue: '' },
        { id: 'C-core', name: '体幹', metric: 'time', sets: 3, seconds: 45, type: 'core', core30: true, cue: '' },
        { id: 'C-zone2', name: 'Zone2 有酸素', metric: 'time', sets: 1, seconds: 1200, type: 'cardio', core30: false, cue: '会話できる強度をキープ' }
      ]
    },

    VOLLEYBALL: {
      id: 'VOLLEYBALL',
      label: 'バレーボール',
      sub: 'TEAM PRACTICE',
      trainable: false,
      focusTitle: 'GAME READY',
      focusDesc: '練習前の動的ストレッチと、助走の質。',
      checklist: ['動的ストレッチ 10分', '助走〜踏切を5本確認', '水分と補食を用意', '練習後に振り返りを記録']
    },

    REST: {
      id: 'REST',
      label: 'レスト',
      sub: 'RECOVERY',
      trainable: false,
      focusTitle: 'RECOVER',
      focusDesc: 'よく食べて、よく寝る。軽く動かして血を回す。',
      checklist: ['ストレッチ / フォームローラー 10分', '20〜30分の散歩', 'タンパク質を目標まで', '睡眠を7時間以上']
    }
  };


  const BUILTIN_ORDER = ['A', 'B', 'C', 'VOLLEYBALL', 'REST'];

  // Live registry. Screens hold references to these two, so they are
  // always mutated in place and never reassigned.
  const WORKOUTS = {};
  const ORDER = [];
  let templates = [];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function rebuild() {
    Object.keys(WORKOUTS).forEach((key) => { delete WORKOUTS[key]; });
    BUILTIN_ORDER.forEach((id) => { WORKOUTS[id] = clone(BUILTIN[id]); });

    templates.forEach((row) => {
      const base = BUILTIN[row.workoutId] ? clone(BUILTIN[row.workoutId]) : {};
      const merged = Object.assign(base, {
        id: row.workoutId,
        label: row.label,
        sub: row.sub || '',
        trainable: row.trainable !== false,
        focusTitle: row.focusTitle || '',
        focusDesc: row.focusDesc || '',
        exercises: row.exercises || [],
        templateId: row.id,
        custom: !BUILTIN[row.workoutId]
      });
      // A checklist only belongs to the rest/volleyball defaults; an
      // edited workout with exercises should never show one too.
      if (merged.exercises.length) delete merged.checklist;
      WORKOUTS[row.workoutId] = merged;
    });

    ORDER.splice(0, ORDER.length);
    ['A', 'B', 'C'].forEach((id) => ORDER.push(id));
    templates.forEach((row) => {
      if (!BUILTIN[row.workoutId]) ORDER.push(row.workoutId);
    });
    ORDER.push('VOLLEYBALL', 'REST');
  }

  function load() {
    return AOS.db.getAll('workoutTemplates').then((rows) => {
      templates = rows.slice().sort((a, b) => (a.id || 0) - (b.id || 0));
      rebuild();
      return WORKOUTS;
    });
  }

  // An id that is no longer defined still appears in old sessions and
  // in the weekly plan, so it resolves to a readable placeholder
  // rather than silently turning into a rest day's label.
  function get(id) {
    if (WORKOUTS[id]) return WORKOUTS[id];
    return {
      id: id,
      label: id,
      sub: '削除されたメニュー',
      trainable: false,
      focusTitle: '',
      focusDesc: '',
      exercises: [],
      missing: true
    };
  }

  function all() {
    return ORDER.map(get);
  }

  function isBuiltin(id) { return !!BUILTIN[id]; }
  function isEdited(id) { return !!BUILTIN[id] && templates.some((t) => t.workoutId === id); }
  function isCustom(id) { return !BUILTIN[id] && !!WORKOUTS[id]; }
  function builtinFor(id) { return BUILTIN[id] ? clone(BUILTIN[id]) : null; }
  function templateFor(id) { return templates.find((t) => t.workoutId === id) || null; }

  function newWorkoutId() {
    return 'U' + Date.now().toString(36).toUpperCase();
  }

  // Generated once at creation and kept through renames, because the
  // progression logic matches previous sessions on this id.
  function newExerciseId(workoutId) {
    return workoutId + '-x' + Math.random().toString(36).slice(2, 7);
  }

  function newExercise(workoutId) {
    return {
      id: newExerciseId(workoutId),
      name: '',
      metric: 'weight_reps',
      type: 'upper',
      sets: 3,
      reps: 10,
      seconds: 45,
      core30: true,
      cue: ''
    };
  }

  function save(workout) {
    const row = {
      workoutId: workout.id,
      label: workout.label,
      sub: workout.sub || '',
      trainable: workout.trainable !== false,
      focusTitle: workout.focusTitle || '',
      focusDesc: workout.focusDesc || '',
      exercises: workout.exercises || []
    };
    const existing = templateFor(workout.id);
    if (existing) row.id = existing.id;

    return AOS.db.put('workoutTemplates', row)
      .then(load)
      .then(() => { AOS.store.changed('workouts'); return get(workout.id); });
  }

  // Built-ins go back to their defaults; custom workouts disappear.
  function reset(id) {
    const existing = templateFor(id);
    if (!existing) return Promise.resolve();
    return AOS.db.remove('workoutTemplates', existing.id)
      .then(load)
      .then(() => AOS.store.changed('workouts'));
  }

  // Removing a workout the weekly plan still points at would leave
  // those days resolving to a placeholder, so they fall back to rest.
  function remove(id) {
    if (isBuiltin(id)) return reset(id);

    const settings = AOS.store.settings();
    const planDays = Object.assign({}, settings.planDays);
    let touched = false;
    Object.keys(planDays).forEach((dow) => {
      if (planDays[dow] === id) { planDays[dow] = 'REST'; touched = true; }
    });

    const overrides = {};
    Object.keys(settings.dayOverrides || {}).forEach((key) => {
      if (settings.dayOverrides[key] !== id) overrides[key] = settings.dayOverrides[key];
    });

    return reset(id).then(() => AOS.store.update({
      planDays: touched ? planDays : settings.planDays,
      dayOverrides: overrides
    }));
  }

  function displayName(exercise) {
    return exercise.abbr || exercise.name;
  }

  // Base prescription for a workout at a given duration, before
  // condition is taken into account.
  function exercisesFor(workoutId, duration) {
    const workout = get(workoutId);
    if (!workout.exercises || !workout.exercises.length) return [];
    if (duration !== 30) return workout.exercises.slice();
    const short = workout.exercises.filter((e) => e.core30);
    // A workout where nothing is marked for the short version would
    // otherwise produce an empty session.
    return short.length ? short : workout.exercises.slice();
  }

  // Apply today's readiness. Returns exercises with the set count
  // and a reps/seconds target that reflect how the body actually is.
  function prescribe(workoutId, duration, adjust) {
    const jumps = (adjust && adjust.jumps) || 'full';
    const setDelta = (adjust && adjust.setDelta) || 0;

    return exercisesFor(workoutId, duration).map((exercise) => {
      const isImpact = exercise.type === 'jump' || exercise.type === 'power';
      const spared = exercise.type === 'core' || exercise.type === 'cardio';
      let sets = Number(exercise.sets) + (spared ? 0 : setDelta);

      if (isImpact) {
        if (jumps === 'minimal') sets = Math.max(1, Math.round(Number(exercise.sets) / 2));
        else if (jumps === 'reduced') sets = Math.max(1, Number(exercise.sets) - (setDelta ? 1 : 0));
      }

      return Object.assign({}, exercise, { sets: Math.max(1, sets) });
    });
  }

  function targetLabel(exercise) {
    if (exercise.metric === 'time') return `${exercise.sets} × ${AOS.dom.duration(exercise.seconds)}`;
    return `${exercise.sets} × ${exercise.reps}`;
  }

  rebuild();

  AOS.workouts = {
    BUILTIN, METRICS, EXERCISE_TYPES, WORKOUTS, ORDER,
    load, get, all, save, reset, remove,
    isBuiltin, isEdited, isCustom, builtinFor, templateFor,
    newWorkoutId, newExercise,
    exercisesFor, prescribe, targetLabel, displayName
  };
})(window);
