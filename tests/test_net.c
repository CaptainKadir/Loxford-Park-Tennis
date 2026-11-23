#include "test.h"
#include "court.h"
#include "net.h"
#include "sim.h"

/* Returns the sign of the ball's final z after simulating secs. */
static int run_until_settled_side(Ball b, float secs)
{
	World w = world_std();
	for (int i = 0; i < (int)(240 * secs); i++)
		sim_step(&b, &w, SIM_DT);
	return b.pos.z > 0 ? +1 : -1;
}

/* spec 6.5 #7, mesh part */
void test_mesh_stops_ball(void)
{
	Ball b = {v3(0, 0.5f, -3), v3(0, 0, 20), v3(0, 0, 0)};
	CHECK(run_until_settled_side(b, 2) == -1);
}

/* Review Focus 3 */
void test_fast_ball_cannot_tunnel_mesh(void)
{
	Ball b = {v3(1, 0.4f, -0.2f), v3(0, 0, 80), v3(0, 0, 0)};
	CHECK(run_until_settled_side(b, 2) == -1);
}

/* spec 6.5 #7, cord part */
void test_cord_both_outcomes(void)
{
	int over = 0, back = 0;
	for (int i = -20; i <= 20; i++) {
		float y = net_height_at(0) + i * 0.002f;
		/* start 0.1 m from the net so gravity drops it only ~2 mm before contact */
		Ball b = {v3(0, y, -0.1f), v3(0, 0, 5), v3(0, 0, 0)};
		if (run_until_settled_side(b, 3) > 0)
			over++;
		else
			back++;
	}
	CHECK(over > 0 && back > 0);
	if (!(over > 0 && back > 0))
		printf("  over %d back %d\n", over, back);
}

void test_clear_ball_unaffected(void)
{
	World w = world_std();
	Ball b = {v3(0, 1.6f, -1), v3(0, 0, 20), v3(0, 0, 0)};
	int ev = 0;
	for (int i = 0; i < 30; i++)
		ev |= sim_step(&b, &w, SIM_DT);
	CHECK(!(ev & (SIM_NET_CORD | SIM_NET_MESH)) && b.pos.z > 0);
}

/* A ball rolling along the ground must not pass through the mesh. */
void test_rolling_ball_stopped_by_mesh(void)
{
	Ball b = {v3(0, BALL_RADIUS, -1), v3(0, 0, 4), v3(0, 0, 0)};
	CHECK(run_until_settled_side(b, 3) == -1);
}

/* Review fix 1: a rising ball whose centre is just below the cord used to be
 * treated as a cord hit, placed past the net and allowed to fly on. */
void test_rising_ball_under_cord_is_stopped(void)
{
	Ball b = {v3(0, 0.632586f, -1.026042f), v3(0, 3, 10), v3(0, 0, 0)};
	CHECK(run_until_settled_side(b, 3) == -1);
}

/* Sweep: speeds, vertical speeds, depths below the cord, step phases.
 * Every ball whose centre reaches the net plane below the cord stays on its
 * own side. Start 0.3 m out so gravity/drag shift the height by < 5 mm. */
void test_below_cord_sweep_never_passes(void)
{
	int through = 0, total = 0;
	for (float v = 10; v <= 60; v += 10)
		for (float vy = -2; vy <= 4; vy += 1)
			for (float below = 0.012f; below <= 0.034f; below += 0.004f)
				for (int ph = 0; ph < 8; ph++) {
					float dist = 0.3f + v * SIM_DT * ph / 8.0f;
					float t = dist / v;
					float y = net_height_at(0) - below - vy * t + 0.5f * GRAVITY * t * t;
					Ball b = {v3(0, y, -dist), v3(0, vy, v), v3(0, 0, 0)};
					total++;
					if (run_until_settled_side(b, 3) > 0)
						through++;
				}
	CHECK(through == 0);
	if (through)
		printf("  %d of %d below-cord balls went through\n", through, total);
}
