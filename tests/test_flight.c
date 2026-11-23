#include "test.h"
#include "physics.h"

/* spec 6.5 #2: vacuum, launched up at 10 m/s from y = 0 */
void test_free_fall_matches_closed_form(void)
{
	Air vac = {0, 0.55f, 8.0f, GRAVITY, 0.0f};
	Ball b = {v3(0, 0, 0), v3(0, 10, 0), v3(0, 0, 0)};
	float apex = 0, t = 0;
	while (b.vel.y > 0) {
		ball_fly(&b, &vac, SIM_DT);
		t += SIM_DT;
		if (b.pos.y > apex)
			apex = b.pos.y;
	}
	CHECK_NEAR(apex, 100.0f / (2 * GRAVITY), 0.001f * 5.1f); /* 0.1 % */
	CHECK_NEAR(t, 10.0f / GRAVITY, SIM_DT);
}

/* spec 6.5 #3 */
void test_terminal_velocity(void)
{
	Ball b = {v3(0, 5000, 0), v3(0, 0, 0), v3(0, 0, 0)};
	for (int i = 0; i < 240 * 30; i++)
		ball_fly(&b, &AIR_STD, SIM_DT);
	float A = 3.14159265f * BALL_RADIUS * BALL_RADIUS;
	float vt = sqrtf(2 * BALL_MASS * GRAVITY / (AIR_STD.rho * A * AIR_STD.cd));
	CHECK_NEAR(v3_len(b.vel), vt, 0.05f * vt);
}

void test_magnus_topspin_pushes_down(void)
{
	Vec3 dir = v3(0, 0, 1);
	Ball b = {v3(0, 1, 0), v3(0, 0, 30), spin_vector(dir, 260, 0)};
	Ball f = {v3(0, 1, 0), v3(0, 0, 30), v3(0, 0, 0)};
	CHECK(ball_accel(&b, &AIR_STD).y < ball_accel(&f, &AIR_STD).y - 1.0f);
}

void test_magnus_sidespin_curves_positive_x(void)
{
	Ball b = {v3(0, 1, 0), v3(0, 0, 30), spin_vector(v3(0, 0, 1), 0, 200)};
	CHECK(ball_accel(&b, &AIR_STD).x > 0.5f);
}

/* Review Focus 1 */
void test_zero_spin_is_finite(void)
{
	Ball b = {v3(0, 1, 0), v3(0, 0, 30), v3(0, 0, 0)};
	Vec3 a = ball_accel(&b, &AIR_STD);
	CHECK(isfinite(a.x) && isfinite(a.y) && isfinite(a.z));
	Ball r = {v3(0, 1, 0), v3(0, 0, 0), v3(0, 0, 0)}; /* at rest too */
	a = ball_accel(&r, &AIR_STD);
	CHECK(isfinite(a.x) && isfinite(a.y) && isfinite(a.z));
}

/* spec 6.5 #8 */
void test_flight_never_gains_energy(void)
{
	Ball b = {v3(0, 1, -11), v3(1, 8, 30), spin_vector(v3(0, 0, 1), 300, 50)};
	float e = ball_energy(&b);
	for (int i = 0; i < 240 * 2; i++) {
		ball_fly(&b, &AIR_STD, SIM_DT);
		float e2 = ball_energy(&b);
		CHECK(e2 <= e + 1e-6f * fabsf(e) + 1e-7f);
		e = e2;
	}
}
