/*
 * Copyright 2026 The 25-ji-code-de Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 可以调用 SEKAI 生态内部 API 的 OAuth client。
 *
 * client_id 是公开标识符，不是密钥；安全性来自 SEKAI Pass 保证 client_id
 * 全局唯一、token 中的 client_id 由授权服务器写入且调用方无法伪造。
 *
 * gateway 不是第三方开放平台。新增生态客户端时必须在代码评审中显式加入，
 * 不能让任意合法的 SEKAI Pass token 自动获得同步数据的读写权限。
 */
export const FIRST_PARTY_CLIENT_IDS = Object.freeze([
  '25ji_client',
  'nightcord_client',
  'sekai_hub_client',
  'st_client',
  'client-pico-AC7D9279977E0954',
]);

/** @param {unknown} clientId */
export function isFirstPartyClient(clientId) {
  return typeof clientId === 'string' && FIRST_PARTY_CLIENT_IDS.includes(clientId);
}
