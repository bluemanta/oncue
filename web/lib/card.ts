/**
 * 结果卡片的数据结构。
 *
 * 这是大模型必须照着输出的固定格式，对应 docs/PRD.md 的「结果卡片内容规范」。
 * 换供应商（腾讯云 DeepSeek / MiniMax / 混元）只换生成它的那一层，这个结构不动。
 */

export type Accent = 'us' | 'uk';

export type Sense = {
  /** 词性缩写，按设计稿显示在释义前面，例如 v. / n. / adj. */
  pos: string;
  meaning: string;
};

export type Example = {
  en: string;
  zh: string;
};

/** 语境义：只在用户给了整句时才有 */
export type Context = {
  /** 中文词性，例如「动词」 */
  pos: string;
  /** 它在这句话里的意思，例如「约定时间、安排」 */
  gloss: string;
  /** 整句的中文意思 */
  sentenceTranslation: string;
};

export type WordCard = {
  /** 要查的词，卡片大标题 */
  word: string;
  /** 拆解出的干净英文原句；只给了单词时为 null */
  sourceSentence: string | null;
  /** word 在原句里的实际写法（可能有时态变化），用来在原句上画下划线 */
  surface: string | null;
  context: Context | null;
  ipa: Record<Accent, string>;
  /** 音节，全小写；重音音节由界面负责大写显示 */
  syllables: string[];
  /** 重音落在第几个音节，从 0 开始 */
  stressIndex: number;
  /** 2–3 条，职场义项优先 */
  senses: Sense[];
  /** 中国人最容易读错的 1–2 处 */
  pitfalls: string[];
  /** 1–2 句，职场与销售场景 */
  examples: Example[];
  /** 给用户的补充说明，例如「这句里还有别的生词，这次先查 schedule」 */
  note: string | null;
};

export type CardResult =
  | { ok: true; card: WordCard }
  | { ok: false; reason: 'no_english' | 'provider_error'; message: string };

const ACCENTS: Accent[] = ['us', 'uk'];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || isNonEmptyString(value);
}

/**
 * 校验大模型返回的 JSON 是否符合上面的结构。
 *
 * 模型偶尔会少字段、把数组写成字符串、或者自作主张加一层包装。宁可在这里挡下来
 * 报错，也不要让残缺的数据流到界面上显示成空白。
 */
export function parseWordCard(value: unknown): WordCard | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;

  if (!isNonEmptyString(raw.word)) return null;
  if (!isStringOrNull(raw.sourceSentence ?? null)) return null;
  if (!isStringOrNull(raw.surface ?? null)) return null;
  if (!isStringOrNull(raw.note ?? null)) return null;

  const ipa = raw.ipa;
  if (typeof ipa !== 'object' || ipa === null) return null;
  const ipaRecord = ipa as Record<string, unknown>;
  if (!ACCENTS.every(accent => isNonEmptyString(ipaRecord[accent]))) return null;

  if (!Array.isArray(raw.syllables) || raw.syllables.length === 0) return null;
  if (!raw.syllables.every(isNonEmptyString)) return null;

  const stressIndex = raw.stressIndex;
  if (typeof stressIndex !== 'number' || !Number.isInteger(stressIndex)) return null;
  if (stressIndex < 0 || stressIndex >= raw.syllables.length) return null;

  if (!Array.isArray(raw.senses) || raw.senses.length === 0) return null;
  const senses: Sense[] = [];
  for (const entry of raw.senses) {
    if (typeof entry !== 'object' || entry === null) return null;
    const sense = entry as Record<string, unknown>;
    if (!isNonEmptyString(sense.pos) || !isNonEmptyString(sense.meaning)) return null;
    senses.push({ pos: sense.pos, meaning: sense.meaning });
  }

  if (!Array.isArray(raw.pitfalls) || !raw.pitfalls.every(isNonEmptyString)) return null;

  if (!Array.isArray(raw.examples) || raw.examples.length === 0) return null;
  const examples: Example[] = [];
  for (const entry of raw.examples) {
    if (typeof entry !== 'object' || entry === null) return null;
    const example = entry as Record<string, unknown>;
    if (!isNonEmptyString(example.en) || !isNonEmptyString(example.zh)) return null;
    examples.push({ en: example.en, zh: example.zh });
  }

  let context: Context | null = null;
  if (raw.context !== null && raw.context !== undefined) {
    if (typeof raw.context !== 'object') return null;
    const entry = raw.context as Record<string, unknown>;
    if (!isNonEmptyString(entry.pos) || !isNonEmptyString(entry.gloss) || !isNonEmptyString(entry.sentenceTranslation)) return null;
    context = { pos: entry.pos, gloss: entry.gloss, sentenceTranslation: entry.sentenceTranslation };
  }

  return {
    word: raw.word,
    sourceSentence: (raw.sourceSentence as string | null) ?? null,
    surface: (raw.surface as string | null) ?? null,
    context,
    ipa: { us: ipaRecord.us as string, uk: ipaRecord.uk as string },
    syllables: raw.syllables as string[],
    stressIndex,
    senses,
    pitfalls: raw.pitfalls as string[],
    examples,
    note: (raw.note as string | null) ?? null,
  };
}
