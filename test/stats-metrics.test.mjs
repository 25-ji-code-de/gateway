/*
 * Copyright 2026 The 25-ji-code-de Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 统计指标的读写一致性。
 *
 * `user_stats` 是"谁写、谁读"完全靠约定的表：
 * `updateStats`（stats.js）按事件类型往里写若干 metric_name，
 * 成就检查再按 metric_name 读出来。两边对不上时**没有任何报错** ——
 * 查询返回空行，成就就是永远解不开，用户只会觉得"这个成就好像有 bug"。
 *
 * 写这批测试时发现的：`streak_days` **只读不写**。
 * achievement-checker.js 的 checkStreakAchievement 查
 * `metric_name = 'streak_days'`，而 updateStats 的 switch 里根本没有
 * 产出这个指标的分支。所以只要生产库里有 type='streak' 的成就，
 * 它就永远解不开。
 *
 * ⚠️ 这批测试**盖不住的部分**：`type='stat'` 的成就是从数据库里读
 * `requirement.metric` 的，那个名字不在代码里，静态检查看不到。
 * 所以这里只能保证「代码里硬编码读的指标都有写入」，
 * 保证不了「数据库里配的指标都有写入」。后者要对着生产库查。
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const statsSrc = read('src/handlers/user/stats.js');
const checkerSrc = read('src/handlers/user/achievement-checker.js');

/** updateStats 会写进 user_stats 的 metric_name。 */
function writtenMetrics(src) {
  const out = new Set();
  for (const m of src.matchAll(/metric:\s*'([a-z_]+)'/g)) out.add(m[1]);
  return out;
}

/** 代码里硬编码读取的 metric_name。 */
function readMetrics(src) {
  const out = new Set();
  for (const m of src.matchAll(/metric_name\s*=\s*'([a-z_]+)'/g)) out.add(m[1]);
  return out;
}

describe('user_stats 的读写一致', () => {
  const written = writtenMetrics(statsSrc);

  test('写入的指标名就是这一组，改名要显式改这里', () => {
    /*
     * metric_name 是**跨系统的契约**：
     *   - achievements 表里 type='stat' 的行，requirement.metric 就是这些名字
     *   - hub 的面板按这些名字读数
     * 都在数据库/别的仓里，改名不会有任何编译期错误，只会让某个成就
     * 从此解不开、某个数字从此是 0。
     *
     * 所以钉住整个集合，而不只是"非空"。要加新指标就在这里加一行，
     * 顺便提醒自己去看看那两处消费方。
     */
    assert.deepEqual(
      [...written].sort(),
      [
        'messages_sent',
        'nako_conversations',
        'online_minutes',
        'pomodoros_completed',
        'songs_played',
        'study_minutes',
      ],
    );
  });

  test('成就检查读的每个指标，updateStats 都真的会写', () => {
    /*
     * 已知不成立的一项。留成显式清单而不是让测试红着 ——
     * 修它需要决定 streak_days 该由谁来算（服务端按事件日期推，
     * 还是接受客户端上报），那是产品决定，不是我能替你定的。
     * 详见 issue。
     */
    const KNOWN_UNWRITTEN = new Set(['streak_days']);

    const missing = [...readMetrics(checkerSrc)]
      .filter((m) => !written.has(m) && !KNOWN_UNWRITTEN.has(m))
      .sort();

    assert.deepEqual(
      missing,
      [],
      '这些指标被读取但从来没有被写入 —— 对应的成就永远解不开，且不会报错',
    );
  });

  test('KNOWN_UNWRITTEN 里的项确实还没被写入', () => {
    // 补上了就该从清单里删掉，否则这张表会慢慢变成谎言
    const fixed = ['streak_days'].filter((m) => written.has(m));
    assert.deepEqual(fixed, [], '这些已经会写了，请从 KNOWN_UNWRITTEN 里删掉');
  });

  test('streak_days 确实是被读的 —— 这条用例本身别失效', () => {
    // 万一 checkStreakAchievement 被改写了，上面那条"已知项"就没意义了，
    // 这里钉住它，免得清单指向一个不存在的问题
    assert.ok(readMetrics(checkerSrc).has('streak_days'));
  });
});

describe('日期分桶口径一致', () => {
  /*
   * user_stats.date 是分桶键，写和读必须用同一个口径。
   * 全部四处目前都是 `new Date().toISOString().split('T')[0]`（UTC 日）。
   *
   * 注意这与客户端不一样：25ji 的 achievements.js 用的是
   * `new Date().toDateString()`，那是**本地日**。对 UTC+8 的用户来说，
   * 服务端的"今天"在本地时间 08:00 才翻页。两边各自自洽，
   * 但"今天学了多久"这个数在两边不是同一个区间 —— 这是已知的口径差，
   * 不是这里要修的东西，记在 issue 里。
   */
  test('服务端所有日期分桶都用同一种算法', () => {
    const sources = [
      ['stats.js', statsSrc],
      ['achievement-checker.js', checkerSrc],
    ];
    const forms = new Set();
    for (const [, src] of sources) {
      for (const m of src.matchAll(/new Date\(\)\.toISOString\(\)\.(split\('T'\)\[0\]|slice\(0,\s*10\))/g)) {
        forms.add(m[1].replace(/\s+/g, ''));
      }
      // 本地日的写法混进来就是隐患
      assert.ok(
        !/new Date\(\)\.toDateString\(\)/.test(src),
        '服务端出现了本地日写法，会和 UTC 分桶对不上',
      );
    }
    assert.ok(forms.size > 0, '一处都没解析到，检查正则');
    assert.equal(forms.size, 1, `出现了 ${forms.size} 种日期分桶写法：${[...forms].join(' / ')}`);
  });
});
