/*
 * Copyright 2026 The 25-ji-code-de Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 25ji 双设备同步的合并逻辑。
 *
 * 两个真实缺陷：
 *
 * 1. **日期字段用字符串 `>` 比大小。** 客户端存的是
 *    `new Date().toDateString()` —— "Sun Jul 26 2026" 这种**星期几开头**
 *    的格式。字典序等于按星期名排序，连续两天里有 3/7 会选中更旧的日期。
 *
 * 2. **today_time 与 today_date 分开合并。** 一个按 Math.max，一个按
 *    "取最新"，两边各挑各的 —— 结果是昨天的数字被贴上今天的日期。
 *
 * 两个都不会报错，用户看到的是"今天已学习 3 小时"而其实是昨天的，
 * 或者连续天数莫名其妙断了。
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { mergeUserData, parseDay, compareDay, laterDay } from '../src/handlers/user/sync.js';

/** 客户端的日期格式：new Date().toDateString() */
const day = (iso) => new Date(`${iso}T12:00:00Z`).toDateString();

describe('日期比较', () => {
  test('连续两天：更晚的那天胜出（全部 7 种星期转换）', () => {
    /*
     * 这 7 组覆盖一周里每一种"今天→明天"的星期转换。
     * 原实现里 Sun→Mon、Wed→Thu、Thu→Fri 三组会选中更旧的那天，
     * 因为 "Mon" < "Sun"、"Thu" < "Wed"、"Fri" < "Thu"。
     */
    const consecutive = [
      ['2026-07-26', '2026-07-27'], // Sun → Mon
      ['2026-07-27', '2026-07-28'], // Mon → Tue
      ['2026-07-28', '2026-07-29'], // Tue → Wed
      ['2026-07-29', '2026-07-30'], // Wed → Thu
      ['2026-07-30', '2026-07-31'], // Thu → Fri
      ['2026-07-31', '2026-08-01'], // Fri → Sat
      ['2026-08-01', '2026-08-02'], // Sat → Sun
    ];

    for (const [older, newer] of consecutive) {
      assert.equal(
        laterDay(day(older), day(newer)),
        day(newer),
        `${day(older)} → ${day(newer)}：应当选更晚的那天`,
      );
      // 反过来放也一样
      assert.equal(laterDay(day(newer), day(older)), day(newer));
    }
  });

  test('跨月、跨年也对', () => {
    assert.equal(laterDay(day('2026-07-31'), day('2026-08-01')), day('2026-08-01'));
    assert.equal(laterDay(day('2026-12-27'), day('2027-01-04')), day('2027-01-04'));
  });

  test('同一天返回同一天', () => {
    assert.equal(compareDay(day('2026-07-27'), day('2026-07-27')), 0);
  });

  test('历史数据里的 ISO 串与时间戳也能比', () => {
    // 不假定只有一种格式 —— 统一走 Date 解析
    assert.equal(parseDay('2026-07-27'), new Date('2026-07-27').getTime());
    assert.equal(compareDay('2026-07-26', '2026-07-27') < 0, true);
    assert.ok(parseDay(1769472000000) !== null);
  });

  test('解析不出来的当作没有，且不会抛', () => {
    for (const bad of [null, undefined, '', '不是日期', {}, []]) {
      assert.equal(parseDay(bad), null, JSON.stringify(bad));
    }
    // 只有一边有 → 有的那边胜出
    assert.equal(laterDay(null, day('2026-07-27')), day('2026-07-27'));
    assert.equal(laterDay(day('2026-07-27'), null), day('2026-07-27'));
    assert.equal(laterDay(null, null), null);
  });
});

describe('mergeUserData —— last_login_date', () => {
  const stats = (extra) => ({ userStats: { pomodoro_count: 0, ...extra } });

  test('取更晚的登录日，不受星期名字典序影响', () => {
    // Sun → Mon 是原实现挑错的那一组
    const merged = mergeUserData(
      stats({ last_login_date: day('2026-07-26') }),
      stats({ last_login_date: day('2026-07-27') }),
    );
    assert.equal(merged.userStats.last_login_date, day('2026-07-27'));
  });

  test('云端更晚时保留云端的', () => {
    const merged = mergeUserData(
      stats({ last_login_date: day('2026-07-30') }),
      stats({ last_login_date: day('2026-07-29') }),
    );
    assert.equal(merged.userStats.last_login_date, day('2026-07-30'));
  });
});

