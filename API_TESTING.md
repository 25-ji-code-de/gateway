# User Data API 测试指南

## API 端点

所有 `/user/*` 端点都需要认证（Bearer token）。

### 1. 获取用户统计

```bash
GET /user/stats?project=nightcord&date=2026-02-11
Authorization: Bearer <access_token>
```

**响应示例：**
```json
{
  "user_id": "user_xxx",
  "date": "2026-02-11",
  "stats": {
    "nightcord": {
      "messages_sent": "23",
      "online_minutes": "90"
    }
  }
}
```

### 2. 上报用户事件

```bash
POST /user/events
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "project": "nightcord",
  "event_type": "message_sent",
  "metadata": {
    "room": "general"
  }
}
```

**支持的事件类型：**
- `message_sent` - 发送消息（nightcord）
- `online_time` - 在线时长（nightcord）
- `pomodoro_completed` - 完成番茄钟（25ji）
- `song_played` - 播放歌曲（25ji）
- `nako_conversation` - Nako 对话（nightcord）

**响应示例：**
```json
{
  "success": true,
  "message": "Event reported successfully"
}
```

### 3. 获取活动时间线

```bash
GET /user/activity?limit=20&offset=0
Authorization: Bearer <access_token>
```

**响应示例：**
```json
{
  "user_id": "user_xxx",
  "activities": [
    {
      "project": "nightcord",
      "event_type": "message_sent",
      "metadata": {"room": "general"},
      "created_at": 1707654321000
    }
  ],
  "limit": 20,
  "offset": 0
}
```

### 4. 获取用户成就

```bash
GET /user/achievements
Authorization: Bearer <access_token>
```

**响应示例：**
```json
{
  "user_id": "user_xxx",
  "achievements": [
    {
      "id": "msg_1000",
      "name": "话痨",
      "description": "在 Nightcord 发送 1000 条消息",
      "icon": "💬",
      "project": "nightcord",
      "type": "stat",
      "requirement": {
        "type": "stat",
        "project": "nightcord",
        "metric": "messages_sent",
        "value": 1000
      },
      "progress": 23,
      "unlocked": false,
      "unlocked_at": null
    }
  ]
}
```

### 5. 获取云端同步数据

```bash
GET /user/sync?project=25ji
Authorization: Bearer <access_token>
```

**响应示例（首次同步）：**
```json
{
  "user_id": "user_xxx",
  "project": "25ji",
  "data": null,
  "version": 0,
  "updated_at": null
}
```

**响应示例（已有数据）：**
```json
{
  "user_id": "user_xxx",
  "project": "25ji",
  "data": {
    "pomodoro_count": 10,
    "streak_days": 3,
    "last_login_date": "2026-02-11",
    "songs_played": 25,
    "total_time": 36000,
    "today_time": 3600,
    "today_date": "2026-02-11",
    "unlocked_achievements": ["first_pomodoro", "pomodoro_10"],
    "recent_activities": [...]
  },
  "version": 5,
  "updated_at": 1707654321000
}
```

### 6. 上传同步数据

```bash
POST /user/sync
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "project": "25ji",
  "version": 5,
  "data": {
    "pomodoro_count": 15,
    "streak_days": 5,
    "total_time": 54000,
    "unlocked_achievements": ["first_pomodoro", "pomodoro_10", "streak_3"]
  }
}
```

**响应示例：**
```json
{
  "success": true,
  "user_id": "user_xxx",
  "project": "25ji",
  "data": {
    "pomodoro_count": 15,
    "streak_days": 5,
    "total_time": 54000,
    "unlocked_achievements": ["first_pomodoro", "pomodoro_10", "streak_3"]
  },
  "version": 6,
  "updated_at": 1707664321000
}
```

**数据合并策略：**
- 数值类型（pomodoro_count, total_time 等）：取最大值
- 时间戳类型（last_login_date 等）：取最新值
- 数组类型（unlocked_achievements）：合并去重
- 活动记录：合并并按时间排序，保留最近 50 条

## 如何获取 Access Token

### 方法 1: 通过 SEKAI Hub 登录

1. 访问 https://sekai.nightcord.de5.net
2. 点击"登录"
3. 授权后，在浏览器控制台执行：
   ```javascript
   localStorage.getItem('access_token')
   ```

### 方法 2: 直接使用 OAuth 流程

```bash
# 1. 获取授权码（在浏览器中访问）
https://id.nightcord.de5.net/oauth/authorize?client_id=sekai_hub_client&redirect_uri=http://localhost:8081/callback&response_type=code&scope=openid%20profile%20email&state=xxx&code_challenge=xxx&code_challenge_method=S256

# 2. 交换 access token
curl -X POST https://id.nightcord.de5.net/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=xxx&redirect_uri=http://localhost:8081/callback&client_id=sekai_hub_client&code_verifier=xxx"
```

## 完整测试示例

```bash
#!/bin/bash

# 从环境变量获取 token
TOKEN="${SEKAI_ACCESS_TOKEN}"

if [ -z "$TOKEN" ]; then
  echo "请设置 SEKAI_ACCESS_TOKEN 环境变量"
  exit 1
fi

API_BASE="https://api.nightcord.de5.net"

# 1. 上报事件
echo "上报消息发送事件..."
curl -X POST "$API_BASE/user/events" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project":"nightcord","event_type":"message_sent"}'

# 2. 查询统计
echo -e "\n\n查询今日统计..."
curl "$API_BASE/user/stats" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 3. 查询成就
echo -e "\n\n查询成就列表..."
curl "$API_BASE/user/achievements" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 4. 查询活动
echo -e "\n\n查询活动时间线..."
curl "$API_BASE/user/activity?limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 5. 获取云端同步数据
echo -e "\n\n获取云端同步数据..."
curl "$API_BASE/user/sync?project=25ji" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 6. 上传同步数据
echo -e "\n\n上传同步数据..."
curl -X POST "$API_BASE/user/sync" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project": "25ji",
    "version": 0,
    "data": {
      "pomodoro_count": 10,
      "streak_days": 3,
      "total_time": 36000
    }
  }' | jq .
```

## 数据库查询（调试用）

```bash
# 查看用户统计
npx wrangler d1 execute pjsekai_db --remote --command "SELECT * FROM user_stats LIMIT 10;"

# 查看用户活动
npx wrangler d1 execute pjsekai_db --remote --command "SELECT * FROM user_activities ORDER BY created_at DESC LIMIT 10;"

# 查看成就列表
npx wrangler d1 execute pjsekai_db --remote --command "SELECT * FROM achievements;"

# 查看用户成就
npx wrangler d1 execute pjsekai_db --remote --command "SELECT * FROM user_achievements LIMIT 10;"

# 查看同步数据
npx wrangler d1 execute pjsekai_db --remote --command "SELECT user_id, project, version, updated_at FROM user_sync_data LIMIT 10;"
```

## 验证清单

- [x] 未认证请求返回 401
- [ ] 有效 token 可以访问 API
- [ ] 事件上报成功并更新统计
- [ ] 统计数据正确聚合
- [ ] 成就系统正常工作
- [ ] 活动时间线正确记录
- [ ] 云端同步数据上传成功
- [ ] 云端同步数据下载成功
- [ ] 数据合并逻辑正确（取最大值/最新值）

## 下一步

Phase 3: 集成到前端项目
- 25ji 集成云端同步功能
- nightcord 集成数据上报
- Hub 显示真实数据
