#include "test.h"
#include "bounce.h"
#include "sim.h"

static float first_rebound_apex(float drop_bottom_h)
{
	World w = world_std();
	/* z = -5: open court (the origin is under the net cord) */
	Ball b = {v3(0, drop_bottom_h + BALL_RADIUS, -5), v3(0, 0, 0), v3(0, 0, 0)};
	int bounced = 0;
	float apex = 0;
	for (int i = 0; i < 240 * 5; i++) {
		int ev = sim_step(&b, &w, SIM_DT);
		if (ev & SIM_BOUNCE) {
			if (bounced)
				break;
			bounced = 1;
		}
		if (bounced && b.pos.y > apex)
			apex = b.pos.y;
	}
	return apex - BALL_RADIUS; /* bottom of ball */
}

/* spec 6.5 #1 */
void test_itf_drop(void)
{
	float h = first_rebound_apex(2.54f);
	CHECK(h >= 1.35f && h <= 1.47f);
	if (!(h >= 1.35f && h <= 1.47f))
		printf("  rebound %.3f m\n", h);
}

static Ball after_bounce(float topspin)
{
	World w = world_std();
	Ball b = {v3(0, BALL_RADIUS + 0.001f, -5), v3(0, -8, 20),
		  spin_vector(v3(0, 0, 1), topspin, 0)};
	for (int i = 0; i < 10; i++)
		if (sim_step(&b, &w, SIM_DT) & SIM_BOUNCE)
			break;
	return b;
}

/* spec 6.5 #5 */
void test_spin_changes_bounce(void)
{
	Ball top = after_bounce(300), flat = after_bounce(0), back = after_bounce(-300);
	CHECK(top.vel.z > flat.vel.z);
	CHECK(back.vel.z < flat.vel.z);
	/* Same incoming ball: vertical rebound is spin-independent, so the
	 * slower backspin ball leaves steeper and topspin leaves flatter.
	 * ("Slice skids low" in play comes from its flatter incoming flight.) */
	CHECK(back.vel.y / back.vel.z > flat.vel.y / flat.vel.z);
	CHECK(top.vel.y / top.vel.z < flat.vel.y / flat.vel.z);
}

/* Review Focus 2 */
void test_ball_settles(void)
{
	World w = world_std();
	Ball b = {v3(0, 2, -8), v3(0, 0, 3), v3(0, 0, 0)};
	int rested = 0, below = 0, nonfinite = 0;
	for (int i = 0; i < 240 * 20; i++) {
		if (sim_step(&b, &w, SIM_DT) & SIM_REST)
			rested = 1;
		if (b.pos.y < BALL_RADIUS - 1e-5f)
			below++;
		if (!isfinite(b.pos.x) || !isfinite(b.vel.z))
			nonfinite++;
	}
	CHECK(below == 0);
	CHECK(nonfinite == 0);
	CHECK(rested);
	CHECK(fabsf(b.vel.y) < 1e-6f && v3_len(b.vel) < 0.01f);
}
