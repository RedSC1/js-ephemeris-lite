import { ZH_HANT_CHARACTERS, ZH_HANT_PHRASES } from './zh-hant-data.js';

export const HUANGLI_LOCALE = Object.freeze({ SIMPLIFIED: 'zh-Hans', TRADITIONAL: 'zh-Hant' });
const LOCALES = new Set(Object.values(HUANGLI_LOCALE));
const PHRASES = new Map(ZH_HANT_PHRASES);
const PHRASES_BY_FIRST = new Map();
for (const [source, target] of ZH_HANT_PHRASES) {
  const matches = PHRASES_BY_FIRST.get(source[0]) ?? [];
  matches.push([source, target]);
  PHRASES_BY_FIRST.set(source[0], matches);
}
const HAN_RUN = /\p{Script=Han}+/gu;

export function validateHuangliLocale(locale) {
  if (!LOCALES.has(locale)) throw new RangeError('invalid huangli locale');
  return locale;
}

function convertRun(run) {
  const exact = PHRASES.get(run);
  if (exact !== undefined) return exact;
  let result = '';
  for (let index = 0; index < run.length;) {
    const match = (PHRASES_BY_FIRST.get(run[index]) ?? []).find(([source]) => run.startsWith(source, index));
    if (match) {
      result += match[1];
      index += match[0].length;
    } else {
      result += ZH_HANT_CHARACTERS[run[index]] ?? run[index];
      index += 1;
    }
  }
  return result;
}

/** Convert a display label without changing stable IDs or rule inputs. */
export function localizeHuangliText(text, locale = HUANGLI_LOCALE.SIMPLIFIED) {
  validateHuangliLocale(locale);
  if (typeof text !== 'string') throw new TypeError('huangli display text must be a string');
  return locale === HUANGLI_LOCALE.TRADITIONAL ? text.replace(HAN_RUN, convertRun) : text;
}

export function localizeHuangliTexts(values, locale = HUANGLI_LOCALE.SIMPLIFIED) {
  validateHuangliLocale(locale);
  return values.map(value => localizeHuangliText(value, locale));
}
