#!/bin/bash

# SEKAI Pass Sync API 测试脚本

API_BASE="https://api.nightcord.de5.net"
# 需要替换为真实的 access token
ACCESS_TOKEN="your_access_token_here"

echo "=== SEKAI Pass Sync API 测试 ==="
echo ""

# 测试 1: 获取云端同步数据（首次，应该返回空）
echo "1. 获取云端同步数据（首次）"
curl -X GET "${API_BASE}/user/sync?project=25ji" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq .
echo ""

# 测试 2: 上传同步数据
echo "2. 上传同步数据"
curl -X POST "${API_BASE}/user/sync" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "project": "25ji",
    "version": 0,
    "data": {
      "pomodoro_count": 10,
      "streak_days": 3,
      "last_login_date": "2026-02-11",
      "songs_played": 25,
      "total_time": 36000,
      "today_time": 3600,
      "today_date": "2026-02-11",
      "unlocked_achievements": ["first_pomodoro", "pomodoro_10", "streak_3"],
      "recent_activities": [
        {
          "type": "pomodoro_completed",
          "timestamp": 1707654321000,
          "detail": "完成第10个番茄钟"
        }
      ]
    }
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq .
echo ""

# 测试 3: 再次获取云端数据（应该返回刚才上传的数据）
echo "3. 再次获取云端数据"
curl -X GET "${API_BASE}/user/sync?project=25ji" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq .
echo ""

# 测试 4: 上传更新的数据（测试合并逻辑）
echo "4. 上传更新的数据（测试合并）"
curl -X POST "${API_BASE}/user/sync" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "project": "25ji",
    "version": 1,
    "data": {
      "pomodoro_count": 15,
      "streak_days": 5,
      "last_login_date": "2026-02-11",
      "songs_played": 30,
      "total_time": 54000,
      "today_time": 7200,
      "today_date": "2026-02-11",
      "unlocked_achievements": ["first_pomodoro", "pomodoro_10", "streak_3", "streak_7"],
      "recent_activities": [
        {
          "type": "pomodoro_completed",
          "timestamp": 1707664321000,
          "detail": "完成第15个番茄钟"
        }
      ]
    }
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq .
echo ""

echo "=== 测试完成 ==="
