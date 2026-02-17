# Gateway

<div align="center">

![GitHub License](https://img.shields.io/github/license/25-ji-code-de/gateway?style=flat-square&color=884499)
![GitHub stars](https://img.shields.io/github/stars/25-ji-code-de/gateway?style=flat-square&color=884499)
![GitHub forks](https://img.shields.io/github/forks/25-ji-code-de/gateway?style=flat-square&color=884499)
![GitHub issues](https://img.shields.io/github/issues/25-ji-code-de/gateway?style=flat-square&color=884499)
![GitHub last commit](https://img.shields.io/github/last-commit/25-ji-code-de/gateway?style=flat-square&color=884499)
![GitHub repo size](https://img.shields.io/github/repo-size/25-ji-code-de/gateway?style=flat-square&color=884499)
[![CodeFactor](https://img.shields.io/codefactor/grade/github/25-ji-code-de/gateway?style=flat-square&color=884499)](https://www.codefactor.io/repository/github/25-ji-code-de/gateway)

</div>

SEKAI 生态统一 API 网关 - 基于 Cloudflare Workers 的高性能 API 服务

## ✨ 特性

- 🚀 **多层缓存架构** - Edge Cache + R2 存储，极致性能
- 🔄 **智能后台刷新** - 自动更新缓存，用户无感知
- 📦 **流式处理** - 大文件零内存峰值
- 🛡️ **降级策略** - 上游失败时返回旧缓存
- 🌐 **全球加速** - Cloudflare 边缘网络

## 🎯 当前功能

### 1. SEKAI 音乐数据 API

**端点:** `GET /sekai/music_data.json`

从多个上游源聚合音乐数据，提供统一的 API 接口。

**特性：**
- 数据压缩优化（字段名缩短，v3 格式）
- 三层缓存：Edge 30s + R2 3min + Stale 10min
- 智能后台刷新（数据超过 1.5 分钟自动更新）
- 降级策略（上游失败时返回旧缓存）

**查询参数：**
- `refresh=1` - 强制刷新缓存

### 2. 资源预取 API

**端点:** `GET /assets/prefetch?path=/xxx/yyy.mp3`

按需从源站下载资源到 R2 存储。

**特性：**
- 自动去重（已存在文件直接返回）
- 流式处理（避免内存峰值）
- 永久缓存（max-age=31536000）

### 3. 用户数据同步 API

**端点:**
- `GET /user/sync?project=25ji` - 获取云端同步数据
- `POST /user/sync` - 上传本地数据到云端

用于多设备间同步用户数据（番茄钟、成就、学习时长等）。

**特性：**
- 智能数据合并（数值取最大值，时间戳取最新值）
- 版本控制（防止数据冲突）
- 自动去重（成就、活动记录）
- 需要 SEKAI Pass 认证

**请求示例：**

```bash
# 获取云端数据
curl -X GET "https://api.nightcord.de5.net/user/sync?project=25ji" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# 上传数据
curl -X POST "https://api.nightcord.de5.net/user/sync" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project": "25ji",
    "version": 0,
    "data": {
      "pomodoro_count": 10,
      "streak_days": 3,
      "total_time": 36000,
      "unlocked_achievements": ["first_pomodoro"]
    }
  }'
```

## 🚀 快速开始

### 前置要求

- Node.js 18+
- Cloudflare 账号
- Wrangler CLI

### 安装

```bash
# 克隆仓库
git clone https://github.com/25-ji-code-de/gateway.git
cd gateway

# 安装依赖
npm install
```

### 配置

```bash
cp wrangler.jsonc.example wrangler.jsonc
# 编辑 wrangler.jsonc，填入你的配置
```

### 运行

```bash
# 本地开发
npm run dev

# 部署到生产
npm run deploy
```

### 配置路由

在 Cloudflare Dashboard 中配置自定义域名：
- Workers & Pages → 你的 Worker → Settings → Triggers → Custom Domains
- 添加域名，例如：`api.yourdomain.com`

## 🏗️ 项目结构

```
gateway/
├── index.js                 # 主入口（路由分发）
├── package.json
├── wrangler.jsonc.example   # 配置示例（带 schema）
│
├── src/
│   ├── config/
│   │   └── constants.js     # 配置常量
│   │
│   ├── middleware/
│   │   └── cors.js          # CORS 处理
│   │
│   ├── handlers/
│   │   ├── sekai/           # SEKAI 相关
│   │   │   ├── music-data.js
│   │   │   └── index.js
│   │   │
│   │   ├── assets/          # 资源管理
│   │   │   ├── prefetch.js
│   │   │   └── index.js
│   │   │
│   │   └── (future modules)
│   │
│   └── utils/
│       ├── cache.js         # 缓存工具
│       └── response.js      # 响应格式化
│
├── README.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
└── LICENSE
```

## 🏗️ 架构

### 音乐数据缓存架构

```
用户请求 /sekai/music_data.json
  ↓
Edge Cache (30s) ← 最快
  ↓ MISS
R2 Cache (3min fresh, 10min stale)
  ↓ MISS
上游源站（并行请求）
  ↓
合并 + 压缩 + 存储到 R2
  ↓
返回给用户 + 写入 Edge Cache
```

### 资源预取流程

```
用户请求 /assets/prefetch?path=/xxx.mp3
  ↓
检查 R2 是否存在
  ↓ 不存在
从源站下载
  ↓
流式写入 R2
  ↓
返回成功响应
```

## 📊 缓存策略

| 层级 | TTL | 说明 |
|------|-----|------|
| Edge Cache | 30s | Cloudflare 边缘节点缓存 |
| R2 Fresh | 3min | R2 对象存储，数据新鲜期 |
| R2 Stale | 10min | 允许使用的过期数据（容错） |
| Background Refresh | 1.5min | 超过此时间触发后台刷新 |

## 🔧 配置

编辑 `src/config/constants.js`：

```javascript
export const CONFIG = {
  EDGE_TTL: 30,           // 边缘缓存 TTL（秒）
  R2_TTL: 180,            // R2 新鲜期（秒）
  STALE_TTL: 600,         // 过期数据容忍时间（秒）
  R2_KEY: 'cache/music_data_v3.json',
};
```

## 📝 API 文档

### SEKAI 音乐数据

**请求:**
```
GET /sekai/music_data.json
GET /sekai/music_data.json?refresh=1
```

**响应:**
```json
{
  "v": 3,
  "t": 1234567890000,
  "n": 500,
  "m": [
    {
      "i": 1,
      "t": "Title",
      "p": "pronunciation",
      "tz": "中文标题",
      "c": "Composer",
      "l": "Lyricist",
      "a": "assetbundleName",
      "f": 0,
      "v": [...]
    }
  ]
}
```

### 资源预取

**请求:**
```
GET /assets/prefetch?path=/mysekai/music/xxx.mp3
```

**响应:**
```json
{
  "status": "prefetched",
  "path": "/mysekai/music/xxx.mp3",
  "message": "Resource successfully cached to R2"
}
```

**状态码:**
- `200` - 成功（prefetched 或 exists）
- `400` - 缺少 path 参数
- `404` - 源站资源不存在
- `500` - 服务器错误

## 🌐 SEKAI 生态

本项目是 **SEKAI 生态**的一部分。

查看完整的项目列表和架构：**[SEKAI 门户](https://sekai.nightcord.de5.net)**

## 🤝 贡献

欢迎贡献！我们非常感谢任何形式的贡献。

在贡献之前，请阅读：
- [贡献指南](./CONTRIBUTING.md)
- [行为准则](./CODE_OF_CONDUCT.md)

## 🔒 安全

如果发现安全漏洞，请查看我们的 [安全政策](./SECURITY.md)。

## 📄 许可证

本项目采用 Apache License 2.0 许可证 - 详见 [LICENSE](./LICENSE) 文件。

## 📧 联系方式

- **GitHub Issues**: [https://github.com/25-ji-code-de/gateway/issues](https://github.com/25-ji-code-de/gateway/issues)
- **项目主页**: [https://api.nightcord.de5.net](https://api.nightcord.de5.net)
- **哔哩哔哩**: [@bili_47177171806](https://space.bilibili.com/3546904856103196)

## ⭐ Star History

如果这个项目对你有帮助，请给我们一个 Star！

[![Star History Chart](https://api.star-history.com/svg?repos=25-ji-code-de/gateway&type=Date)](https://star-history.com/#25-ji-code-de/gateway&Date)

---

<div align="center">

**[SEKAI 生态](https://sekai.nightcord.de5.net)** 的一部分

Made with 💜 by the [25-ji-code-de](https://github.com/25-ji-code-de) team

</div>
