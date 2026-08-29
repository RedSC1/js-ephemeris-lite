const SECONDS_PER_DAY = 86400;
const MILLISECONDS_PER_DAY = 86400000;
const UNIX_EPOCH_JD = 2440587.5;
const S15_START_YEAR = -720;
const EARLY_JOIN_START_YEAR = -820;

// Stephenson, Morrison & Hohenkerk (2016), stored as
// [start year, end year, cubic, quadratic, linear, constant].
// The local coordinate of each segment runs from 0 to 1.
const S15_SPLINE = [
  [-720, -100, 409.160, 776.247, -9999.586, 20371.848],
  [-100, 400, -503.433, 1303.151, -5822.270, 11557.668],
  [400, 1000, 1085.087, -298.291, -5671.519, 6535.116],
  [1000, 1150, -25.346, 184.811, -753.210, 1650.393],
  [1150, 1300, -24.641, 108.771, -459.628, 1056.647],
  [1300, 1500, -29.414, 61.953, -421.345, 681.149],
  [1500, 1600, 16.197, -6.572, -192.841, 292.343],
  [1600, 1650, 3.018, 10.505, -78.697, 109.127],
  [1650, 1720, -2.127, 38.333, -68.089, 43.952],
  [1720, 1800, -37.939, 41.731, 2.507, 12.068],
  [1800, 1810, 1.918, -1.126, -3.481, 18.367],
  [1810, 1820, -3.812, 4.629, 0.021, 15.678],
  [1820, 1830, 3.250, -6.806, -2.157, 16.516],
  [1830, 1840, -0.096, 2.944, -6.018, 10.804],
  [1840, 1850, -0.539, 2.658, -0.416, 7.634],
  [1850, 1855, -0.883, 0.261, 1.642, 9.338],
  [1855, 1860, 1.558, -2.389, -0.486, 10.357],
  [1860, 1865, -2.477, 2.284, -0.591, 9.040],
  [1865, 1870, 2.720, -5.148, -3.456, 8.255],
  [1870, 1875, -0.914, 3.011, -5.593, 2.371],
  [1875, 1880, -0.039, 0.269, -2.314, -1.126],
  [1880, 1885, 0.563, 0.152, -1.893, -3.210],
  [1885, 1890, -1.438, 1.842, 0.101, -4.388],
  [1890, 1895, 1.871, -2.474, -0.531, -3.884],
  [1895, 1900, -0.232, 3.138, 0.134, -5.017],
  [1900, 1905, -1.257, 2.443, 5.715, -1.977],
  [1905, 1910, 0.720, -1.329, 6.828, 4.923],
  [1910, 1915, -0.825, 0.831, 6.330, 11.142],
  [1915, 1920, 0.262, -1.643, 5.518, 17.479],
  [1920, 1925, 0.008, -0.856, 3.020, 21.617],
  [1925, 1930, 0.127, -0.831, 1.333, 23.789],
  [1930, 1935, 0.142, -0.449, 0.052, 24.418],
  [1935, 1940, 0.702, -0.022, -0.419, 24.164],
  [1940, 1945, -1.106, 2.086, 1.645, 24.426],
  [1945, 1950, 0.614, -1.232, 2.499, 27.050],
  [1950, 1953, -0.277, 0.220, 1.127, 28.932],
];

// Annual observed/predicted values. Since the years are consecutive, storing
// just the ordinates avoids repeating 1953..2050 in the runtime bundle.
const ANNUAL_START_YEAR = 1953;
const ANNUAL_DELTA_T = [
  30.00, 30.20, 30.41, 30.76, 31.34, 32.03, 32.65, 33.07,
  33.36, 33.62, 33.96, 34.44, 35.09, 35.95, 36.93, 37.95,
  38.95, 39.93, 40.95, 42.14, 43.38, 44.48, 45.48, 46.46,
  47.52, 48.53, 49.59, 50.54, 51.38, 52.17, 52.96, 53.79,
  54.34, 54.87, 55.32, 55.82, 56.30, 56.86, 57.57, 58.31,
  59.12, 59.98, 60.79, 61.63, 62.30, 62.97, 63.47, 63.83,
  64.09, 64.30, 64.47, 64.57, 64.69, 64.85, 65.15, 65.46,
  65.78, 66.07, 66.32, 66.60, 66.91, 67.28, 67.64, 68.10,
  68.59, 68.97, 69.22, 69.36, 69.36, 69.29, 69.20, 69.18,
  69.14, 69.11, 69.10, 69.08, 69.07, 69.08, 69.09, 69.12,
  69.16, 69.20, 69.26, 69.33, 69.41, 69.51, 69.61, 69.72,
  69.85, 69.98, 70.13, 70.28, 70.45, 70.63, 70.81, 71.01,
  71.22, 71.44,
];
const ANNUAL_END_YEAR = ANNUAL_START_YEAR + ANNUAL_DELTA_T.length - 1;

