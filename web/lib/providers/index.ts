import type { CardProvider } from './types';
import { sampleProvider } from './sample';
import { lkeapProvider } from './lkeap';

export type { CardProvider } from './types';

/**
 * 选择当前使用的供应商。
 *
 * CARD_PROVIDER=sample 时用手写样本——断网、没密钥或者只想改界面时很方便。
 * 以后接 MiniMax 或混元，在这里加一个分支即可，卡片界面不用动。
 */
export function getCardProvider(): CardProvider {
  switch (process.env.CARD_PROVIDER) {
    case 'sample':
      return sampleProvider;
    default:
      return lkeapProvider;
  }
}