describe('mergeUserData —— today_time 与 today_date 是一对', () => {
  const stats = (today_time, today_date) => ({
    userStats: { today_time, today_date: today_date === null ? null : day(today_date) },
  });

  test('同一天才取最大值', () => {
    const merged = mergeUserData(stats(3600, '2026-07-27'), stats(1800, '2026-07-27'));
    assert.equal(merged.userStats.today_time, 3600);
    assert.equal(merged.userStats.today_date, day('2026-07-27'));
  });

  test('不同天时整对采用更晚的那一天 —— 不能把昨天的数字贴到今天', () => {
    /*
     * 这就是那个 bug 的原貌：
     *   云端 昨天学了 3 小时（10800 / 07-26）
     *   本地 今天刚开始 10 分钟（600 / 07-27）
     * 分开合并 → today_time = max(10800, 600) = 10800，today_date = 07-27
     *          → 用户看到"今天已学习 3 小时"
     */
    const merged = mergeUserData(stats(10800, '2026-07-26'), stats(600, '2026-07-27'));
    assert.equal(merged.userStats.today_date, day('2026-07-27'), '应当是今天');
    assert.equal(merged.userStats.today_time, 600, '今天就是 600 秒，昨天的 10800 不算');
  });

  test('反过来：云端是今天、本地是昨天', () => {
    const merged = mergeUserData(stats(600, '2026-07-27'), stats(10800, '2026-07-26'));
    assert.equal(merged.userStats.today_date, day('2026-07-27'));
    assert.equal(merged.userStats.today_time, 600);
  });

  test('一边没有日期时不会把另一边的数值张冠李戴', () => {
    const merged = mergeUserData(stats(10800, null), stats(600, '2026-07-27'));
    assert.equal(merged.userStats.today_date, day('2026-07-27'));
    assert.equal(merged.userStats.today_time, 600);
  });
});

describe('mergeUserData —— 畸形数据不能把同步弄死', () => {
  /*
   * 这个函数的两个入参都是**用户可控**的：
   *
   *   localData  直接来自请求体，uploadSyncData 只校验了 typeof === 'object'
   *   cloudData  是之前某次上传原样存下来的 —— 首次上传（云端还没有行）
   *              根本不走合并，所以任意形状都能落库
   *
   * 于是存一次畸形数据之后，每次「客户端版本落后」的同步都会走到这里，
   * 一路抛到 500，**这个用户的同步永久卡死**，得改库才能救。
   *
   * 下面这些形状实测都能触发（修复前）：
   *   recent_activities 里有 null      → Cannot read properties of null
   *   recent_activities 是对象          → not iterable
   *   unlocked_achievements 是数字      → not iterable
   */
  const good = {
    userStats: { pomodoro_count: 1, recent_activities: [], unlocked_achievements: [] },
  };

  const MALFORMED = [
    ['recent_activities 里混着 null / 字符串 / 数字', { userStats: { recent_activities: [null, 'x', 5] } }],
    ['recent_activities 是对象', { userStats: { recent_activities: { a: 1 } } }],
    ['recent_activities 是字符串', { userStats: { recent_activities: 'oops' } }],
    ['unlocked_achievements 是数字', { userStats: { unlocked_achievements: 42 } }],
    ['unlocked_achievements 是字符串', { userStats: { unlocked_achievements: 'abc' } }],
    ['userStats 是字符串', { userStats: 'nope' }],
    ['userStats 是数组', { userStats: [1, 2, 3] }],
    ['preferences 是字符串', { userStats: {}, preferences: 'x', preferences_modified: true }],
    ['cdPlayer 是数字', { userStats: {}, cdPlayer: 1, cdPlayer_used: true }],
    ['worldClockTimeZones 是字符串', { userStats: {}, preferences: { worldClockTimeZones: 'x' }, preferences_modified: true }],
    ['playlists 里有 null', { userStats: {}, cdPlayer: { playlists: [null, { id: 1 }] }, cdPlayer_used: true }],
    ['favorites 是对象', { userStats: {}, cdPlayer: { favorites: { a: 1 } }, cdPlayer_used: true }],
    ['数值字段是对象', { userStats: { total_time: { a: 1 } } }],
    ['整个 data 是数组', [1, 2]],
  ];

  for (const [label, bad] of MALFORMED) {
    for (const [dir, cloud, local] of [
      ['云端畸形', bad, good],
      ['本地畸形', good, bad],
    ]) {
      test(`${label}（${dir}）`, () => {
        const merged = mergeUserData(cloud, local);

        // 不抛只是及格线，产出还得是能用的结构
        assert.ok(Array.isArray(merged.userStats.recent_activities), 'recent_activities 必须是数组');
        assert.ok(Array.isArray(merged.userStats.unlocked_achievements), 'unlocked_achievements 必须是数组');
        for (const f of ['pomodoro_count', 'streak_days', 'songs_played', 'total_time', 'today_time']) {
          assert.ok(Number.isFinite(merged.userStats[f]), `${f} 必须是有限数，得到 ${merged.userStats[f]}`);
        }
      });
    }
  }

  test('字符串不会被拆成一个个字符塞进成就列表', () => {
    // [...'abc'] 是 ['a','b','c'] —— 不判数组的话就会这样
    const merged = mergeUserData({ userStats: { unlocked_achievements: 'abc' } }, good);
    assert.deepEqual(merged.userStats.unlocked_achievements, []);
  });

  test('活动记录里的坏元素被跳过，好元素保留', () => {
    const merged = mergeUserData(
      { userStats: { recent_activities: [null, { type: 'a', timestamp: 100 }, 'x'] } },
      { userStats: { recent_activities: [{ type: 'b', timestamp: 200 }] } },
    );
    assert.deepEqual(
      merged.userStats.recent_activities.map((a) => a.type),
      ['b', 'a'],
    );
  });

  test('旧格式（统计直接放在根上）仍然认', () => {
    // `asObject(cloudData).userStats || cloudData` 里的 `|| cloudData`
    // 就是为这个留的：早期的 data 没有 userStats 这一层
    const legacy = { pomodoro_count: 5, total_time: 3600, unlocked_achievements: ['a'] };
    const modern = { userStats: { pomodoro_count: 2, total_time: 100, unlocked_achievements: ['b'] } };

    const a = mergeUserData(legacy, modern);
    assert.equal(a.userStats.pomodoro_count, 5);
    assert.equal(a.userStats.total_time, 3600);
    assert.deepEqual(a.userStats.unlocked_achievements.sort(), ['a', 'b']);

    const b = mergeUserData(modern, legacy);
    assert.equal(b.userStats.pomodoro_count, 5);
    assert.deepEqual(b.userStats.unlocked_achievements.sort(), ['a', 'b']);
  });

  test('时区列表是字符串时不会被原样返回出去', () => {
    // 原来是 `if (!cloudZones) return localZones` —— 会把字符串当列表返回
    const merged = mergeUserData(
      { userStats: {}, preferences: { worldClockTimeZones: 'not-a-list' } },
      { userStats: {}, preferences: {}, preferences_modified: true },
    );
    const zones = merged.preferences.worldClockTimeZones;
    assert.ok(zones === null || Array.isArray(zones), `得到 ${JSON.stringify(zones)}`);
  });
});