function longTermDeltaT(year) {
  const u = (year - 1820) / 100;
  return -20 + 32 * u * u;
}

function longTermDeltaTRate(year) {
  return 64 * (year - 1820) / 10000;
}

function evaluateS15(year) {
  for (const [x0, x1, a3, a2, a1, a0] of S15_SPLINE) {
    if (year >= x0 && year < x1) {
      const x = (year - x0) / (x1 - x0);
      return ((a3 * x + a2) * x + a1) * x + a0;
    }
  }
  const [, , a3, a2, a1, a0] = S15_SPLINE.at(-1);
  return ((a3 + a2) + a1) + a0;
}

function evaluateS15Rate(year) {
  for (const [x0, x1, a3, a2, a1] of S15_SPLINE) {
    if (year >= x0 && year < x1) {
      const x = (year - x0) / (x1 - x0);
      return (3 * a3 * x * x + 2 * a2 * x + a1) / (x1 - x0);
    }
  }
  const [x0, x1, a3, a2, a1] = S15_SPLINE.at(-1);
  return (3 * a3 + 2 * a2 + a1) / (x1 - x0);
}

// The original C++ model hard-switches at -720, where the long-term
// parabola and S15 differ by 253.272 seconds. Bridge only the preceding
// century and match both endpoint slopes, leaving both source models intact
// outside the join interval.
function earlyJoinDeltaT(year) {
  const x0 = EARLY_JOIN_START_YEAR;
  const x1 = S15_START_YEAR;
  const span = x1 - x0;
  const x = (year - x0) / span;
  const x2 = x * x;
  const x3 = x2 * x;
  const p0 = longTermDeltaT(x0);
  const p1 = evaluateS15(x1);
  const m0 = longTermDeltaTRate(x0) * span;
  const m1 = evaluateS15Rate(x1) * span;
  return (2 * x3 - 3 * x2 + 1) * p0
    + (x3 - 2 * x2 + x) * m0
    + (-2 * x3 + 3 * x2) * p1
    + (x3 - x2) * m1;
}

// Catmull-Rom represented as cubic Hermite interpolation. At either end of
// the annual table a duplicated control point gives the same one-sided slope
// convention as the C++ implementation.
function interpolateAnnualDeltaT(year) {
  const index = Math.floor(year) - ANNUAL_START_YEAR;
  const i0 = Math.max(index - 1, 0);
  const i1 = index;
  const i2 = Math.min(index + 1, ANNUAL_DELTA_T.length - 1);
  const i3 = Math.min(index + 2, ANNUAL_DELTA_T.length - 1);
  const t0 = ANNUAL_START_YEAR + i0;
  const t1 = ANNUAL_START_YEAR + i1;
  const t2 = ANNUAL_START_YEAR + i2;
  const t3 = ANNUAL_START_YEAR + i3;
  const p0 = ANNUAL_DELTA_T[i0];
  const p1 = ANNUAL_DELTA_T[i1];
  const p2 = ANNUAL_DELTA_T[i2];
  const p3 = ANNUAL_DELTA_T[i3];
  const dt = t2 - t1;
  const x = (year - t1) / dt;
  const m1 = (p2 - p0) / (t2 - t0) * dt;
  const m2 = (p3 - p1) / (t3 - t1) * dt;
  const x2 = x * x;
  const x3 = x2 * x;
  return (2 * x3 - 3 * x2 + 1) * p1
    + (x3 - 2 * x2 + x) * m1
    + (-2 * x3 + 3 * x2) * p2
    + (x3 - x2) * m2;
}

