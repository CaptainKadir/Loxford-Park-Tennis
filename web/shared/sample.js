// Turn raw browser sensor readings into one wire sample (see server/relay.js).
import { deviceQuat, phoneToCourt, fixAccelSign } from './frame.js';

const DEG = Math.PI / 180;
const G = 9.80665;
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** raw: {t seconds, orient:{alpha,beta,gamma} deg, rate:{alpha,beta,gamma} deg/s,
 *  acc:{x,y,z} m/s^2 incl. gravity}. Returns {sample, sign} or null. */
export function buildSample(raw, calib, sign) {
  const o = raw.orient;
  if (!o || [o.alpha, o.beta, o.gamma].some((v) => typeof v !== 'number' || !Number.isFinite(v)))
    return null;
  const dq = deviceQuat(o.alpha, o.beta, o.gamma);
  const accG = [num(raw.acc?.x) / G, num(raw.acc?.y) / G, num(raw.acc?.z) / G];
  const fixed = fixAccelSign(dq, accG, sign);
  return {
    sample: {
      type: 's',
      t: raw.t,
      q: phoneToCourt(dq, calib),
      // device frame, rad/s: x = beta, y = gamma, z = alpha
      r: [num(raw.rate?.beta) * DEG, num(raw.rate?.gamma) * DEG, num(raw.rate?.alpha) * DEG],
      a: fixed.a,
    },
    sign: fixed.sign,
  };
}
