#include <string.h>

#include "test.h"
#include "court.h"
#include "lab.h"
#include "score.h"

#define DT (1.0f / 60)

static SwingEvent swing_at(float t)
{
	SwingEvent s;
	memset(&s, 0, sizeof s);
	s.peak = 4.0f;
	s.acc_start = v3(0, 0, 1);
	s.acc_peak = v3(0, 3, 2);
	s.t_peak = t;
	return s;
}

/* A scripted human: tosses and serves, and returns the balls that are theirs to play. */
static void human_script(Lab *lab, float *swung_play_t)
{
	if (lab->state == LAB_SERVE && lab->ball.pos.y > 1.6f && lab->ball.vel.y < 0) {
		SwingEvent s = swing_at(lab->t);
		lab_swing(lab, &s);
	}
	if (lab->state == LAB_INCOMING && lab->near_owner == 0 && lab->hittable && lab->bounced_near &&
	    lab->arrival_t < 1e8f && lab->t >= lab->arrival_t && *swung_play_t != lab->play_t) {
		*swung_play_t = lab->play_t;
		SwingEvent s = swing_at(lab->arrival_t);
		lab_swing(lab, &s);
	}
}

static void start(Lab *lab, uint32_t seed, int cpu, int partner)
{
	lab_start_doubles(lab, seed, true, cpu, partner);
	lab->human_serves = true;
}

void test_doubles_off_by_default(void)
{
	Lab lab;
	lab_start_rally(&lab, 1, true, CPU_MEDIUM);
	CHECK(!lab.doubles);
	CHECK(lab.serve_tx == 1);
	CHECK(lab_server_player(&lab) == 0);
	lab_init(&lab, 1, true);
	CHECK(!lab.doubles && lab.serve_tx == 1);
}

void test_court_in_doubles(void)
{
	CHECK(court_in_doubles(v3(5.4f, 0, 5), +1) && !court_in_singles(v3(5.4f, 0, 5), +1));
	CHECK(court_in_doubles(v3(-5.4f, 0, -5), -1));
	CHECK(!court_in_doubles(v3(5.6f, 0, 5), +1));
	CHECK(!court_in_doubles(v3(0, 0, 12.1f), +1));
	CHECK(!court_in_doubles(v3(0, 0, 5), -1)); /* wrong side of the net */
	CHECK(court_in_doubles(v3(4.0f, 0, 11.8f), +1));
}

void test_partner_positions(void)
{
	Lab lab;
	start(&lab, 3, CPU_MEDIUM, CPU_MEDIUM);
	CHECK(lab.doubles && lab.vs_cpu);
	CHECK(lab.player.facing == 1 && lab.partner.facing == 1);
	CHECK(lab.cpu.facing == -1 && lab.cpu2.facing == -1);
	CHECK(lab.partner.pos.z < 0 && lab.player.pos.z < 0 && lab.cpu.pos.z > 0 && lab.cpu2.pos.z > 0);
	CHECK(lab.player.pos.x < 0 && lab.partner.pos.x > 0); /* each on its own half */
	CHECK(lab.cpu.pos.x > 0 && lab.cpu2.pos.x < 0);
	CHECK_NEAR(fabsf(lab.partner.pos.x - lab.player.pos.x), COURT_DOUBLES_HALF_W, 0.01);
	/* idle: nobody wanders off their half, and teammates stay apart */
	for (int i = 0; i < 60 * 3; i++)
		lab_step(&lab, 0, 0, DT);
	CHECK(lab.partner.pos.x > 1.0f && lab.cpu2.pos.x < -1.0f);
}

/* Feed one ball (human_serves off: the far team serves it) and report who is to play it. */
static int feed_owner(uint32_t seed, int points_odd, float human_x, float partner_x)
{
	Lab lab;
	lab_start_doubles(&lab, seed, true, CPU_MEDIUM, CPU_MEDIUM);
	lab.human_serves = false;
	lab.score.points[1] = points_odd ? 1 : 0;
	lab.player.pos.x = human_x;
	lab.partner.pos.x = partner_x;
	lab_feed(&lab);
	return lab.near_owner;
}

void test_ball_owner_follows_the_half_it_lands_in(void)
{
	int human_even = 0, partner_odd = 0;
	for (uint32_t s = 1; s <= 30; s++) {
		/* even point: the far server is on its right, the ball goes to the near right court (the human's) */
		human_even += feed_owner(s, 0, -2.74f, 2.74f) == 0;
		partner_odd += feed_owner(s, 1, -2.74f, 2.74f) == 1;
	}
	CHECK(human_even == 30);
	CHECK(partner_odd == 30);
	/* walk over to the other half and the human takes the ball instead */
	int poach = 0;
	for (uint32_t s = 1; s <= 30; s++)
		poach += feed_owner(s, 1, 2.6f, -2.6f) == 0;
	CHECK(poach == 30);
}

