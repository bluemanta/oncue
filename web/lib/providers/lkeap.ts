import { lkeap } from 'tencentcloud-sdk-nodejs-lkeap';
import { parseWordCard, type CardResult } from '../card';
import { SYSTEM_PROMPT, buildUserPrompt, extractJson } from '../prompt';
import type { CardProvider } from './types';

/**
 * 腾讯云 LKEAP（知识引擎原子能力）上的 DeepSeek。
 *
 * 密钥只在服务端读取，永远不会打包进浏览器代码。
 * 注意 LKEAP 的模型清单和 TokenHub 不是一套：这里只有 deepseek-v3 / r1 / v3.1。
 */

const ENDPOINT = 'lkeap.ai.tencentcloudapi.com';

type ChatResponse = {
  Choices?: { Message?: { Content?: string } }[];
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`缺少环境变量 ${name}`);
  return value;
}

function createClient() {
  return new lkeap.v20240522.Client({
    credential: {
      secretId: requireEnv('TENCENT_SECRET_ID'),
      secretKey: requireEnv('TENCENT_SECRET_KEY'),
    },
    region: process.env.LKEAP_REGION || 'ap-guangzhou',
    profile: { httpProfile: { endpoint: ENDPOINT, reqTimeout: 30 } },
  });
}

export const lkeapProvider: CardProvider = {
  name: 'lkeap',

  async generateCard(input: string): Promise<CardResult> {
    let content: string;
    try {
      const response = (await createClient().ChatCompletions({
        Model: process.env.LKEAP_MODEL || 'deepseek-v3',
        Messages: [
          { Role: 'system', Content: SYSTEM_PROMPT },
          { Role: 'user', Content: buildUserPrompt(input) },
        ],
        // 低温度：这是抽取和查词，不需要模型发挥创意
        Temperature: 0.3,
        MaxTokens: 1500,
        Stream: false,
      })) as ChatResponse;
      content = response.Choices?.[0]?.Message?.Content ?? '';
    } catch (error) {
      console.error('[lkeap] 调用失败', error);
      return { ok: false, reason: 'provider_error', message: '没能连上生成服务，稍后再试一次。' };
    }

    const parsed = extractJson(content);
    if (parsed && typeof parsed === 'object' && (parsed as { error?: string }).error === 'no_english') {
      return { ok: false, reason: 'no_english', message: '没找到要查的英文单词。' };
    }

    const card = parseWordCard(parsed);
    if (!card) {
      console.error('[lkeap] 返回的结构不合规范：', content.slice(0, 500));
      return { ok: false, reason: 'provider_error', message: '这次没能生成完整的卡片，再试一次。' };
    }

    return { ok: true, card };
  },
};
