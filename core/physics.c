#include "physics.h"

const Air AIR_STD = {1.21f, 0.55f, 8.0f, GRAVITY, 0.0f};
const Air AIR_ARCADE = {1.21f, 0.0f, 3.3f, 21.6f, 1.4f};

static const float PI_F = 3.14159265f;

static Vec3 accel_at(Vec3 vel, Vec3 spin, const Air *air)
{
	Vec3 a = v3(0, -air->gravity, 0);
	float speed = v3_len(vel);
	if (air->lin_drag > 0)
		a = v3_add(a, v3_scale(vel, -air->lin_drag));
	if (air->rho <= 0 || speed < 1e-3f)
		return a;

	float area = PI_F * BALL_RADIUS * BALL_RADIUS;
	float q = 0.5f * air->rho * area * speed * speed; /* dynamic force scale */

	/* Drag, opposite the velocity. */
	a = v3_add(a, v3_scale(vel, -q * air->cd / (speed * BALL_MASS)));

	/* Magnus lift along spin x velocity; C_L = 1 / (2 + v / (r w)). */
	float w = v3_len(spin);
	if (w >= 1e-3f) {
		float cl = 1.0f / (2.0f + speed / (BALL_RADIUS * w));
		Vec3 dir = v3_norm(v3_cross(spin, vel));
		a = v3_add(a, v3_scale(dir, q * cl / BALL_MASS));
	}
	return a;
}

Vec3 ball_accel(const Ball *b, const Air *air)
{
	return accel_at(b->vel, b->spin, air);
}

void ball_fly(Ball *b, const Air *air, float dt)
{
	Vec3 p = b->pos, v = b->vel, s = b->spin;

	Vec3 k1v = accel_at(v, s, air), k1p = v;
	Vec3 v2 = v3_add(v, v3_scale(k1v, dt * 0.5f));
	Vec3 k2v = accel_at(v2, s, air), k2p = v2;
	Vec3 v3_ = v3_add(v, v3_scale(k2v, dt * 0.5f));
	Vec3 k3v = accel_at(v3_, s, air), k3p = v3_;
	Vec3 v4 = v3_add(v, v3_scale(k3v, dt));
	Vec3 k4v = accel_at(v4, s, air), k4p = v4;

	Vec3 dv = v3_add(v3_add(k1v, v3_scale(k2v, 2)), v3_add(v3_scale(k3v, 2), k4v));
	Vec3 dp = v3_add(v3_add(k1p, v3_scale(k2p, 2)), v3_add(v3_scale(k3p, 2), k4p));
	b->vel = v3_add(v, v3_scale(dv, dt / 6.0f));
	b->pos = v3_add(p, v3_scale(dp, dt / 6.0f));

	if (air->spin_tau > 0)
		b->spin = v3_scale(s, expf(-dt / air->spin_tau));
}

float ball_energy(const Ball *b)
{
	return 0.5f * BALL_MASS * v3_dot(b->vel, b->vel) + BALL_MASS * GRAVITY * b->pos.y;
}

Vec3 spin_vector(Vec3 dir, float topspin, float sidespin)
{
	Vec3 up = v3(0, 1, 0);
	Vec3 flat = v3_norm(v3(dir.x, 0, dir.z));
	Vec3 top_axis = v3_norm(v3_cross(up, flat));
	return v3_add(v3_scale(top_axis, topspin), v3_scale(up, sidespin));
}
