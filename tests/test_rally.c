#include <string.h>

#include "test.h"
#include "court.h"
#include "lab.h"
#include "solver.h"

static SwingEvent medium_swing(float t)
{
	SwingEvent s;
	memset(&s, 0, sizeof s);
	s.used_gyro = false;
	s.peak = 3.0f;
	s.acc_start = v3(0, 0, 1);
	s.acc_peak = v3(0, 3, 2);
	s.t_peak = t;
	return s;
}

/* Scripted human: swings once per incoming ball, timed to its arrival.
 * Returns simulated frames used; stops at the end of the point. */
static int play_point(Lab *lab, int max_frames)
{
	float swung_play_t = -1;
	int f = 0;
	for (; f < max_frames && lab->state != LAB_RESULT; f++) {
		if (lab->state == LAB_INCOMING && lab->hittable && lab->bounced_near &&
		    lab->arrival_t < 1e8f && lab->t >= lab->arrival_t && swung_play_t != lab->play_t) {
			swung_play_t = lab->play_t;
			SwingEvent s = medium_swing(lab->arrival_t);
			lab_swing(lab, &s);
		}
		lab_step(lab, 0, 0, 1.0f / 60);
	}
	return f;
}

static void run_to_result(Lab *lab)
{
	for (int i = 0; i < 60 * 20 && lab->state != LAB_RESULT; i++)
		lab_step(lab, 0, 0, 1.0f / 60);
}

static Lab fresh(uint32_t seed, int level)
{
	Lab lab;
	lab_start_rally(&lab, seed, true, level);
	return lab;
}

void test_point_rules(void)
{
	Lab a = fresh(1, CPU_MEDIUM); /* human shot hit wide: out */
	a.state = LAB_OUTGOING;
	a.ball = (Ball){v3(0, 1, -11), v3(7, 3.5f, 26), v3(0, 0, 0)};
	run_to_result(&a);
	CHECK(a.winner == PT_CPU && a.why == WHY_OUT);

	Lab b = fresh(2, CPU_MEDIUM); /* human shot into the net */
	b.state = LAB_OUTGOING;
	b.ball = (Ball){v3(0, 0.5f, -3), v3(0, 0, 20), v3(0, 0, 0)};
	run_to_result(&b);
	CHECK(b.winner == PT_CPU && b.why == WHY_NET);

	Lab c = fresh(3, CPU_MEDIUM); /* CPU shot out wide: human wins */
	c.state = LAB_INCOMING;
	c.hittable = true;
	c.ball = (Ball){v3(0, 1, 11), v3(9, 4, -22), v3(0, 0, 0)};
	run_to_result(&c);
	CHECK(c.winner == PT_HUMAN && c.why == WHY_OUT);

	Lab d = fresh(4, CPU_MEDIUM); /* human never swings: the CPU wins the point */
	for (int i = 0; i < 60 * 8 && d.state != LAB_RESULT; i++)
		lab_step(&d, 0, 0, 1.0f / 60);
	CHECK(d.winner == PT_CPU);
	CHECK(d.points[1] == 1 && d.points[0] == 0);
}

void test_serve_comes_from_cpu_side(void)
{
	Lab lab = fresh(5, CPU_MEDIUM);
	for (int i = 0; i < 60 * 3 && lab.state == LAB_WAIT; i++)
		lab_step(&lab, 0, 0, 1.0f / 60);
	CHECK(lab.state == LAB_INCOMING);
	CHECK(lab.ball.pos.z > 10 && lab.ball.vel.z < 0);
	CHECK(lab.cpu.pos.z > 10);
}

void test_every_rally_ends(void)
{
	int stuck = 0, played = 0, long_hard = 0;
	for (int level = 0; level < CPU_LEVELS; level++)
		for (uint32_t seed = 1; seed <= 40; seed++) {
			Lab lab = fresh(seed, level);
			int f = play_point(&lab, 60 * 300);
			played++;
			if (lab.state != LAB_RESULT || f >= 60 * 300) {
				if (level < CPU_HARD)
					stuck++; /* a Hard CPU may rally a perfect human for ever */
				else
					long_hard++;
				if (level < CPU_HARD) printf("  stuck: level %d seed %u state %d ball (%.1f %.2f %.1f) cpu %.1f,%.1f\n", level, seed, lab.state, lab.ball.pos.x, lab.ball.pos.y, lab.ball.pos.z, lab.cpu.pos.x, lab.cpu.pos.z);
			}
		}
	CHECK(played == 40 * CPU_LEVELS);
	CHECK(stuck == 0);
	CHECK(long_hard <= 40); /* Hard and Boss return a perfect swing bot almost every time, so many of these rally on */
	if (stuck)
		printf("  %d of %d points did not end\n", stuck, played);
}

