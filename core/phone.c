#include "phone.h"

void phone_init(PhoneInput *p)
{
	orient_init(&p->o);
	swing_init(&p->d);
	p->d.early_frac = PHONE_EARLY_FRAC;
	p->last_t = -1.0f;
	p->last_q = quat_identity();
}

bool phone_feed(PhoneInput *p, float t, Quat q, Vec3 rate_rads, Vec3 acc_g, SwingEvent *out)
{
	if (p->last_t >= 0 && t <= p->last_t)
		return false;
	Quat prev_q = p->last_q;
	float prev_t = p->last_t;
	float n = sqrtf(q.w * q.w + q.x * q.x + q.y * q.y + q.z * q.z);
	if (!(n > 1e-6f) || !isfinite(n))
		return false;
	p->last_t = t;
	p->o.q = quat_normalize(q);
	p->last_q = p->o.q;

	/* The swing's direction comes from how the orientation actually turned, so the racket path
	 * and face always agree with the racket drawn on screen. The phone's own gyro axes are not
	 * trusted for direction (recorded swings read as steeply up or down); it still gives the
	 * speed. */
	if (prev_t >= 0 && t - prev_t < 0.1f) {
		Quat d = quat_mul(p->o.q, (Quat){prev_q.w, -prev_q.x, -prev_q.y, -prev_q.z}); /* world-frame step */
		if (d.w < 0) { d.w = -d.w; d.x = -d.x; d.y = -d.y; d.z = -d.z; }
		float sn = sqrtf(d.x * d.x + d.y * d.y + d.z * d.z);
		float len = sqrtf(rate_rads.x * rate_rads.x + rate_rads.y * rate_rads.y + rate_rads.z * rate_rads.z);
		if (sn > 1e-6f && len > 1e-6f) {
			float ang = 2.0f * atan2f(sn, d.w);
			Vec3 w_world = v3_scale(v3(d.x, d.y, d.z), 1.0f / sn); /* unit axis */
			Quat qc = {p->o.q.w, -p->o.q.x, -p->o.q.y, -p->o.q.z};
			Vec3 dir = quat_rotate(qc, w_world); /* the axis in the phone's own frame */
			if (ang / (t - prev_t) > 0.5f)
				rate_rads = v3_scale(dir, len);
		}
	}

	MotionSample s = {0};
	s.t = t;
	s.accel_g = acc_g;
	s.has_gyro = true;
	s.gyro_raw = rate_rads;
	s.slow = MOTION_RATES_RADS;
	if (!swing_feed(&p->d, &p->o, &s, true, out))
		return false;
	out->phone = true;
	out->peak = PHONE_PEAK_CAP * tanhf(out->peak / PHONE_PEAK_CAP);
	return true;
}

Quat phone_racket_quat(const PhoneInput *p)
{
	return p->o.q;
}
