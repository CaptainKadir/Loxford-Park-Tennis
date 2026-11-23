#include "test.h"
#include "racket.h"

static Ball incoming(void)
{
	Ball b = {v3(0, 1, 0), v3(0, 0, -20), v3(0, 0, 0)};
	return b;
}

void test_sweet_spot_is_fastest(void)
{
	RacketContact c = {v3(0, 0, 1), v3(0, 0, 25), 0};
	Ball a = incoming();
	racket_hit(&a, &c);
	c.offset = 0.10f;
	Ball m = incoming();
	racket_hit(&m, &c);
	CHECK(a.vel.z > m.vel.z && m.vel.z > 0);
	CHECK(a.vel.z > 30 && a.vel.z < 45); /* plausible groundstroke pace */
}

void test_brushing_up_makes_topspin(void)
{
	RacketContact c = {v3(0, 0, 1), v3(0, 8, 25), 0};
	Ball b = incoming();
	racket_hit(&b, &c);
	Vec3 top_axis = spin_vector(v3(0, 0, 1), 1, 0);
	CHECK(v3_dot(b.spin, top_axis) > 50); /* rad/s of topspin */
	c.vel = v3(0, -8, 25);
	Ball s = incoming();
	racket_hit(&s, &c);
	CHECK(v3_dot(s.spin, top_axis) < -50); /* slice = backspin */
}

void test_open_face_lifts(void)
{
	float t = 0.35f; /* ~20 degrees open */
	RacketContact c = {v3_norm(v3(0, sinf(t), cosf(t))), v3(0, 0, 15), 0};
	Ball b = incoming();
	racket_hit(&b, &c);
	CHECK(b.vel.y > 3);
}

/* Review Focus 5 */
void test_racket_no_approach_is_safe(void)
{
	RacketContact c = {v3(0, 0, 1), v3(5, 0, 0), 0};
	Ball b = {v3(0, 1, 0), v3(5, 0, 0), v3(0, 0, 0)}; /* moving with the face */
	racket_hit(&b, &c);
	CHECK(isfinite(b.vel.x) && isfinite(b.vel.z) && isfinite(b.spin.x));
	CHECK(v3_dot(v3_sub(b.vel, c.vel), c.normal) > 0); /* leaves on the face side */
}