describe('mergeUserData —— 其余字段没被改坏', () => {
  test('累计数值仍然取最大值', () => {
    const merged = mergeUserData(
      { userStats: { pomodoro_count: 10, total_time: 3600, songs_played: 5, streak_days: 3 } },
      { userStats: { pomodoro_count: 7, total_time: 7200, songs_played: 9, streak_days: 2 } },
    );
    assert.equal(merged.userStats.pomodoro_count, 10);
    assert.equal(merged.userStats.total_time, 7200);
    assert.equal(merged.userStats.songs_played, 9);
    assert.equal(merged.userStats.streak_days, 3);
  });

  test('成就合并去重', () => {
    const merged = mergeUserData(
      { userStats: { unlocked_achievements: ['a', 'b'] } },
      { userStats: { unlocked_achievements: ['b', 'c'] } },
    );
    assert.deepEqual(merged.userStats.unlocked_achievements.sort(), ['a', 'b', 'c']);
  });

  test('活动记录合并、按时间倒序、最多 50 条', () => {
    const mk = (n, offset) =>
      Array.from({ length: n }, (_, i) => ({ type: 't', timestamp: offset + i, detail: 'x' }));
    const merged = mergeUserData(
      { userStats: { recent_activities: mk(40, 1000) } },
      { userStats: { recent_activities: mk(40, 5000) } },
    );
    const acts = merged.userStats.recent_activities;
    assert.equal(acts.length, 50);
    for (let i = 1; i < acts.length; i++) {
      assert.ok(acts[i - 1].timestamp >= acts[i].timestamp, '必须按时间倒序');
    }
  });

  test('客户端 userStats 的每个字段都被合并逻辑覆盖到', () => {
    /*
     * merged.userStats 是按固定字段表**重建**的，表外的字段会被静默丢掉。
     * 现在客户端那 9 个字段都在表内，但加第 10 个的时候很容易忘 ——
     * 忘了的表现是"偶尔丢数据"（只在走合并分支时丢），最难查的那种。
     *
     * 字段表来自 25ji-sagyo/js/features/achievements.js 里 userStats 的初始值。
     */
    const CLIENT_FIELDS = [
      'pomodoro_count', 'streak_days', 'last_login_date', 'songs_played',
      'total_time', 'today_time', 'today_date', 'unlocked_achievements',
      'recent_activities',
    ];
    const input = Object.fromEntries(CLIENT_FIELDS.map((f) => [f, undefined]));
    const merged = mergeUserData({ userStats: { ...input } }, { userStats: { ...input } });
    const missing = CLIENT_FIELDS.filter((f) => !(f in merged.userStats));
    assert.deepEqual(missing, [], '这些字段会在合并时被静默丢掉');
  });
});