/** Estimated TT - UT1 in seconds for a decimal calendar year. */
export function deltaTSeconds(decimalYear) {
  if (!Number.isFinite(decimalYear)) return decimalYear;
  if (decimalYear >= S15_START_YEAR && decimalYear < ANNUAL_START_YEAR) {
    return evaluateS15(decimalYear);
  }
  if (decimalYear >= ANNUAL_START_YEAR && decimalYear < ANNUAL_END_YEAR) {
    return interpolateAnnualDeltaT(decimalYear);
  }
  if (decimalYear < EARLY_JOIN_START_YEAR || decimalYear > ANNUAL_END_YEAR + 100) {
    return longTermDeltaT(decimalYear);
  }
  if (decimalYear < S15_START_YEAR) return earlyJoinDeltaT(decimalYear);

  // Join the last annual value continuously to the long-term parabola over
  // 2050..2150. The value is continuous; this intentionally mirrors the C++
  // model rather than inventing another far-future fit.
  const annualEndValue = ANNUAL_DELTA_T.at(-1);
  const parabola = longTermDeltaT(decimalYear);
  const mismatchAtEnd = longTermDeltaT(ANNUAL_END_YEAR) - annualEndValue;
  const blend = (ANNUAL_END_YEAR + 100 - decimalYear) / 100;
  return parabola - mismatchAtEnd * blend;
}

function julianDayAtYearStart(year) {
  let adjustedYear = year - 1;
  const adjustedMonth = 13;
  let gregorianCorrection = 0;
  if (year > 1582) {
    const century = Math.trunc(adjustedYear / 100);
    gregorianCorrection = 2 - century + Math.trunc(century / 4);
  }
  return Math.floor(365.25 * (adjustedYear + 4716))
    + Math.floor(30.6001 * (adjustedMonth + 1))
    + 1 + gregorianCorrection - 1524.5;
}

/** Hybrid Julian/Gregorian calendar to Julian Day (switch at 1582-10-15). */
export function julianDay({ year, month, day, hour = 0, minute = 0, second = 0 }) {
  if (![year, month, day, hour, minute, second].every(Number.isFinite)) {
    throw new TypeError('calendar fields must be finite');
  }
  let adjustedYear = Math.trunc(year);
  let adjustedMonth = Math.trunc(month);
  if (adjustedMonth <= 2) {
    adjustedYear -= 1;
    adjustedMonth += 12;
  }
  const isGregorian = year > 1582
    || (year === 1582 && (month > 10 || (month === 10 && day >= 15)));
  let correction = 0;
  if (isGregorian) {
    const century = Math.trunc(adjustedYear / 100);
    correction = 2 - century + Math.trunc(century / 4);
  }
  const dayFraction = (hour + (minute + second / 60) / 60) / 24;
  return Math.floor(365.25 * (adjustedYear + 4716))
    + Math.floor(30.6001 * (adjustedMonth + 1))
    + day + dayFraction + correction - 1524.5;
}

