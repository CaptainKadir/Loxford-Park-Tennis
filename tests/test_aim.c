#include <string.h>

#include "test.h"
#include "aim.h"
#include "court.h"
#include "racket.h"
#include "solver.h"
#include "stroke.h"

#define RAD2DEG 57.29578f

/* A spread of strokes like standard-remote swings produce: soft to hard,
 * face within about 6 degrees of right, any reasonable path, timing-pulled
 * direction. */
static Ball contact_ball(float speed, float azim, float face, float path)
{
	Player p;
	player_init(&p, +1, true);
	p.pos = v3(0.8f, 0, -11.5f);
	StrokeParams sp = {speed, azim, face, path};
	RacketContact c = stroke_contact(&p, &sp, 0);
	Ball b = {v3(0, 1.0f, -11.0f), v3(0, -2, -18), v3(-150, 0, 0)};
	racket_hit(&b, &c);
	return b;
}

static int sweep(bool assisted, int *changed, float *worst_elev, float *worst_azim, float *worst_speed)
{
	World w = world_std();
	int total = 0, in = 0;
	*changed = 0;
	*worst_elev = *worst_azim = *worst_speed = 0;
	for (float speed = 12; speed <= 34; speed += 4)
		for (float face = -0.10f; face <= 0.10f + 1e-4f; face += 0.10f / 3)
			for (float path = 0.1f; path <= 0.5f + 1e-4f; path += 0.1f)
				for (float azim = -0.15f; azim <= 0.15f + 1e-4f; azim += 0.1f) {
					Ball b = contact_ball(speed, azim, face, path);
					Ball before = b;
					if (assisted) {
						AimInfo a = aim_assist(&b, &w);
						if (a.changed)
							(*changed)++;
						if (fabsf(a.d_elev) > *worst_elev)
							*worst_elev = fabsf(a.d_elev);
						if (fabsf(a.d_azim) > *worst_azim)
							*worst_azim = fabsf(a.d_azim);
						float ds = fabsf(v3_len(b.vel) - v3_len(before.vel));
						if (ds > *worst_speed)
							*worst_speed = ds;
						CHECK_NEAR(v3_len(b.spin), v3_len(before.spin), 1e-2f);
					}
					Trace t = flight_trace(b, &w, 5);
					total++;
					if (aim_shot_ok(&t))
						in++;
				}
	return total ? in * 100 / total : 0;
}

void test_aim_assist_keeps_more_shots_in(void)
{
	int ch, pro_ch;
	float we, wa, ws, d1, d2, d3;
	int pro = sweep(false, &pro_ch, &d1, &d2, &d3);
	int assisted = sweep(true, &ch, &we, &wa, &ws);
	printf("  shots in play: Pro %d%%, Assisted %d%% (%d nudged)\n", pro, assisted, ch);
	CHECK(assisted >= pro + 30);
	CHECK(assisted >= 45);
	/* bounded nudge, speed untouched */
	CHECK(we <= AIM_MAX_ELEV + 1e-4f);
	CHECK(wa <= AIM_MAX_AZIM + 1e-4f);
	CHECK(ws < 1e-3f);
	CHECK(ch > 0);
}

void test_aim_assist_leaves_good_shots_alone(void)
{
	World w = world_std();
	int untouched = 0, good = 0;
	for (float speed = 14; speed <= 30; speed += 4)
		for (float path = 0.2f; path <= 0.5f; path += 0.1f) {
			Ball b = contact_ball(speed, 0, 0.05f, path);
			Trace t = flight_trace(b, &w, 5);
			if (!aim_shot_ok(&t))
				continue;
			good++;
			Ball before = b;
			AimInfo a = aim_assist(&b, &w);
			if (!a.changed && b.vel.x == before.vel.x && b.vel.y == before.vel.y &&
			    b.vel.z == before.vel.z)
				untouched++;
		}
	CHECK(good > 0 && untouched == good);
}

void test_aim_assist_ignores_balls_not_going_downcourt(void)
{
	World w = world_std();
	Ball b = {v3(0, 1, -11), v3(0, 3, -10), v3(0, 0, 0)}; /* mishit, going backwards */
	Ball before = b;
	AimInfo a = aim_assist(&b, &w);
	CHECK(!a.changed && b.vel.z == before.vel.z && b.vel.y == before.vel.y);
}

void test_aim_assist_pulls_a_wide_ball_inside(void)
{
	World w = world_std();
	Ball b = contact_ball(24, 0.3f, 0.05f, 0.35f); /* pulled wide */
	Trace t = flight_trace(b, &w, 5);
	AimInfo a = aim_assist(&b, &w);
	Trace t2 = flight_trace(b, &w, 5);
	CHECK(fabsf(t2.first_bounce.x) <= fabsf(t.first_bounce.x) + 1e-4f);
	CHECK(a.changed || aim_shot_ok(&t));
}

/* End to end for standard remotes: any swing strength from a gentle tap to a
 * full-arm swing, hit from low or normal height, should mostly end up in. */
static Ball accel_swing_ball(float peak_g, float y)
{
	SwingEvent s;
	memset(&s, 0, sizeof s);
	s.used_gyro = false;
	s.peak = peak_g;
	s.acc_start = v3(0, 0, 1);
	s.acc_peak = v3(0, peak_g, 0.3f * peak_g / 3.0f);
	Player p;
	player_init(&p, +1, true);
	p.pos = v3(0.8f, 0, -9.0f);
	StrokeParams sp = stroke_params(&s, 0, REACH_FOREHAND, true);
	stroke_adapt_height(&sp, y);
	RacketContact c = stroke_contact(&p, &sp, 0);
	Ball b = {v3(0, y, -8.5f), v3(0, -1, -14), v3(-150, 0, 0)};
	racket_hit(&b, &c);
	return b;
}

void test_standard_remote_swings_mostly_land_in(void)
{
	World w = world_std();
	float heights[3] = {0.25f, 0.6f, 1.1f};
	float peaks[6] = {2.0f, 2.5f, 3.0f, 4.0f, 5.0f, 6.5f};
	int in[3] = {0, 0, 0}, n[3] = {0, 0, 0};
	for (int h = 0; h < 3; h++)
		for (int k = 0; k < 6; k++) {
			Ball b = accel_swing_ball(peaks[k], heights[h]);
			aim_assist(&b, &w);
			Trace t = flight_trace(b, &w, 5);
			n[h]++;
			if (aim_shot_ok(&t))
				in[h]++;
		}
	printf("  standard swings in: low %d/%d, mid %d/%d, normal %d/%d\n", in[0], n[0], in[1],
	       n[1], in[2], n[2]);
	CHECK(in[0] >= 4);
	CHECK(in[1] >= 5);
	CHECK(in[2] == 6);
}

void test_strong_aim_keeps_at_least_as_many_in(void)
{
	int ch, ch2;
	float we, wa, ws, we2, wa2, ws2;
	int normal = sweep(true, &ch, &we, &wa, &ws);
	aim_set_strength(1.8f);
	int strong = sweep(true, &ch2, &we2, &wa2, &ws2);
	aim_set_strength(1.0f);
	printf("  shots in play: Normal aim %d%%, Strong aim %d%%\n", normal, strong);
	CHECK(strong >= normal + 5); /* slowing a shot that would land long keeps more in */
	CHECK(we2 <= AIM_MAX_ELEV * 1.8f + 1e-4f);
	CHECK(wa2 <= AIM_MAX_AZIM * 1.8f + 1e-4f);
	(void)ws2; /* the strong assist may change pace; the normal one never does (checked above) */
}
