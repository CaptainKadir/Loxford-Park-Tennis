#include "swing.h"

enum { IDLE = 0, ACTIVE = 1, BLOCKED = 2 };

void swing_init(SwingDetector *d)
{
	d->state = IDLE;
	d->last_t = -1.0f;
	d->last_end = -1000.0f;
	d->early_frac = 0.0f;
}

static void note_peak(SwingEvent *e, const Orient *o, const MotionSample *s, float sig,
		      Vec3 rates)
{
	e->peak = sig;
	e->t_peak = s->t;
	e->axis = v3_norm(rates);
	e->q_peak = o->q;
	e->acc_peak = s->accel_g;
}

bool swing_feed(SwingDetector *d, const Orient *o, const MotionSample *s, bool use_gyro,
		SwingEvent *out)
{
	bool gap = d->last_t >= 0 && s->t - d->last_t > SWING_MAX_GAP;
	d->last_t = s->t;

	if (use_gyro && !s->has_gyro) {
		d->state = IDLE; /* gyro missing: abandon, report nothing */
		return false;
	}
	if (gap && d->state != IDLE)
		d->state = IDLE;

	Vec3 rates = use_gyro ? orient_rates(o, s) : v3(0, 0, 0);
	float sig = use_gyro ? v3_len(rates) : v3_len(s->accel_g);
	float start = use_gyro ? SWING_GYRO_START : SWING_ACC_START;
	float end = use_gyro ? SWING_GYRO_END : SWING_ACC_END;

	switch (d->state) {
	case IDLE:
		if (sig > start) {
			if (s->t - d->last_end < SWING_REFRACTORY) {
				d->state = BLOCKED;
				return false;
			}
			d->state = ACTIVE;
			d->cur.t_start = s->t;
			d->cur.used_gyro = use_gyro;
			d->cur.phone = false;
			d->cur.acc_start = s->accel_g;
			note_peak(&d->cur, o, s, sig, rates);
		}
		return false;
	case BLOCKED:
		if (sig < end)
			d->state = IDLE;
		return false;
	default: /* ACTIVE */
		if (use_gyro != d->cur.used_gyro) {
			/* Sensor changed mid-swing (Auto, gyro dropped out):
			 * drop it and ignore the rest of this motion. */
			d->state = sig < end ? IDLE : BLOCKED;
			return false;
		}
		if (sig > d->cur.peak)
			note_peak(&d->cur, o, s, sig, rates);
		if (d->early_frac > 0.0f && sig >= end && sig < d->cur.peak * d->early_frac &&
		    s->t - d->cur.t_start >= SWING_MIN_DUR) {
			d->state = BLOCKED; /* the rest of this swing's tail is ignored */
			d->cur.t_end = s->t;
			d->last_end = s->t;
			*out = d->cur;
			return true;
		}
		if (sig >= end)
			return false;
		d->state = IDLE;
		if (s->t - d->cur.t_start < SWING_MIN_DUR)
			return false;
		d->cur.t_end = s->t;
		d->last_end = s->t;
		*out = d->cur;
		return true;
	}
}