/** Julian Day to the hybrid Julian/Gregorian calendar used by the C++ layer. */
export function calendarDateFromJulianDay(jd) {
  if (!Number.isFinite(jd)) throw new TypeError('jd must be finite');
  const shifted = jd + 0.5;
  const z = Math.floor(shifted);
  const fraction = shifted - z;
  let a = z;
  if (z >= 2299161) {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.trunc(alpha / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const dayDecimal = b - d - Math.floor(30.6001 * e) + fraction;
  const day = Math.floor(dayDecimal);
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  let seconds = (dayDecimal - day) * SECONDS_PER_DAY;
  const hour = Math.floor(seconds / 3600);
  seconds -= hour * 3600;
  const minute = Math.floor(seconds / 60);
  return { year, month, day, hour, minute, second: seconds - minute * 60 };
}

/**
 * Convert a Julian Day to a decimal year using the historical calendar switch
 * at 1582-10-15, matching the source C++ time layer.
 */
export function decimalYearFromJulianDay(jd) {
  if (!Number.isFinite(jd)) return jd;
  const { year } = calendarDateFromJulianDay(jd);
  const start = julianDayAtYearStart(year);
  const next = julianDayAtYearStart(year + 1);
  return year + (jd - start) / (next - start);
}

/** Estimated TT - UT1 at a UT1 Julian Day. */
export function deltaTSecondsFromUt1(jdUT1) {
  return deltaTSeconds(decimalYearFromJulianDay(jdUT1));
}

/** Estimated TT - UT1 at a TT Julian Day (two fixed-point refinements). */
export function deltaTSecondsFromTt(jdTT) {
  let jdUT1 = jdTT;
  let deltaT = 0;
  for (let iteration = 0; iteration < 2; iteration += 1) {
    deltaT = deltaTSecondsFromUt1(jdUT1);
    jdUT1 = jdTT - deltaT / SECONDS_PER_DAY;
  }
  return deltaT;
}

export function ttToUt1(jdTT, deltaT = deltaTSecondsFromTt(jdTT)) {
  return jdTT - deltaT / SECONDS_PER_DAY;
}

export function ut1ToTt(jdUT1, deltaT = deltaTSecondsFromUt1(jdUT1)) {
  return jdUT1 + deltaT / SECONDS_PER_DAY;
}

/**
 * Minimal astronomical instant for the lite runtime.
 * UTC labels from JavaScript Date are intentionally treated as UT1; TT is
 * derived with the bundled Delta-T model.
 */
export class JulianTime {
  constructor(value) {
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new TypeError('jdUT1 must be finite');
      this.jdUT1 = value;
      this.deltaTSeconds = deltaTSecondsFromUt1(value);
      this.jdTT = ut1ToTt(value, this.deltaTSeconds);
    } else {
      if (!value || ![value.jdUT1, value.jdTT, value.deltaTSeconds].every(Number.isFinite)) {
        throw new TypeError('time must contain finite jdTT, jdUT1 and deltaTSeconds');
      }
      const { jdTT, jdUT1, deltaTSeconds } = value;
      const roundoff = 2 * Number.EPSILON * Math.max(1, Math.abs(jdTT), Math.abs(jdUT1));
      if (Math.abs(jdTT - ut1ToTt(jdUT1, deltaTSeconds)) > roundoff) {
        throw new RangeError('TT, UT1 and deltaTSeconds must describe the same instant');
      }
      this.jdTT = jdTT;
      this.jdUT1 = jdUT1;
      this.deltaTSeconds = deltaTSeconds;
    }
    Object.freeze(this);
  }

  static fromUT1(jdUT1) {
    return new JulianTime(jdUT1);
  }

  static fromTT(jdTT) {
    if (!Number.isFinite(jdTT)) throw new TypeError('jdTT must be finite');
    const deltaTSeconds = deltaTSecondsFromTt(jdTT);
    // Keep the supplied TT root exactly; do not round-trip through UT1.
    return new JulianTime({ jdTT, jdUT1: ttToUt1(jdTT, deltaTSeconds), deltaTSeconds });
  }

  static fromUnixMilliseconds(unixMilliseconds) {
    if (!Number.isFinite(unixMilliseconds)) throw new TypeError('Unix milliseconds must be finite');
    return new JulianTime(UNIX_EPOCH_JD + unixMilliseconds / MILLISECONDS_PER_DAY);
  }

  /** Convert through Date.getTime(); no calendar-field reconstruction is used. */
  static fromDate(date) {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
      throw new TypeError('date must be a valid JavaScript Date');
    }
    return JulianTime.fromUnixMilliseconds(date.getTime());
  }

  toUnixMilliseconds() {
    return (this.jdUT1 - UNIX_EPOCH_JD) * MILLISECONDS_PER_DAY;
  }

  toDate() {
    const date = new Date(this.toUnixMilliseconds());
    if (!Number.isFinite(date.getTime())) throw new RangeError('time is outside the JavaScript Date range');
    return date;
  }

  toZonedTime(offsetMinutes) {
    return ZonedTime.fromJulianTime(this, offsetMinutes);
  }

  toJSON() {
    return {
      jdUT1: this.jdUT1,
      jdTT: this.jdTT,
      deltaTSeconds: this.deltaTSeconds,
    };
  }
}

