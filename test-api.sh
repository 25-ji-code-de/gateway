#!/bin/bash

# API 测试脚本

API_BASE="https://api.nightcord.de5.net"

echo "=== SEKAI Gateway API 测试 ==="
echo ""

# 测试 1: 未认证访问
echo "1. 测试未认证访问 /user/stats"
curl -s "$API_BASE/user/stats" | jq .
echo ""

# 测试 2: 测试成就列表（需要 token）
echo "2. 测试未认证访问 /user/achievements"
curl -s "$API_BASE/user/achievements" | jq .
echo ""

# 测试 3: 测试活动时间线（需要 token）
echo "3. 测试未认证访问 /user/activity"
curl -s "$API_BASE/user/activity" | jq .
echo ""

# 测试 4: 测试事件上报（需要 token）
echo "4. 测试未认证访问 POST /user/events"
curl -s -X POST "$API_BASE/user/events" \
  -H "Content-Type: application/json" \
  -d '{"project":"nightcord","event_type":"message_sent"}' | jq .
echo ""

echo "=== 测试完成 ==="
echo ""
echo "注意：所有请求都应该返回 401 Unauthorized"
echo "要测试认证后的 API，需要提供有效的 access_token"
