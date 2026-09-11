import { J2000 } from './coordinates.js';
import { solveSolarPolynomial, solarGroundPoint, solarMaximumDetails, localCircumstances } from './eclipse-solar.js';
import { solveLunar } from './eclipse-lunar.js';
import { bodyHorizontalPosition, bodyRiseSetForDay } from './body-visibility.js';
import { hybridAtmosphericRefraction } from './solar-visibility.js';
import { BODY_DISC_RADIUS_KM } from './phenomena.js';
import { AU_KM } from './sun-moon-ephemeris.js';
import { JulianTime, ZonedTime } from './time.js';
const SYNODIC_MONTH = 29.5306;
const MAX_LUNATIONS = 5000;
function asJulianTime(value, name) {
  if (value instanceof JulianTime)
    return value;
  if (value instanceof ZonedTime)
    return value.toJulianTime();
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime()))
      throw new TypeError(`${name} Date must be valid`);
    return JulianTime.fromDate(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new TypeError(`${name} UT1 Julian day must be finite`);
    return JulianTime.fromUT1(value);
  }
  if (value && Number.isFinite(value.jdTT) && Number.isFinite(value.jdUT1))
    return new JulianTime(value);
  throw new TypeError(`${name} must be a UT1 Julian day, Date, JulianTime, ZonedTime, or AstroTime`);
}
function rangeSettings(startInput, endInput) {
  const start = asJulianTime(startInput, 'start');
  const end = asJulianTime(endInput, 'end');
  if (end.jdTT <= start.jdTT)
    throw new RangeError('end must be later than start');
  const count = Math.ceil((end.jdTT - start.jdTT) / SYNODIC_MONTH) + 3;
  if (count > MAX_LUNATIONS)
    throw new RangeError(`eclipse search exceeds ${MAX_LUNATIONS} lunations; split the interval`);
  return { start, end };
}
function tt(relativeDay) { return JulianTime.fromTT(J2000 + relativeDay); }
function optionalTt(relativeDay) { return relativeDay === null ? null : tt(relativeDay); }
function solarEvent(event) {
  if (!event)
    return null;
  return {
    code: { partial: 'P', total: 'T', annular: 'A', hybrid: 'H' }[event.kind],
    kind: event.kind, conjunction: tt(event.conjunction), maximum: tt(event.maximum),
    ...solarMaximumDetails(event),
    contacts: {
      partialBegin: solarGroundPoint(event, event.contacts.partialBegin),
      centralBegin: solarGroundPoint(event, event.contacts.centralBegin, true),
      maximum: tt(event.maximum),
      centralEnd: solarGroundPoint(event, event.contacts.centralEnd, true),
      partialEnd: solarGroundPoint(event, event.contacts.partialEnd),
    },
  };
}
function solarNearRelative(relative) {
  return solarEvent(solveSolarPolynomial(Math.floor((relative + 8) / SYNODIC_MONTH)));
}
function solarNear(jdTT) { return solarNearRelative(jdTT - J2000); }
/** Return the solar eclipse belonging to the lunation near `date`, or null. */
export function getSolarEclipseDetails(date) {
  return solarNear(asJulianTime(date, 'date').jdTT);
}
/** Search global solar eclipses in the half-open interval [start,end). */
export function searchSolarEclipses(startInput, endInput) {
  const { start, end } = rangeSettings(startInput, endInput);
  const startRelative = start.jdTT - J2000, endRelative = end.jdTT - J2000;
  const first = Math.floor((startRelative + 8) / SYNODIC_MONTH) - 1;
  const last = Math.ceil((endRelative + 8) / SYNODIC_MONTH) + 1;
  const events = [];
  for (let lunation = first; lunation <= last; lunation += 1) {
    const event = solarEvent(solveSolarPolynomial(lunation));
    if (!event || event.maximum.jdTT < start.jdTT || event.maximum.jdTT >= end.jdTT)
      continue;
    if (events.length === 0 || Math.abs(event.maximum.jdTT - events.at(-1).maximum.jdTT) > 1)
      events.push(event);
  }
  return events;
}
function lunarEvent(result) {
  if (!result)
    return null;
  const umbralMagnitude = Math.max(0, result.umbralMagnitude);
  return {
    kind: result.kind, maximum: tt(result.maximum),
    magnitude: result.kind === 'penumbral' ? result.penumbralMagnitude : umbralMagnitude,
    umbralMagnitude, penumbralMagnitude: result.penumbralMagnitude,
    contacts: { ...Object.fromEntries(Object.entries(result.contacts).map(([key, value]) => [key, optionalTt(value)])), maximum: tt(result.maximum) },
  };
}
/** Return the lunar eclipse belonging to the full moon near `date`, or null. */
export function getLunarEclipseDetails(date) {
  const relative = asJulianTime(date, 'date').jdTT - J2000;
  return lunarEvent(solveLunar(Math.floor((relative - 4) / SYNODIC_MONTH)));
}
/** Search lunar eclipses in the half-open interval [start,end). */
export function searchLunarEclipses(startInput, endInput) {
  const { start, end } = rangeSettings(startInput, endInput);
  const startRelative = start.jdTT - J2000, endRelative = end.jdTT - J2000;
  const first = Math.floor((startRelative - 18) / SYNODIC_MONTH) - 1;
  const last = Math.ceil((endRelative - 18) / SYNODIC_MONTH) + 1;
  const events = [];
  for (let lunation = first; lunation <= last; lunation += 1) {
    const event = lunarEvent(solveLunar(lunation));
    if (!event || event.maximum.jdTT < start.jdTT || event.maximum.jdTT >= end.jdTT)
      continue;
    if (events.length === 0 || Math.abs(event.maximum.jdTT - events.at(-1).maximum.jdTT) > 1)
      events.push(event);
  }
  return events;
}
function checkedLocation(location) {
  if (!location || typeof location !== 'object')
    throw new TypeError('location must be an object');
  const longitudeDeg = location.longitudeDeg, latitudeDeg = location.latitudeDeg;
  const heightMeters = location.heightMeters ?? 0;
  if (!Number.isFinite(longitudeDeg) || longitudeDeg < -180 || longitudeDeg > 180)
    throw new RangeError('longitudeDeg must be finite and within [-180, 180]');
  if (!Number.isFinite(latitudeDeg) || latitudeDeg < -90 || latitudeDeg > 90)
    throw new RangeError('latitudeDeg must be finite and within [-90, 90]');
  if (!Number.isFinite(heightMeters))
    throw new TypeError('heightMeters must be finite');
  if (heightMeters <= -6370000)
    throw new RangeError('invalid heightMeters');
  return { longitudeDeg, latitudeDeg, heightMeters };
}
/** Compute local circumstances for the solar eclipse near `date`. */
export function getLocalSolarEclipse(date, location) {
  const observer = checkedLocation(location), instant = asJulianTime(date, 'date');
  const event = solveSolarPolynomial(Math.floor((instant.jdTT - J2000 + 8) / SYNODIC_MONTH));
  if (!event)
    return null;
  const global = solarEvent(event), local = localCircumstances(event, observer);
  const contacts = Object.fromEntries(Object.entries(local.contacts).map(([key, value]) => [key, optionalTt(value)]));
  const horizon = [];
  const day = Math.floor(global.maximum.jdUT1 - .5) + .5;
  for (let d = day - 1; d <= day + 1; d++) {
    const result = bodyRiseSetForDay('sun', d, observer, { limb: 'upper' });
    for (const time of result.rises)
      horizon.push({ time, kind: 'sunrise' });
    for (const time of result.sets)
      horizon.push({ time, kind: 'sunset' });
  }
  const nearest = kind => horizon.filter(e => e.kind === kind).sort((a, b) => Math.abs(a.time.jdTT - global.maximum.jdTT) - Math.abs(b.time.jdTT - global.maximum.jdTT))[0]?.time ?? null;
  const above = time => {
    const p = bodyHorizontalPosition('sun', time.jdUT1, observer);
    const limb = p.geometricAltitudeDeg * Math.PI / 180 + Math.asin(BODY_DISC_RADIUS_KM.sun / (AU_KM * p.distanceAu));
    return limb + hybridAtmosphericRefraction(limb, { pressureMbar: 1013.25, temperatureCelsius: 15 }) > 0;
  };
  let visible = false, horizonClipped = null, magnitude = local.magnitude, kind = local.kind;
  if (contacts.partialBegin && contacts.partialEnd) {
    const begin = contacts.partialBegin.jdTT, end = contacts.partialEnd.jdTT;
    const crossings = horizon.filter(e => e.time.jdTT >= begin && e.time.jdTT <= end).sort((a, b) => a.time.jdTT - b.time.jdTT);
    visible = above(contacts.maximum) || crossings.length > 0;
    if (crossings.length)
      horizonClipped = crossings[0].kind;
    for (const [name, time] of Object.entries(contacts))
      if (time && !above(time))
        contacts[name] = null;
    if (visible && !contacts.maximum) {
      const candidate = crossings.map(e => ({ time: e.time, g: local.at(e.time.jdTT - J2000) })).sort((a, b) => b.g.magnitude - a.g.magnitude)[0];
      if (candidate)
        magnitude = Math.max(0, candidate.g.magnitude);
    }
  }
  if (!visible) {
    kind = 'none';
    magnitude = 0;
    for (const key of Object.keys(contacts))
      contacts[key] = null;
  }
  else if (!contacts.centralBegin && !contacts.centralEnd && kind !== 'partial')
    kind = 'partial';
  return { global, observer, visible, kind, magnitude, horizonClipped, contacts, sunrise: nearest('sunrise'), sunset: nearest('sunset') };
}
function lunarContactCircumstance(time, observer) {
  if (!time)
    return null;
  const position = bodyHorizontalPosition('moon', time.jdUT1, observer);
  return {
    time, azimuthDeg: position.azimuthDeg,
    geometricAltitudeDeg: position.geometricAltitudeDeg,
    apparentAltitudeDeg: position.apparentAltitudeDeg,
    visible: position.apparentAltitudeDeg > 0,
  };
}
function moonHorizonEvents(startUT1, endUT1, observer) {
  const rises = [], sets = [];
  const firstDay = Math.floor(startUT1 - 0.5) + 0.5;
  for (let day = firstDay; day < endUT1; day += 1) {
    const events = bodyRiseSetForDay('moon', day, observer, { limb: 'upper' });
    rises.push(...events.rises.filter(time => time.jdUT1 >= startUT1 && time.jdUT1 <= endUT1));
    sets.push(...events.sets.filter(time => time.jdUT1 >= startUT1 && time.jdUT1 <= endUT1));
  }
  return { rises, sets };
}
/** Compute which phases of the lunar eclipse near `date` are visible locally. */
export function getLocalLunarEclipse(date, location) {
  const observer = checkedLocation(location);
  const global = getLunarEclipseDetails(date);
  if (!global)
    return null;
  const contacts = Object.fromEntries(Object.entries(global.contacts).map(([name, time]) => [
    name, lunarContactCircumstance(time, observer),
  ]));
  const present = Object.values(global.contacts).filter(Boolean);
  const start = global.contacts.penumbralBegin ?? present[0] ?? global.maximum;
  const end = global.contacts.penumbralEnd ?? present.at(-1) ?? global.maximum;
  const horizon = moonHorizonEvents(start.jdUT1, end.jdUT1, observer);
  let visible = Object.values(contacts).some(contact => contact?.visible);
  // A rise/set can occur between named contacts. Sample the short eclipse
  // interval so visibility describes any observable portion, not only contacts.
  for (let jd = start.jdUT1; !visible && jd <= end.jdUT1; jd += 1 / 144) {
    visible = bodyHorizontalPosition('moon', jd, observer).apparentAltitudeDeg > 0;
  }
  const hasRise = horizon.rises.length > 0, hasSet = horizon.sets.length > 0;
  return {
    global, observer, visible, contacts,
    moonrises: horizon.rises, moonsets: horizon.sets,
    horizonClipped: hasRise && hasSet ? 'both' : hasRise ? 'moonrise' : hasSet ? 'moonset' : null,
  };
}
export const ECLIPSE_SEARCH_INFO = Object.freeze({ interval: 'half-open [start,end)', maximumLunations: MAX_LUNATIONS, mapRenderer: false });
