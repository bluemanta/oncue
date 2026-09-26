import type { CardProvider } from './types';
import { sampleProvider } from './sample';

export type { CardProvider } from './types';

/**
 * 选择当前使用的供应商。
 *
 * 目前只有样本数据。接上腾讯云 DeepSeek 后，这里按环境变量 CARD_PROVIDER 分支，
 * 默认走真接口，设成 sample 时用样本（方便断网或没有密钥时改界面）。
 */
export function getCardProvider(): CardProvider {
  return sampleProvider;
}
