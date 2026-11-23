#include <string.h>

#include "lab.h"
#include "test.h"

static Lab new_game(uint32_t seed)
{
	Lab lab;
	lab_start_rally(&lab, seed, true, 0);
	lab.human_serves = true;
	return lab;
}

static bool run_until_state(Lab *lab, LabState want, int max_frames)
{
	for (int i = 0; i < max_frames; i++) {
		if (lab->state == want)
			return true;
		lab_step(lab, 0, 0, 1.0f / 60.0f);
	}
	return lab->state == want;
}

/* Swing at the toss when the ball is high enough to strike. */
static bool serve_with_swing(Lab *lab, float peak)
{
	for (int i = 0; i < 120 && lab->state == LAB_SERVE; i++) {
		if (lab->ball.pos.y > 2.1f && lab->ball.vel.y > -1.0f) {
			SwingEvent s;
			memset(&s, 0, sizeof s);
			s.used_gyro = true;
			s.peak = peak;
			s.t_peak = lab->t;
			return lab_swing(lab, &s);
		}
		lab_step(lab, 0, 0, 1.0f / 60.0f);
	}
	return false;
}

void test_serve_human_serves_first_and_ball_is_tossed(void)
{
	Lab lab = new_game(3);
	CHECK(run_until_state(&lab, LAB_SERVE, 600));
	CHECK(lab.score.server == 0);
	CHECK(lab.ball.pos.y >= 0.9f);
}

void test_serve_swing_lands_in_the_box(void)
{
	int boxed = 0, tried = 0;
	for (uint32_t seed = 1; seed <= 40; seed++) {
		Lab lab = new_game(seed);
		if (!run_until_state(&lab, LAB_SERVE, 600))
			continue;
		tried++;
		if (!serve_with_swing(&lab, 5.0f + (float)(seed % 8)))
			continue;
		/* the serve either reaches the CPU (in the box) or is a fault: it is never lost silently */
		for (int i = 0; i < 600 && lab.state == LAB_OUTGOING; i++)
			lab_step(&lab, 0, 0, 1.0f / 60.0f);
		if (lab.state == LAB_CPU_TURN || lab.state == LAB_INCOMING || lab.state == LAB_RESULT)
			boxed++;
	}
	CHECK(tried >= 30);
	CHECK(boxed >= tried * 8 / 10);
}

void test_serve_missed_toss_is_not_a_fault_and_is_tossed_again(void)
{
	Lab lab = new_game(5);
	CHECK(run_until_state(&lab, LAB_SERVE, 600));
	for (int i = 0; i < 400 && lab.state == LAB_SERVE; i++)
		lab_step(&lab, 0, 0, 1.0f / 60.0f); /* never swing: the toss falls */
	CHECK(lab.state == LAB_WAIT);
	CHECK(lab.serve_n == 1);       /* still the first serve */
	CHECK(lab.why == WHY_NONE);    /* no fault is called */
	CHECK(lab.score.points[1] == 0 && lab.points[1] == 0);
	CHECK(run_until_state(&lab, LAB_SERVE, 600)); /* and it is tossed again */
	CHECK(lab.serve_n == 1);
}

void test_serve_swing_too_early_finds_nothing(void)
{
	Lab lab = new_game(7);
	CHECK(run_until_state(&lab, LAB_SERVE, 600));
	SwingEvent s;
	memset(&s, 0, sizeof s);
	s.used_gyro = true;
	s.peak = 8.0f;
	s.t_peak = lab.t;
	CHECK(!lab_swing(&lab, &s)); /* ball is still at the hand */
	CHECK(lab.state == LAB_SERVE);
}

void test_serve_alternates_each_game(void)
{
	Lab lab = new_game(9);
	for (int g = 0; g < 1; g++)
		for (int p = 0; p < 4; p++)
			score_point(&lab.score, 0);
	CHECK(lab.score.server == 1);
}
