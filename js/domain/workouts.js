/* ==========================================================
   workouts.js — the training catalogue.

   Exercise ids keep Ver1's `<workout>-<slug>` shape so sessions
   already logged still match up as "last time" references.

   metric decides what a set asks for:
     weight_reps — kg x reps      reps — reps only      time — seconds
   `core30: true` marks the exercises that survive in the
   30-minute version of a session.
   ========================================================== */

(function (global) {
  const AOS = global.AOS = global.AOS || {};

  const WORKOUTS = {
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

  const ORDER = ['A', 'B', 'C', 'VOLLEYBALL', 'REST'];

  function get(id) {
    return WORKOUTS[id] || WORKOUTS.REST;
  }

  function displayName(exercise) {
    return exercise.abbr || exercise.name;
  }

  // Base prescription for a workout at a given duration, before
  // condition is taken into account.
  function exercisesFor(workoutId, duration) {
    const workout = get(workoutId);
    if (!workout.exercises) return [];
    return duration === 30 ? workout.exercises.filter((e) => e.core30) : workout.exercises.slice();
  }

  // Apply today's readiness. Returns exercises with the set count
  // and a reps/seconds target that reflect how the body actually is.
  function prescribe(workoutId, duration, adjust) {
    const jumps = (adjust && adjust.jumps) || 'full';
    const setDelta = (adjust && adjust.setDelta) || 0;

    return exercisesFor(workoutId, duration).map((exercise) => {
      const isImpact = exercise.type === 'jump' || exercise.type === 'power';
      let sets = exercise.sets + (exercise.type === 'core' || exercise.type === 'cardio' ? 0 : setDelta);

      if (isImpact) {
        if (jumps === 'minimal') sets = Math.max(1, Math.round(exercise.sets / 2));
        else if (jumps === 'reduced') sets = Math.max(1, exercise.sets - (setDelta ? 1 : 0));
      }

      return Object.assign({}, exercise, { sets: Math.max(1, sets) });
    });
  }

  function targetLabel(exercise) {
    if (exercise.metric === 'time') return `${exercise.sets} × ${AOS.dom.duration(exercise.seconds)}`;
    return `${exercise.sets} × ${exercise.reps}`;
  }

  AOS.workouts = { WORKOUTS, ORDER, get, exercisesFor, prescribe, targetLabel, displayName };
})(window);
