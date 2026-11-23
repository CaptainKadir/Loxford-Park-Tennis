#include "racket.h"
#include "bounce.h"

#define MIN_SEPARATION 0.5f /* m/s: a ball not approaching the face is pushed off */

float racket_ea(float offset)
{
	float r = offset / RACKET_SWEET_R;
	float ea = RACKET_EA * (1 - r * r);
	return fminf(fmaxf(ea, 0.10f), RACKET_EA);
}

void racket_hit(Ball *b, const RacketContact *c)
{
	Vec3 n = v3_norm(c->normal);
	Vec3 w = v3_sub(b->vel, c->vel); /* ball velocity relative to the racket */
	float wn = v3_dot(w, n);

	if (wn >= 0) {
		/* Not approaching the face: nudge it away, no spin change. */
		w = v3_add(w, v3_scale(n, fmaxf(wn, MIN_SEPARATION) - wn));
		b->vel = v3_add(c->vel, w);
		return;
	}

	float ea = racket_ea(c->offset);
	float jn = BALL_MASS * (1 + ea) * -wn;
	w = v3_sub(w, v3_scale(n, (1 + ea) * wn)); /* normal part becomes -ea*wn */
	b->vel = v3_add(c->vel, w);
	contact_friction(b, n, jn, STRING_MU, c->vel);
}