function validateOffsetMinutes(offsetMinutes) {
  if (!Number.isInteger(offsetMinutes) || Math.abs(offsetMinutes) > 14 * 60) {
    throw new RangeError('offsetMinutes must be an integer within ±14 hours');
  }
}

function validateZonedFields(fields) {
  const integers = ['year', 'month', 'day', 'hour', 'minute'];
  if (!integers.every(name => Number.isInteger(fields[name])) || !Number.isFinite(fields.second)) {
    throw new TypeError('zoned calendar fields must be finite integers except second');
  }
  if (fields.month < 1 || fields.month > 12 || fields.day < 1 || fields.day > 31
    || fields.hour < 0 || fields.hour > 23 || fields.minute < 0 || fields.minute > 59
    || fields.second < 0 || fields.second >= 60) {
    throw new RangeError('zoned calendar field is outside its valid range');
  }
  // Validate the civil date at noon.  Checking the original clock fields
  // component-by-component is unsafe because a scalar JD can round an exact
  // 14:30 to 14:29:59.999986 near modern epochs.
  const dateProbeJd = julianDay({ ...fields, hour: 12, minute: 0, second: 0 });
  const roundtrip = calendarDateFromJulianDay(dateProbeJd);
  if (roundtrip.year !== fields.year || roundtrip.month !== fields.month
    || roundtrip.day !== fields.day) {
    throw new RangeError('invalid date in the hybrid Julian/Gregorian calendar');
  }
}

/** Civil wall time with a mandatory fixed UTC offset. */
export class ZonedTime {
  constructor({ year, month, day, hour = 0, minute = 0, second = 0, offsetMinutes }) {
    validateOffsetMinutes(offsetMinutes);
    const fields = { year, month, day, hour, minute, second };
    validateZonedFields(fields);
    Object.assign(this, fields, { offsetMinutes });
    Object.freeze(this);
  }

  static fromJulianTime(time, offsetMinutes) {
    validateOffsetMinutes(offsetMinutes);
    const jdUT1 = asUt1JulianDay(time);
    const fields = calendarDateFromJulianDay(jdUT1 + offsetMinutes / 1440);
    return new ZonedTime({ ...fields, offsetMinutes });
  }

  /** Date is an instant; offset is required only to choose its wall-clock representation. */
  static fromDate(date, offsetMinutes) {
    return JulianTime.fromDate(date).toZonedTime(offsetMinutes);
  }

  toJulianTime() {
    const localJd = julianDay(this);
    return new JulianTime(localJd - this.offsetMinutes / 1440);
  }

  toDate() {
    return this.toJulianTime().toDate();
  }

  toJSON() {
    return {
      year: this.year,
      month: this.month,
      day: this.day,
      hour: this.hour,
      minute: this.minute,
      second: this.second,
      offsetMinutes: this.offsetMinutes,
    };
  }
}

/** Accept a numeric UT1 JD or this library's JulianTime. */
export function asUt1JulianDay(value) {
  const jdUT1 = value instanceof JulianTime ? value.jdUT1 : value;
  if (!Number.isFinite(jdUT1)) throw new TypeError('value must be a UT1 Julian Day or JulianTime');
  return jdUT1;
}

export const TIME_INFO = Object.freeze({
  unixEpochJd: UNIX_EPOCH_JD,
  utcConvention: 'UTC is treated as UT1 in the lite runtime',
  civilCalendar: 'hybrid Julian/Gregorian, switch at 1582-10-15',
});

export const DELTA_T_INFO = Object.freeze({
  s15StartYear: S15_START_YEAR,
  earlyJoinStartYear: EARLY_JOIN_START_YEAR,
  earlyJoin: 'cubic Hermite, value and first derivative continuous',
  annualStartYear: ANNUAL_START_YEAR,
  annualEndYear: ANNUAL_END_YEAR,
  extrapolationJoinEndYear: ANNUAL_END_YEAR + 100,
  annualInterpolation: 'Catmull-Rom cubic Hermite',
});
