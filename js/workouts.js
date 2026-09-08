/* ==========================================================
   workouts.js — static Ver1 workout config
   Day numbers follow Date#getDay(): Sun=0 ... Sat=6
   This will move into a real "workoutTemplates" DB record
   once the TRAINING screen exists; kept as a plain object
   for now on purpose.
   ========================================================== */

(function (global) {
  const WORKOUTS = {
    A: {
      id: 'A',
      label: 'Workout A',
      sub: 'LOWER + JUMP',
      day: 1, // Monday
      focusTitle: 'JUMP QUALITY',
      focusDesc: '毎回きれいに高く跳ぶ',
      accent: true
    },
    B: {
      id: 'B',
      label: 'Workout B',
      sub: 'UPPER + POWER',
      day: 3, // Wednesday
      focusTitle: 'MOVE FAST',
      focusDesc: '重量より動作速度を意識する',
      accent: false
    },
    C: {
      id: 'C',
      label: 'Workout C',
      sub: 'FULL BODY',
      day: null,
      focusTitle: 'MOVE WELL',
      focusDesc: '疲労を残さず身体を動かす',
      accent: false
    },
    VOLLEYBALL: {
      id: 'VOLLEYBALL',
      label: 'Volleyball',
      sub: 'TEAM PRACTICE',
      day: 6, // Saturday
      focusTitle: 'GAME READY',
      focusDesc: '動きの質を優先する',
      accent: true
    },
    REST: {
      id: 'REST',
      label: 'Rest',
      sub: 'RECOVERY DAY',
      day: null,
      focusTitle: 'RECOVER',
      focusDesc: 'しっかり回復する',
      accent: false
    }
  };

  const WORKOUT_ORDER = ['A', 'B', 'C', 'VOLLEYBALL', 'REST'];

  global.Workouts = { WORKOUTS, WORKOUT_ORDER };
})(window);
