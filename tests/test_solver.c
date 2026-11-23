#include "test.h"
#include "court.h"
#include "solver.h"

static float window_deg(Vec3 from, float speed, float topspin, Vec3 aim,
			float lo_deg, float hi_deg, int serve)
{
	World w = world_std();
	float azim = atan2f(aim.x - from.x, aim.z - from.z), width = 0;
	for (float d = lo_deg; d <= hi_deg; d += 0.05f) {
		float el = d * 3.14159265f / 180;
		Vec3 dir = launch_velocity(1, el, azim);
		Ball b = {from, launch_velocity(speed, el, azim), spin_vector(dir, topspin, 0)};
		Trace t = flight_trace(b, &w, 5);
		bool ok = t.crossed_net && !t.hit_net &&
			  (serve ? court_in_service_box(t.first_bounce, +1, aim.x >= 0 ? +1 : -1) &&
					   t.net_margin > 0
				 : court_in_singles(t.first_bounce, +1) && t.net_margin > 0.5f);
		if (ok)
			width += 0.05f;
	}
	return width;
}

/* spec 6.5 #6, serve */
void test_flat_serve_window(void)
{
	/* server just left of the centre mark (x < 0), diagonal box is x > 0 */
	float wdt = window_deg(v3(-0.2f, 2.9f, -COURT_HALF_LEN), 50, 0, v3(1, 0, 5), -12, 5, 1);
	printf("  flat serve window %.2f deg\n", wdt);
	CHECK(wdt > 0 && wdt < 2.5f);
}

/* spec 6.5 #6, rally */
void test_topspin_widens_rally_window(void)
{
	Vec3 from = v3(0, 1.0f, -COURT_HALF_LEN);
	float top = window_deg(from, 30, 2500 * 2 * 3.14159265f / 60, v3(0, 0, 8), -5, 30, 0);
	float flat = window_deg(from, 30, 0, v3(0, 0, 8), -5, 30, 0);
	printf("  rally window: topspin %.2f deg, flat %.2f deg\n", top, flat);
	CHECK(top > 0 && top > flat);
}

/* spec 6.5 #4 */
void test_magnus_changes_length(void)
{
	World w = world_std();
	Vec3 from = v3(0, 1, -11), dir = launch_velocity(1, 0.15f, 0);
	float z[3];
	float spins[3] = {300, 0, -300};
	for (int i = 0; i < 3; i++) {
		Ball b = {from, launch_velocity(25, 0.15f, 0), spin_vector(dir, spins[i], 0)};
		z[i] = flight_trace(b, &w, 5).first_bounce.z;
	}
	CHECK(z[0] < z[1] && z[1] < z[2]); /* topspin shorter, backspin longer */
	Ball s = {from, launch_velocity(25, 0.15f, 0), spin_vector(dir, 0, 200)};
	CHECK(flight_trace(s, &w, 5).first_bounce.x > 0.2f); /* sidespin curves +x */
}

void test_solver_hits_target(void)
{
	World w = world_std();
	float el, az;
	Vec3 from = v3(-2, 1, -11), target = v3(3, 0, 9);
	CHECK(solve_launch(from, target, 28, 250, 0, &w, &el, &az));
	Vec3 dir = launch_velocity(1, el, az);
	Ball b = {from, launch_velocity(28, el, az), spin_vector(dir, 250, 0)};
	Vec3 p = flight_trace(b, &w, 5).first_bounce;
	CHECK_NEAR(p.x, 3, 0.05f);
	CHECK_NEAR(p.z, 9, 0.05f);
}

/* returns false, no garbage */
void test_solver_unreachable(void)
{
	World w = world_std();
	float el = 123, az = 456;
	CHECK(!solve_launch(v3(0, 1, -11), v3(0, 0, 60), 10, 0, 0, &w, &el, &az));
}

/* Review fix 2: solutions must not clip the net. */
void test_solver_never_returns_net_clipping_shot(void)
{
	World w = world_std();
	int clipped = 0;
	for (float fz = -6; fz <= -1; fz += 1)
		for (float tz = 0.5f; tz <= 6; tz += 1.1f)
			for (float s = 5; s <= 30; s += 5) {
				float el, az;
				Vec3 from = v3(0, 1, fz), target = v3(0.3f, 0, tz);
				if (!solve_launch(from, target, s, 0, 0, &w, &el, &az))
					continue;
				Ball b = {from, launch_velocity(s, el, az), v3(0, 0, 0)};
				if (flight_trace(b, &w, 5).hit_net)
					clipped++;
			}
	CHECK(clipped == 0);
	if (clipped)
		printf("  %d solutions clipped the net\n", clipped);
}
