import { AU_KM, earthHeliocentricState } from './ephemeris.js';
import {
  ARCSEC_TO_RAD, J2000, iau2000bNutation, icrfEquatorialToJ2000Ecliptic,
  meanEclipticOfDateMatrixState,
} from './coordinates.js';
import {
  RAD, add, cross, dot, finite, rotateX, rotateZ, scale, signedDeg, spherical,
  sub, transform, unit,
} from './sky-math.js';
import { LIGHT_TIME_DAYS_PER_AU, SKY_FRAME } from './apparent.js';

export const TSC1_VERSION = 1;
export const TSC1_HEADER_SIZE = 132;
export const TSC1_STAR_RECORD_SIZE = 92;
export const TSC1_ALIAS_RECORD_SIZE = 16;

const DAYS_PER_JULIAN_YEAR = 365.25;
const AU_PER_PARALLAX_MAS = 648000000 / Math.PI;
const KM_PER_SECOND_TO_AU_PER_DAY = 86400 / AU_KM;
const MAS_PER_YEAR_TO_RAD_PER_DAY = ARCSEC_TO_RAD / 1000 / DAYS_PER_JULIAN_YEAR;
const DEFAULT_DIRECTION_DISTANCE_AU = 1e9;
const RATE_STEP_DAYS = 0.0005;
const FNV1A_OFFSET = 14695981039346656037n;
const FNV1A_PRIME = 1099511628211n;
const UINT64_MASK = 0xffffffffffffffffn;
const textDecoder = new TextDecoder('utf-8', { fatal: true });
const textEncoder = new TextEncoder();

export const TSC1_ASTROMETRY_SOURCE = Object.freeze({
  UNKNOWN: 0, GAIA_DR3: 1, HIPPARCOS: 2, BSC5: 3, MANUAL: 4,
});

export const TSC1_STAR_FLAGS = Object.freeze({
  HAS_GAIA_ID: 1 << 0,
  HAS_HIP_ID: 1 << 1,
  HAS_HR_ID: 1 << 2,
  HAS_HD_ID: 1 << 3,
  HAS_RADIAL_VELOCITY: 1 << 4,
  HAS_PARALLAX: 1 << 5,
  SPECIAL_DIRECTION: 1 << 6,
});

function checkedInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${name} is outside the supported range`);
  return value;
}

function asBytes(input) {
  if (input instanceof Uint8Array) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (typeof SharedArrayBuffer !== 'undefined' && input instanceof SharedArrayBuffer) return new Uint8Array(input);
  throw new TypeError('TSC1 input must be an ArrayBuffer or Uint8Array');
}

function readUint64(view, offset) {
  return view.getBigUint64(offset, true);
}

function readOffset(view, offset, name) {
  const value = Number(readUint64(view, offset));
  return checkedInteger(value, name);
}

function checkedRange(total, offset, count, elementSize, name) {
  checkedInteger(offset, `${name} offset`);
  checkedInteger(count, `${name} count`);
  const bytes = count * elementSize;
  if (!Number.isSafeInteger(bytes) || offset > total || bytes > total - offset) {
    throw new RangeError(`${name} lies outside the TSC1 file`);
  }
}

function compareUtf8(left, right) {
  const length = Math.min(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return left.length - right.length;
}

/** Match the C++ TSC1 ASCII folding while preserving non-ASCII text verbatim. */
export function normalizeTsc1Alias(value) {
  if (typeof value !== 'string') throw new TypeError('star key must be a string');
  let result = '';
  let lastSeparator = false;
  for (const character of value) {
    const code = character.codePointAt(0);
    if (code >= 0x80) {
      result += character;
      lastSeparator = false;
    } else if ((code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
      result += character.toLowerCase();
      lastSeparator = false;
    } else if (character === '_' || character === '-' || /\s/.test(character)) {
      if (result && !lastSeparator) {
        result += '_';
        lastSeparator = true;
      }
    }
  }
  return result.endsWith('_') ? result.slice(0, -1) : result;
}

export function tsc1AliasHash(value) {
  const bytes = typeof value === 'string' ? textEncoder.encode(value) : value;
  let result = FNV1A_OFFSET;
  for (const byte of bytes) result = ((result ^ BigInt(byte)) * FNV1A_PRIME) & UINT64_MASK;
  return result;
}

function sphericalToCartesian(longitude, latitude, radius) {
  const cosLatitude = Math.cos(latitude);
  return [
    radius * cosLatitude * Math.cos(longitude),
    radius * cosLatitude * Math.sin(longitude),
    radius * Math.sin(latitude),
  ];
}

export class Tsc1Catalog {
  constructor(input) {
    this.bytes = asBytes(input);
    this.view = new DataView(this.bytes.buffer, this.bytes.byteOffset, this.bytes.byteLength);
    if (this.bytes.byteLength < TSC1_HEADER_SIZE
      || String.fromCharCode(...this.bytes.subarray(0, 4)) !== 'TSC1') {
      throw new TypeError('input is not a TSC1 catalog');
    }
    this.version = this.view.getUint32(4, true);
    if (this.version !== TSC1_VERSION) throw new RangeError(`unsupported TSC1 version: ${this.version}`);
    this.flags = this.view.getUint32(8, true);
    this.starCount = this.view.getUint32(12, true);
    this.aliasCount = this.view.getUint32(16, true);
    this.starRecordsOffset = readOffset(this.view, 20, 'star records offset');
    this.aliasRecordsOffset = readOffset(this.view, 28, 'alias records offset');
    this.stringTableOffset = readOffset(this.view, 36, 'string table offset');
    this.stringTableSize = readOffset(this.view, 44, 'string table size');
    this.catalogMinEpoch = this.view.getFloat64(52, true);
    this.catalogMaxEpoch = this.view.getFloat64(60, true);
    checkedRange(this.bytes.byteLength, this.starRecordsOffset, this.starCount,
      TSC1_STAR_RECORD_SIZE, 'star records');
    checkedRange(this.bytes.byteLength, this.aliasRecordsOffset, this.aliasCount,
      TSC1_ALIAS_RECORD_SIZE, 'alias records');
    checkedRange(this.bytes.byteLength, this.stringTableOffset, this.stringTableSize, 1, 'string table');
    if (this.stringTableSize === 0 || this.bytes[this.stringTableOffset] !== 0) {
      throw new TypeError('invalid TSC1 string table');
    }
    this.stringCache = new Map([[0, '']]);
    this.recordCache = new Map();
    this.validateRecords();
  }

  string(offset) {
    checkedInteger(offset, 'string offset');
    const cached = this.stringCache.get(offset);
    if (cached !== undefined) return cached;
    if (offset >= this.stringTableSize) throw new RangeError('string offset lies outside the TSC1 string table');
    const start = this.stringTableOffset + offset;
    const limit = this.stringTableOffset + this.stringTableSize;
    let end = start;
    while (end < limit && this.bytes[end] !== 0) end += 1;
    if (end === limit) throw new TypeError('unterminated TSC1 string');
    const value = textDecoder.decode(this.bytes.subarray(start, end));
    this.stringCache.set(offset, value);
    return value;
  }

  encodedString(offset) {
    checkedInteger(offset, 'string offset');
    if (offset >= this.stringTableSize) throw new RangeError('string offset lies outside the TSC1 string table');
    const start = this.stringTableOffset + offset;
    const limit = this.stringTableOffset + this.stringTableSize;
    let end = start;
    while (end < limit && this.bytes[end] !== 0) end += 1;
    if (end === limit) throw new TypeError('unterminated TSC1 string');
    return this.bytes.subarray(start, end);
  }

  validateRecords() {
    let previousHash = -1n;
    let previousAlias = new Uint8Array();
    for (let i = 0; i < this.starCount; i += 1) {
      const offset = this.starRecordsOffset + i * TSC1_STAR_RECORD_SIZE;
      this.encodedString(this.view.getUint32(offset, true));
      this.encodedString(this.view.getUint32(offset + 4, true));
    }
    for (let i = 0; i < this.aliasCount; i += 1) {
      const offset = this.aliasRecordsOffset + i * TSC1_ALIAS_RECORD_SIZE;
      const stringOffset = this.view.getUint32(offset, true);
      const starIndex = this.view.getUint32(offset + 4, true);
      const hash = readUint64(this.view, offset + 8);
      if (starIndex >= this.starCount) throw new RangeError('TSC1 alias points outside the star table');
      const encoded = this.encodedString(stringOffset);
      if (hash < previousHash || (hash === previousHash && compareUtf8(encoded, previousAlias) < 0)) {
        throw new TypeError('TSC1 aliases are not sorted by hash and UTF-8 bytes');
      }
      previousHash = hash;
      previousAlias = encoded;
    }
  }

  getStar(index) {
    checkedInteger(index, 'star index');
    if (index >= this.starCount) throw new RangeError('star index lies outside the TSC1 catalog');
    const cached = this.recordCache.get(index);
    if (cached) return cached;
    const offset = this.starRecordsOffset + index * TSC1_STAR_RECORD_SIZE;
    const record = Object.freeze({
      index,
      canonicalId: this.string(this.view.getUint32(offset, true)),
      displayName: this.string(this.view.getUint32(offset + 4, true)),
      gaiaDr3SourceId: readUint64(this.view, offset + 8),
      hipId: this.view.getUint32(offset + 16, true),
      hrId: this.view.getUint32(offset + 20, true),
      hdId: this.view.getUint32(offset + 24, true),
      rightAscensionDeg: this.view.getFloat64(offset + 28, true),
      declinationDeg: this.view.getFloat64(offset + 36, true),
      properMotionRaMasPerYear: this.view.getFloat64(offset + 44, true),
      properMotionDecMasPerYear: this.view.getFloat64(offset + 52, true),
      parallaxMas: this.view.getFloat64(offset + 60, true),
      radialVelocityKmPerSecond: this.view.getFloat64(offset + 68, true),
      referenceEpoch: this.view.getFloat64(offset + 76, true),
      magnitude: this.view.getFloat32(offset + 84, true),
      astrometrySource: this.view.getUint16(offset + 88, true),
      flags: this.view.getUint16(offset + 90, true),
    });
    this.recordCache.set(index, record);
    return record;
  }

  find(key) {
    const normalized = normalizeTsc1Alias(key);
    if (!normalized) return null;
    const encoded = textEncoder.encode(normalized);
    const hash = tsc1AliasHash(encoded);
    let low = 0, high = this.aliasCount;
    while (low < high) {
      const middle = low + Math.floor((high - low) / 2);
      const offset = this.aliasRecordsOffset + middle * TSC1_ALIAS_RECORD_SIZE;
      if (readUint64(this.view, offset + 8) < hash) low = middle + 1;
      else high = middle;
    }
    for (let i = low; i < this.aliasCount; i += 1) {
      const offset = this.aliasRecordsOffset + i * TSC1_ALIAS_RECORD_SIZE;
      if (readUint64(this.view, offset + 8) !== hash) break;
      if (compareUtf8(this.encodedString(this.view.getUint32(offset, true)), encoded) === 0) {
        return this.getStar(this.view.getUint32(offset + 4, true));
      }
    }
    return null;
  }

  *[Symbol.iterator]() {
    for (let i = 0; i < this.starCount; i += 1) yield this.getStar(i);
  }
}

export function parseTsc1Catalog(input) {
  return new Tsc1Catalog(input);
}

function resolveStar(catalog, star) {
  if (!(catalog instanceof Tsc1Catalog)) throw new TypeError('catalog must be a Tsc1Catalog');
  if (typeof star === 'number') return catalog.getStar(star);
  if (typeof star === 'string') {
    const record = catalog.find(star);
    if (!record) throw new RangeError(`star is not present in the TSC1 catalog: ${star}`);
    return record;
  }
  if (star && Number.isInteger(star.index)) return catalog.getStar(star.index);
  throw new TypeError('star must be a catalog key, index, or TSC1 star record');
}

/** ICRF barycentric linear space-motion state, matching the C++ TSC1 v1 model. */
export function fixedStarIcrfState(catalog, star, jdTT) {
  finite(jdTT, 'jdTT');
  const record = resolveStar(catalog, star);
  const ra = record.rightAscensionDeg / RAD;
  const dec = record.declinationDeg / RAD;
  const direction = sphericalToCartesian(ra, dec, 1);
  const hasParallax = (record.flags & TSC1_STAR_FLAGS.HAS_PARALLAX) !== 0
    && Number.isFinite(record.parallaxMas) && record.parallaxMas > 0;
  const distance = hasParallax ? AU_PER_PARALLAX_MAS / record.parallaxMas : DEFAULT_DIRECTION_DISTANCE_AU;
  const positionAtEpoch = scale(direction, distance);
  const alpha = [-Math.sin(ra), Math.cos(ra), 0];
  const beta = [-Math.sin(dec) * Math.cos(ra), -Math.sin(dec) * Math.sin(ra), Math.cos(dec)];
  const pmRa = Number.isFinite(record.properMotionRaMasPerYear) ? record.properMotionRaMasPerYear : 0;
  const pmDec = Number.isFinite(record.properMotionDecMasPerYear) ? record.properMotionDecMasPerYear : 0;
  const radial = (record.flags & TSC1_STAR_FLAGS.HAS_RADIAL_VELOCITY) !== 0
    && Number.isFinite(record.radialVelocityKmPerSecond) ? record.radialVelocityKmPerSecond : 0;
  const alphaSpeed = hasParallax ? pmRa / (record.parallaxMas * DAYS_PER_JULIAN_YEAR)
    : pmRa * MAS_PER_YEAR_TO_RAD_PER_DAY * distance;
  const betaSpeed = hasParallax ? pmDec / (record.parallaxMas * DAYS_PER_JULIAN_YEAR)
    : pmDec * MAS_PER_YEAR_TO_RAD_PER_DAY * distance;
  const velocity = add(scale(direction, radial * KM_PER_SECOND_TO_AU_PER_DAY),
    add(scale(alpha, alphaSpeed), scale(beta, betaSpeed)));
  const epoch = Number.isFinite(record.referenceEpoch) ? record.referenceEpoch : 2000;
  const referenceJdTT = J2000 + (epoch - 2000) * DAYS_PER_JULIAN_YEAR;
  return {
    star: record,
    jdTT,
    referenceJdTT,
    positionAu: add(positionAtEpoch, scale(velocity, jdTT - referenceJdTT)),
    velocityAuPerDay: velocity,
  };
}

function aberrate(position, observerVelocity) {
  const distance = Math.hypot(...position);
  const p = scale(position, 1 / distance);
  const beta = scale(observerVelocity, LIGHT_TIME_DAYS_PER_AU);
  const inverseGamma = Math.sqrt(1 - dot(beta, beta));
  const product = dot(p, beta);
  return scale(unit(add(scale(p, inverseGamma), scale(beta, 1 + product / (1 + inverseGamma)))), distance);
}

function solarDeflection(position, earth, target) {
  const distance = Math.hypot(...position), earthDistance = Math.hypot(...earth);
  const p = unit(position), e = unit(earth), q = unit(target);
  const limb = 695700 / AU_KM / earthDistance;
  const denominator = Math.max(1 + dot(q, e), limb * limb / 2);
  const weight = 1.97412574336e-8 / earthDistance / denominator;
  return scale(unit(add(p, scale(cross(p, cross(e, q)), weight))), distance);
}

/** Geocentric fixed-star position; input JD(TT), default axes are true of date. */
export function fixedStarPosition(catalog, star, jdTT, options = {}) {
  const frame = options.frame ?? SKY_FRAME.TRUE_OF_DATE;
  if (!Object.values(SKY_FRAME).includes(frame)) throw new RangeError(`unsupported sky frame: ${frame}`);
  const icrf = fixedStarIcrfState(catalog, star, jdTT);
  const target = icrfEquatorialToJ2000Ecliptic(icrf.positionAu);
  const earth = earthHeliocentricState(jdTT);
  let position = sub(target, earth.position);
  const astrometric = position;
  if (options.solarDeflection !== false) position = solarDeflection(position, earth.position, target);
  if (options.aberration !== false) position = aberrate(position, earth.velocity);
  const nutation = iau2000bNutation(jdTT);
  let ecliptic = position;
  let obliquity = 84381.406 * ARCSEC_TO_RAD;
  if (frame !== SKY_FRAME.J2000) {
    ecliptic = transform(meanEclipticOfDateMatrixState(jdTT).matrix, position);
    obliquity = nutation.meanObliquity;
    if (frame === SKY_FRAME.TRUE_OF_DATE) {
      ecliptic = rotateZ(ecliptic, nutation.dpsi);
      obliquity = nutation.trueObliquity;
    }
  }
  const equatorial = rotateX(ecliptic, obliquity);
  const eq = spherical(equatorial);
  return {
    star: icrf.star,
    jdTT,
    frame,
    ...spherical(ecliptic),
    rightAscensionDeg: eq.longitudeDeg,
    declinationDeg: eq.latitudeDeg,
    astrometricPositionAu: astrometric,
    eclipticPositionAu: ecliptic,
    equatorialPositionAu: equatorial,
  };
}

/** Rates differentiate propagation, observer motion, corrections, and changing axes. */
export function fixedStarState(catalog, star, jdTT, options = {}) {
  const current = fixedStarPosition(catalog, star, jdTT, options);
  const before = fixedStarPosition(catalog, current.star.index, jdTT - RATE_STEP_DAYS, options);
  const after = fixedStarPosition(catalog, current.star.index, jdTT + RATE_STEP_DAYS, options);
  const dt = (jdTT + RATE_STEP_DAYS) - (jdTT - RATE_STEP_DAYS);
  return {
    ...current,
    longitudeSpeedDegPerDay: signedDeg(after.longitudeDeg - before.longitudeDeg) / dt,
    latitudeSpeedDegPerDay: (after.latitudeDeg - before.latitudeDeg) / dt,
    rightAscensionSpeedDegPerDay: signedDeg(after.rightAscensionDeg - before.rightAscensionDeg) / dt,
    declinationSpeedDegPerDay: (after.declinationDeg - before.declinationDeg) / dt,
    distanceSpeedAuPerDay: (after.distanceAu - before.distanceAu) / dt,
    eclipticVelocityAuPerDay: scale(sub(after.eclipticPositionAu, before.eclipticPositionAu), 1 / dt),
    equatorialVelocityAuPerDay: scale(sub(after.equatorialPositionAu, before.equatorialPositionAu), 1 / dt),
  };
}