void test_no_double_hits(void)
{
	Lab lab = fresh(9, CPU_MEDIUM);
	int illegal = 0;
	for (int i = 0; i < 60 * 40 && lab.state != LAB_RESULT; i++) {
		if (lab.state == LAB_INCOMING && lab.hittable && lab.bounced_near &&
		    lab.arrival_t < 1e8f && lab.t >= lab.arrival_t) {
			SwingEvent s = medium_swing(lab.arrival_t);
			lab_swing(&lab, &s);
		} else if (lab.state == LAB_OUTGOING || lab.state == LAB_CPU_TURN) {
			int hits = lab.hits;
			SwingEvent s = medium_swing(lab.t);
			if (lab_swing(&lab, &s) || lab.hits != hits)
				illegal++;
		}
		lab_step(&lab, 0, 0, 1.0f / 60);
	}
	CHECK(illegal == 0);
}

/* Play n points against a level; returns the human's points. */
static int human_points(int level, int n, int *returned, int *entered, int *cpu_errors)
{
	int won = 0;
	*cpu_errors = 0;
	*returned = *entered = 0;
	Lab lab = fresh(100 + (uint32_t)level, level);
	for (int p = 0; p < n; p++) {
		LabState prev = lab.state;
		float swung_play_t = -1;
		for (int f = 0; f < 60 * 40 && lab.state != LAB_RESULT; f++) {
			if (lab.state == LAB_INCOMING && lab.hittable && lab.bounced_near &&
			    lab.arrival_t < 1e8f && lab.t >= lab.arrival_t && swung_play_t != lab.play_t) {
				swung_play_t = lab.play_t;
				SwingEvent s = medium_swing(lab.arrival_t);
				lab_swing(&lab, &s);
			}
			lab_step(&lab, 0, 0, 1.0f / 60);
			if (prev == LAB_OUTGOING && lab.state == LAB_CPU_TURN)
				(*entered)++;
			if (prev == LAB_CPU_TURN && lab.state == LAB_INCOMING)
				(*returned)++;
			prev = lab.state;
		}
		if (lab.winner == PT_HUMAN)
			won++;
		if (lab.winner == PT_HUMAN && (lab.why == WHY_OUT || lab.why == WHY_NET))
			(*cpu_errors)++;
		for (int f = 0; f < 60 * 6 && lab.state == LAB_RESULT; f++)
			lab_step(&lab, 0, 0, 1.0f / 60);
	}
	return won;
}

void test_cpu_returns_happen(void)
{
	int ret, ent, err;
	human_points(CPU_MEDIUM, 60, &ret, &ent, &err);
	printf("  medium CPU returned %d of %d in-court shots\n", ret, ent);
	CHECK(ent > 20);
	CHECK(ret * 100 >= ent * 40);
}

/* Difficulty shows: against the same scripted human an Easy CPU loses far more
 * points, and more of them to its own errors, than a Hard one. */
void test_levels_make_different_errors(void)
{
	int r, e, easy_err, hard_err;
	int easy = human_points(CPU_EASY, 60, &r, &e, &easy_err);
	int hard = human_points(CPU_HARD, 60, &r, &e, &hard_err);
	printf("  human won %d/60 vs Easy (%d CPU errors), %d/60 vs Hard (%d CPU errors)\n", easy,
	       easy_err, hard, hard_err);
	CHECK(easy > hard + 15);
	CHECK(easy_err > hard_err);
}

/* Auto-run: after a shot the idle player drifts back to the ready spot. */
void test_human_recovers_to_ready_spot(void)
{
	Lab lab = fresh(21, CPU_MEDIUM);
	lab.state = LAB_OUTGOING;
	lab.ball = (Ball){v3(0, 1, -11), v3(0, 3, 20), v3(0, 0, 0)};
	lab.player.pos.x = 3.0f;
	lab.player.pos.z = -8.0f;
	for (int i = 0; i < 60 * 3; i++)
		lab_step(&lab, 0, 0, 1.0f / 60);
	CHECK_NEAR(lab.player.pos.x, 0.0f, 0.1f);
	CHECK_NEAR(lab.player.pos.z, -(COURT_HALF_LEN + 0.5f), 0.1f);
}

