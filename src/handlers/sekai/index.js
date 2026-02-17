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

// SEKAI 路由处理

import { handleMusicData } from './music-data.js';
import { handleStickersAutocomplete } from './stickers-autocomplete.js';
import { errorResponse } from '../../utils/response.js';

export async function handleSekai(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/sekai/music_data.json') {
    return await handleMusicData(request, env, ctx);
  }

  if (path === '/sekai/stickers/autocomplete.json') {
    return await handleStickersAutocomplete(request, env, ctx);
  }

  return errorResponse('Not Found', 404);
}
