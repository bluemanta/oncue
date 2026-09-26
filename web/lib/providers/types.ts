import type { CardResult } from '../card';

/**
 * 统一接口：生成结果卡片的能力。
 *
 * 腾讯云 DeepSeek、MiniMax、混元各写一个实现，产品其他部分只认这个类型。
 * 换供应商时只改 providers/ 下面的文件和一个环境变量。
 */
export type CardProvider = {
  name: string;
  generateCard(input: string): Promise<CardResult>;
};
