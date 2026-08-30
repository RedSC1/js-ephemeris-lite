export type HuangliLocale = 'zh-Hans' | 'zh-Hant';
export const HUANGLI_LOCALE: Readonly<{ SIMPLIFIED: 'zh-Hans'; TRADITIONAL: 'zh-Hant' }>;
export function validateHuangliLocale(locale: HuangliLocale): HuangliLocale;
export function localizeHuangliText(text: string, locale?: HuangliLocale): string;
export function localizeHuangliTexts(values: readonly string[], locale?: HuangliLocale): string[];
