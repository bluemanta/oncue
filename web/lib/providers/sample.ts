import type { WordCard } from '../card';
import type { CardProvider } from './types';

/**
 * 手写样本，内容照 design/Result.dc.html 抄。
 *
 * 只用来在接上真接口之前把界面做出来。拿到腾讯云 DeepSeek 的密钥后，
 * 这里会换成一次真实调用的返回结果。
 */
export const SAMPLE_CARD: WordCard = {
  word: 'schedule',
  sourceSentence: "Let's schedule a call with the client next week.",
  surface: 'schedule',
  context: {
    pos: '动词',
    gloss: '约定时间、安排',
    sentenceTranslation: '我们下周约个时间和客户通个电话。',
  },
  ipa: { us: '/ˈskedʒ.uːl/', uk: '/ˈʃedʒ.uːl/' },
  syllables: ['sched', 'ule'],
  stressIndex: 0,
  senses: [
    { pos: 'v.', meaning: '安排，约定（会议、电话等的时间）' },
    { pos: 'n.', meaning: '日程表；进度计划' },
  ],
  pitfalls: [
    '美式开头是 /sk/，读「斯-凯」，不是英式的 /ʃ/（「谢」）。',
    '结尾 -ule 读 /uːl/，最后的 /l/ 要收住，别吞掉。',
  ],
  examples: [
    { en: 'Can we schedule a demo for Friday?', zh: '我们能约在周五做个产品演示吗？' },
    { en: 'The rollout is two weeks ahead of schedule.', zh: '项目上线比计划提前了两周。' },
  ],
  note: null,
};

export const sampleProvider: CardProvider = {
  name: 'sample',
  async generateCard() {
    return { ok: true, card: SAMPLE_CARD };
  },
};