/* The D-pad takes over at once, and the player never leaves the court area. */
void test_dpad_overrides_auto_run(void)
{
	Lab lab = fresh(22, CPU_MEDIUM);
	lab.state = LAB_OUTGOING;
	lab.ball = (Ball){v3(0, 1, -11), v3(0, 3, 20), v3(0, 0, 0)};
	lab.player.pos.x = 0.0f;
	for (int i = 0; i < 30; i++)
		lab_step(&lab, 1, 0, 1.0f / 60); /* D-pad right = toward -x */
	CHECK(lab.player.pos.x < -1.0f);
	for (int i = 0; i < 60 * 30; i++) {
		lab_step(&lab, 1, 1, 1.0f / 60);
		CHECK(lab.player.pos.z <= -0.5f + 1e-3f);
		CHECK(fabsf(lab.player.pos.x) <= COURT_DOUBLES_HALF_W + 2.5f + 1e-3f);
	}
}

/* Arcade feel: the machine's serves clear the net and land in, the scripted
 * human can return them, and rallies end. */
void test_arcade_rally_plays(void)
{
	int serves = 0, serves_in = 0, human_hits = 0, returned = 0, cpu_err = 0, ended = 0, entered = 0;
	for (uint32_t seed = 1; seed <= 40; seed++) {
		Lab lab;
		lab_start_rally(&lab, seed, true, CPU_MEDIUM);
		lab_set_arcade(&lab, true);
		LabState prev = lab.state;
		float swung_play_t = -1;
		bool first = true;
		for (int f = 0; f < 60 * 60 && lab.state != LAB_RESULT; f++) {
			if (lab.state == LAB_INCOMING && lab.hittable && lab.bounced_near &&
			    lab.arrival_t < 1e8f && lab.t >= lab.arrival_t && swung_play_t != lab.play_t) {
				swung_play_t = lab.play_t;
				SwingEvent s = medium_swing(lab.arrival_t);
				if (lab_swing(&lab, &s))
					human_hits++;
			}
			lab_step(&lab, 0, 0, 1.0f / 60);
			if (first && lab.state == LAB_INCOMING) {
				first = false;
				serves++;
				World w = lab.world;
				Trace t = flight_trace(lab.ball, &w, 5);
				if (t.crossed_net && !t.hit_net && court_in_singles(t.first_bounce, -1))
					serves_in++;
			}
			if (prev == LAB_OUTGOING && lab.state == LAB_CPU_TURN)
				entered++;
			if (prev == LAB_CPU_TURN && lab.state == LAB_INCOMING)
				returned++;
			prev = lab.state;
		}
		if (lab.state == LAB_RESULT) {
			ended++;
			if (lab.winner == PT_HUMAN && (lab.why == WHY_OUT || lab.why == WHY_NET))
				cpu_err++;
		}
	}
	printf("  arcade: serves in %d/%d, human hits %d (in court %d), CPU returned %d, CPU errors %d, ended %d/40\n",
	       serves_in, serves, human_hits, entered, returned, cpu_err, ended);
	CHECK(serves_in * 10 >= serves * 9);
	CHECK(ended == 40);
	CHECK(entered * 100 >= human_hits * 75); /* most human returns land in */
	CHECK(returned * 100 >= entered * 50);    /* the Medium CPU gets half back */
}

/* Against the CPU's own shots (not just machine feeds) auto-run must still
 * bring the player to the ball, with the ball on the forehand side. */
void test_auto_run_in_rallies(void)
{
	for (int arcade = 0; arcade <= 1; arcade++) {
		int arrivals = 0, reached = 0, fore = 0;
		for (uint32_t seed = 1; seed <= 30; seed++) {
			Lab lab;
			lab_start_rally(&lab, seed, true, CPU_MEDIUM);
			lab_set_arcade(&lab, arcade);
			float checked = -1, swung = -1;
			for (int f = 0; f < 60 * 40 && lab.state != LAB_RESULT; f++) {
				if (lab.state == LAB_INCOMING && lab.hittable && lab.bounced_near &&
				    lab.arrival_t < 1e8f && lab.t >= lab.arrival_t) {
					if (checked != lab.play_t) {
						checked = lab.play_t;
						arrivals++;
						Reach r = player_reach(&lab.player, lab.arrival_pos);
						if (r != REACH_NONE)
							reached++;
						if (r == REACH_FOREHAND)
							fore++;
					}
					if (swung != lab.play_t) {
						swung = lab.play_t;
						SwingEvent s = medium_swing(lab.arrival_t);
						lab_swing(&lab, &s);
					}
				}
				lab_step(&lab, 0, 0, 1.0f / 30);
			}
		}
		printf("  rally auto-run %s: %d arrivals, in reach %d, forehand %d\n", arcade ? "arcade" : "real",
		       arrivals, reached, fore);
		CHECK(arrivals > 25);
		CHECK(reached * 100 >= arrivals * 95);
		CHECK(fore * 100 >= arrivals * (arcade ? 75 : 85)); /* fast balls leave less time to pick the racket side */
	}
}
