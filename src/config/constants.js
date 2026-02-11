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
