import { solarToHijri, hijriToSolar, instantToHijri, JulianTime } from '../src/index.js';
const date = solarToHijri({ year: 2000, month: 1, day: 1 });
console.log('Arithmetic Hijri:', date);
console.log('Civil date:', hijriToSolar(date));
console.log('At explicit UTC+08:00:', instantToHijri(JulianTime.fromUT1(2451545), 480));