void test_serve_side_alternates_and_target_box_sign(void)
{
	Lab lab;
	start(&lab, 5, CPU_MEDIUM, CPU_MEDIUM);
	lab_feed(&lab); /* points 0-0: the human serves from the right court */
	CHECK(lab.state == LAB_SERVE && lab.serve_tx == 1 && lab.player.pos.x < 0);
	start(&lab, 5, CPU_MEDIUM, CPU_MEDIUM);
	lab.score.points[0] = 1; /* one point played: the ad court */
	lab_feed(&lab);
	CHECK(lab.state == LAB_SERVE && lab.serve_tx == -1 && lab.player.pos.x > 0);
	/* a serve from there lands in the box on the other side */
	int in = 0, tried = 0;
	for (uint32_t s = 1; s <= 20; s++) {
		start(&lab, s, CPU_MEDIUM, CPU_MEDIUM);
		lab.score.points[0] = 1;
		lab_feed(&lab);
		float sw = -1;
		bool landed = false;
		for (int i = 0; i < 60 * 8 && !landed; i++) {
			human_script(&lab, &sw);
			lab_step(&lab, 0, 0, DT);
			if (lab.state == LAB_CPU_TURN) {
				landed = true;
				tried++;
				in += lab.ball.pos.x < 0.1f && lab.ball.pos.z > 0 && lab.ball.pos.z <= 6.5f;
			}
			if (lab.state == LAB_RESULT || (lab.state == LAB_WAIT && lab.serve_n == 2))
				break;
		}
	}
	CHECK(tried >= 10);
	CHECK(in == tried);
}

void test_partner_serves_in_turn_and_lands_in_the_box(void)
{
	Lab lab;
	start(&lab, 7, CPU_MEDIUM, CPU_MEDIUM);
	CHECK(lab_server_player(&lab) == 0);
	lab.serve_rot[0] = 1;
	CHECK(lab_server_player(&lab) == 1);
	lab.score.server = 1;
	CHECK(lab_server_player(&lab) == 0); /* the other team's own rotation */
	lab.serve_rot[1] = 3;
	CHECK(lab_server_player(&lab) == 1);

	int in = 0, faults = 0, N = 40;
	for (uint32_t s = 1; s <= (uint32_t)N; s++) {
		start(&lab, s, CPU_MEDIUM, CPU_HARD);
		lab.serve_rot[0] = 1;
		lab_feed(&lab);
		CHECK(lab.partner_hits == 1 && lab.hits == 1 && lab.serve_ball);
		CHECK(lab.state == LAB_OUTGOING || lab.state == LAB_WAIT); /* WAIT: it could not find a serve at all */
		for (int i = 0; i < 60 * 4 && lab.state == LAB_OUTGOING; i++)
			lab_step(&lab, 0, 0, DT);
		if (lab.state == LAB_CPU_TURN)
			in++;
		else
			faults += lab.serve_n == 2 || lab.winner != PT_NONE;
	}
	CHECK(in + faults == N);
	CHECK(in >= 30); /* a Hard partner serves in nearly always */
}

void test_partner_returns_land_in_the_far_court(void)
{
	int returned = 0, landed = 0, tried = 0;
	for (uint32_t s = 1; s <= 60; s++) {
		Lab lab;
		lab_start_doubles(&lab, s, true, CPU_MEDIUM, CPU_HARD);
		lab.human_serves = false;
		lab.score.points[1] = 1; /* the ball goes to the partner's half */
		lab_feed(&lab);
		CHECK(lab.near_owner == 1 && lab.partner_planned);
		tried++;
		for (int i = 0; i < 60 * 6 && lab.partner_hits == 0 && lab.state == LAB_INCOMING; i++)
			lab_step(&lab, 0, 0, DT);
		if (lab.partner_hits == 0)
			continue;
		returned++;
		CHECK(lab.hits == 1 && lab.state == LAB_OUTGOING);
		for (int i = 0; i < 60 * 4 && lab.state == LAB_OUTGOING; i++)
			lab_step(&lab, 0, 0, DT);
		if (lab.state == LAB_CPU_TURN)
			landed++;
	}
	CHECK(returned >= tried * 8 / 10);
	CHECK(landed >= returned * 7 / 10); /* returned and in: the stroke is aimed the right way round */
}

/* Run a whole (short) match; the human plays only the balls that are theirs. */
void test_full_doubles_match(void)
{
	score_set_games_to_win(2);
	int seeds_done = 0;
	for (uint32_t seed = 11; seed <= 14; seed++) {
		Lab lab;
		start(&lab, seed, CPU_MEDIUM, CPU_MEDIUM);
		float sw = -1;
		int games_prev = 0, servers[16][2], ns = 0, gsum;
		servers[ns][0] = lab.score.server; servers[ns][1] = lab_server_player(&lab); ns++;
		for (int f = 0; f < 60 * 900 && !lab.score.over; f++) {
			human_script(&lab, &sw);
			lab_step(&lab, 0, 0, DT);
			gsum = lab.score.games[0] + lab.score.games[1];
			if (gsum != games_prev && ns < 16) {
				games_prev = gsum;
				servers[ns][0] = lab.score.server;
				servers[ns][1] = lab_server_player(&lab);
				ns++;
			}
		}
		CHECK(lab.score.over);
		CHECK(lab.points[0] + lab.points[1] >= 8);
		CHECK(lab.partner_hits > 0 && lab.cpu2_hits > 0 && lab.hits > lab.partner_hits);
		CHECK(lab.cpu_hits > lab.cpu2_hits);
		/* teams alternate games; each team's server alternates between its two players */
		int seen[2][2] = {{0, 0}, {0, 0}};
		for (int i = 0; i < ns; i++) {
			if (i > 0)
				CHECK(servers[i][0] != servers[i - 1][0]);
			seen[servers[i][0]][servers[i][1]]++;
		}
		for (int t = 0; t < 2; t++) {
			int last = -1;
			for (int i = 0; i < ns; i++)
				if (servers[i][0] == t) {
					if (last >= 0)
						CHECK(servers[i][1] == 1 - last);
					last = servers[i][1];
				}
		}
		CHECK(seen[0][0] >= 1 && seen[1][0] >= 1);
		seeds_done++;
	}
	CHECK(seeds_done == 4);
	score_set_games_to_win(0);
}
