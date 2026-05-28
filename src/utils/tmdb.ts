/**
 * 将 TMDB origin_country + original_language 映射到 anime_type 枚举
 */
export function mapType(
  adult: boolean,
  language: string | undefined,
  countries: string[],
  mediaType: string
): 'movie' | 'japanese' | 'american' | 'chinese' | 'adult' {
  if (adult) return 'adult';
  if (mediaType === 'movie') return 'movie';
  if (language === 'ja' || countries.includes('JP')) return 'japanese';
  if (
    countries.includes('CN') ||
    countries.includes('TW') ||
    countries.includes('HK')
  )
    return 'chinese';
  if (countries.includes('US') || countries.includes('CA')) return 'american';
  return 'japanese';
}

/**
 * 将日期字符串的月份映射到 anime_month 枚举
 * 按季度划分：1-3月→january，4-6月→april，7-9月→july，10-12月→october
 */
export function mapMonth(
  dateStr: string | undefined | null
): 'january' | 'april' | 'july' | 'october' {
  if (!dateStr) return 'january';
  const month = new Date(dateStr).getMonth() + 1;
  if (month <= 3) return 'january';
  if (month <= 6) return 'april';
  if (month <= 9) return 'july';
  return 'october';
}
