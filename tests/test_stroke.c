#include <string.h>

#include "test.h"
#include "court.h"
#include "racket.h"
#include "solver.h"
#include "stroke.h"

static SwingEvent gyro_swing(float peak)
{
	SwingEvent s;
	memset(&s, 0, sizeof s);
	s.used_gyro = true;
	s.peak = peak;
	s.axis = v3(1, 0, 0);
	s.q_peak = quat_identity();
	return s;
}

void test_faster_swing_faster_racket(void)
{
	SwingEvent a = gyro_swing(10), b = gyro_swing(20);
	CHECK(stroke_params(&b, 0, REACH_FOREHAND, true).speed >
	      stroke_params(&a, 0, REACH_FOREHAND, true).speed);
	SwingEvent huge = gyro_swing(500);
	CHECK_NEAR(stroke_params(&huge, 0, REACH_FOREHAND, true).speed, STROKE_MAX_SPEED, 1e-4f);
}

void test_early_forehand_goes_cross_court(void)
{
	SwingEvent s = gyro_swing(15);
	Player p;
	player_init(&p, +1, true);
	StrokeParams early = stroke_params(&s, -0.08f, REACH_FOREHAND, true);
	StrokeParams late = stroke_params(&s, +0.08f, REACH_FOREHAND, true);
	RacketContact ce = stroke_contact(&p, &early, -0.08f), cl = stroke_contact(&p, &late, 0.08f);
	CHECK(ce.vel.x > 0.5f); /* player's left = +x for a +z-facing player */
	CHECK(cl.vel.x < -0.5f);
}

void test_timing_error_moves_off_sweet_spot(void)
{
	SwingEvent s = gyro_swing(15);
	Player p;
	player_init(&p, +1, true);
	StrokeParams sp = stroke_params(&s, 0, REACH_FOREHAND, true);
	CHECK_NEAR(stroke_contact(&p, &sp, 0).offset, 0, 1e-6f);
	CHECK(stroke_contact(&p, &sp, 0.1f).offset > 0.05f);
}

void test_accel_mode_maps_speed_and_path(void)
{
	SwingEvent s;
	memset(&s, 0, sizeof s);
	s.used_gyro = false;
	s.peak = 4.0f;
	s.acc_start = v3(0, 0, 1);
	s.acc_peak = v3(0, 3, 2);
	StrokeParams sp = stroke_params(&s, 0, REACH_FOREHAND, true);
	CHECK_NEAR(sp.speed, fminf(STROKE_ACC_BASE + STROKE_ACC_GAIN * 3, STROKE_ACC_MAX_SPEED), 1e-4f);
	CHECK(sp.path > 0.2f);
}

/* A well-timed medium low-to-high swing against a typical feed: some face
 * angle inside the allowed range clears the net and lands in, so the player
 * can control the shot. */
void test_stroke_returns_ball_over_net(void)
{
	SwingEvent s = gyro_swing(16);
	Player p;
	player_init(&p, +1, true);
	p.pos = v3(0.8f, 0, -11.5f);
	World w = world_std();
	int good = 0;
	for (float face = -STROKE_MAX_FACE; face <= STROKE_MAX_FACE; face += 0.02f) {
		StrokeParams sp = stroke_params(&s, 0, REACH_FOREHAND, true);
		sp.path = 0.35f;
		sp.face = face;
		RacketContact c = stroke_contact(&p, &sp, 0);
		Ball b = {v3(0, 1.0f, -11.0f), v3(0, -2, -18), v3(-150, 0, 0)};
		racket_hit(&b, &c);
		Trace t = flight_trace(b, &w, 5);
		if (t.crossed_net && !t.hit_net && court_in_singles(t.first_bounce, +1))
			good++;
	}
	CHECK(good >= 3); /* at least ~3 degrees of usable face angle */
	if (good < 3)
		printf("  usable face steps: %d\n", good);
}

/* q and -q are the same orientation; the shot direction must not depend on
 * which one the filter happens to hold. */
void test_heading_same_for_q_and_minus_q(void)
{
	SwingEvent a = gyro_swing(15), b = gyro_swing(15);
	float h = 0.6f; /* ~34 deg of heading */
	a.q_peak = (Quat){cosf(h / 2), 0, 0, sinf(h / 2)};
	b.q_peak = (Quat){-a.q_peak.w, -a.q_peak.x, -a.q_peak.y, -a.q_peak.z};
	StrokeParams pa = stroke_params(&a, 0, REACH_FOREHAND, true);
	StrokeParams pb = stroke_params(&b, 0, REACH_FOREHAND, true);
	CHECK_NEAR(pa.azim, pb.azim, 1e-4f);
	CHECK_NEAR(pa.azim, -0.3f, 1e-3f); /* turned left: azimuth toward the left */
}

/* Review fix 8: the ball is only in reach for about +-65 ms around arrival,
 * so timing inside that range must still steer the shot clearly. */
void test_timing_within_reach_steers_shot(void)
{
	SwingEvent s = gyro_swing(15);
	StrokeParams early = stroke_params(&s, -0.06f, REACH_FOREHAND, true);
	CHECK(fabsf(early.azim) >= 0.3f);
	CHECK(STROKE_WINDOW <= 0.16f);
}

/* A low ball is lifted: less pace, steeper brush than the same swing at normal height. */
void test_low_ball_is_lifted(void)
{
	SwingEvent s = gyro_swing(15);
	StrokeParams normal = stroke_params(&s, 0, REACH_FOREHAND, true), low = normal;
	stroke_adapt_height(&normal, 1.2f);
	stroke_adapt_height(&low, 0.25f);
	CHECK_NEAR(normal.speed, stroke_params(&s, 0, REACH_FOREHAND, true).speed, 1e-5f); /* unchanged */
	CHECK(low.speed < normal.speed * 0.5f);
	CHECK(low.path > normal.path + 0.1f || low.path >= STROKE_MAX_PATH);
}
