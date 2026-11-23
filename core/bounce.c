#include "bounce.h"

float bounce_ey(float vn)
{
	const float lo = 0.76f, hi = 0.60f; /* at <= 8 m/s, at >= 25 m/s */
	if (vn <= 8.0f)
		return lo;
	if (vn >= 25.0f)
		return hi;
	return lo + (hi - lo) * (vn - 8.0f) / (25.0f - 8.0f);
}

void contact_friction(Ball *b, Vec3 n, float jn, float mu, Vec3 surface_vel)
{
	const float k = BALL_INERTIA_K;
	Vec3 rc = v3_scale(n, -BALL_RADIUS); /* contact point from centre */

	/* Slip of the ball's contact point over the surface, tangential part. */
	Vec3 u = v3_add(v3_sub(b->vel, surface_vel), v3_cross(b->spin, rc));
	u = v3_sub(u, v3_scale(n, v3_dot(u, n)));
	float us = v3_len(u);
	if (us <= 1e-6f)
		return;

	float j_grip = us * BALL_MASS * k / (1 + k); /* impulse that stops slip */
	float j = fminf(mu * jn, j_grip);
	Vec3 jv = v3_scale(u, -j / us);
	b->vel = v3_add(b->vel, v3_scale(jv, 1.0f / BALL_MASS));
	b->spin = v3_add(b->spin, v3_scale(v3_cross(rc, jv),
					   1.0f / (k * BALL_MASS * BALL_RADIUS * BALL_RADIUS)));
}

void ball_bounce(Ball *b, float mu)
{
	float vn = -b->vel.y;
	float e = bounce_ey(vn);
	float jn = BALL_MASS * (1 + e) * vn;
	b->vel.y = e * vn;
	contact_friction(b, v3(0, 1, 0), jn, mu, v3(0, 0, 0));
}
