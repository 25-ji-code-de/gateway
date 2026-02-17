/*
 * Copyright 2026 The 25-ji-code-de Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// 配置常量

export const CONFIG = {
  // 缓存配置
  EDGE_TTL: 30,           // 边缘缓存 30 秒
  R2_TTL: 180,            // R2 新鲜期 3 分钟
  STALE_TTL: 600,         // 允许使用 10 分钟内的过期数据
  R2_KEY: 'cache/music_data_v3.json',
};

export const DATA_SOURCES = {
  musics: 'https://sekai-world.github.io/sekai-master-db-diff/musics.json',
  musicVocals: 'https://sekai-world.github.io/sekai-master-db-diff/musicVocals.json',
  musicTitles: 'https://i18n-json.sekai.best/zh-CN/music_titles.json',
  stickersAutocomplete: 'https://sticker.nightcord.de5.net/autocomplete.json',
};

export const ORIGIN = {
  sekai: 'https://storage.sekai.best/sekai-jp-assets',
};
