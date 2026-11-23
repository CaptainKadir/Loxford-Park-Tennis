#include <string.h>

#include "test.h"
#include "court.h"
#include "aim.h"
#include "lab.h"
#include "solver.h"

static void run(Lab *lab, float secs)
{
	for (int i = 0; i < (int)(secs * 60); i++)
		lab_step(lab, 0, 0, 1.0f / 60);
}

static SwingEvent swing_at(float t, float peak)
{
	SwingEvent s;
	memset(&s, 0, sizeof s);
	s.used_gyro = true;
	s.peak = peak;
	s.t_peak = t;
	s.t_start = t - 0.1f;
	s.t_end = t + 0.1f;
	s.axis = v3(1, 0, 0);
	s.q_peak = quat_identity();
	return s;
}

void test_feeds_land_in_near_court(void)
{
	Lab lab;
	lab_init(&lab, 1234, true);
	int bad = 0;
	for (int i = 0; i < 50; i++) {
		lab_feed(&lab);
		World w = world_std();
		Trace t = flight_trace(lab.ball, &w, 5);
		if (!t.crossed_net || t.hit_net || !court_in_singles(t.first_bounce, -1))
			bad++;
	}
	CHECK(bad == 0);
	if (bad)
		printf("  %d of 50 feeds missed the near court\n", bad);
}

/* Put the player where the lab says to meet the ball. */
static void stand_at_arrival(Lab *lab)
{
	lab->player.pos.x = lab->arrival_stand.x;
	lab->player.pos.z = lab->arrival_stand.z;
}

static Lab ready_lab(void)
{
	Lab lab;
	lab_init(&lab, 99, true);
	lab_feed(&lab);
	/* stand the player so the ball arrives on the forehand side
	 * (right-handed, facing +z: forehand is toward -x of the player) */
	lab.assist_move = false; /* the tests place the player themselves */
	stand_at_arrival(&lab);
	return lab;
}

void test_timed_swing_hits_ball(void)
{
	Lab lab = ready_lab();
	CHECK(lab.arrival_pos.y > REACH_Y_MIN && lab.arrival_pos.y < REACH_Y_MAX);
	while (lab.t < lab.arrival_t + 0.06f)
		lab_step(&lab, 0, 0, 1.0f / 60);
	stand_at_arrival(&lab);
	SwingEvent s = swing_at(lab.arrival_t, 16);
	bool hit = lab_swing(&lab, &s);
	if (hit) {
		CHECK(lab.state == LAB_OUTGOING);
		CHECK(lab.ball.vel.z > 0);
	}
	CHECK(hit);
}

/* Review Focus 2 */
void test_whiff_changes_nothing(void)
{
	Lab lab;
	lab_init(&lab, 5, true);
	lab_feed(&lab);
	Ball before = lab.ball;
	SwingEvent s = swing_at(lab.t, 16); /* ball is still at the machine */
	CHECK(!lab_swing(&lab, &s));
	CHECK(memcmp(&before, &lab.ball, sizeof before) == 0 && lab.state == LAB_INCOMING);
}

/* Review Focus 2 */
void test_one_hit_per_approach(void)
{
	Lab lab = ready_lab();
	while (lab.t < lab.arrival_t + 0.06f)
		lab_step(&lab, 0, 0, 1.0f / 60);
	stand_at_arrival(&lab);
	SwingEvent s1 = swing_at(lab.arrival_t, 16), s2 = swing_at(lab.arrival_t + 0.05f, 16);
	int hits = lab_swing(&lab, &s1) + lab_swing(&lab, &s2);
	CHECK(hits <= 1);
}

void test_missed_ball_is_miss_then_next_feed(void)
{
	Lab lab;
	lab_init(&lab, 7, true);
	lab_feed(&lab);
	int feeds = lab.feeds;
	run(&lab, 4.0f);
	CHECK(lab.result == RES_MISS || lab.feeds > feeds);
	run(&lab, 4.0f);
	CHECK(lab.feeds > feeds);
}

/* Review Focus 4 */
void test_long_dt_is_stable(void)
{
	Lab lab;
	lab_init(&lab, 3, true);
	lab_feed(&lab);
	for (int i = 0; i < 20; i++)
		lab_step(&lab, 1, 1, 0.5f); /* clamped to 0.1 s each */
	CHECK(isfinite(lab.ball.pos.x) && isfinite(lab.player.pos.z));
	CHECK(lab.t <= 2.0f + 1e-3f);
}

/* A swing is recognised up to ~0.3 s after its peak (the follow-through
 * has to slow down first); the ball must not be called a miss, or drop out
 * of the history, before that. */
void test_late_recognised_swing_still_hits(void)
{
	int lost = 0, tried = 0;
	for (uint32_t seed = 1; seed <= 50; seed++) {
		Lab lab;
		lab_init(&lab, seed, true);
		lab_feed(&lab);
		lab.assist_move = false;
		stand_at_arrival(&lab);
		if (lab.arrival_pos.y < REACH_Y_MIN || lab.arrival_pos.y > REACH_Y_MAX)
			continue;
		tried++;
		while (lab.t < lab.arrival_t + 0.3f)
			lab_step(&lab, 0, 0, 1.0f / 60);
		stand_at_arrival(&lab);
		SwingEvent s = swing_at(lab.arrival_t, 16);
		if (!lab_swing(&lab, &s))
			lost++;
	}
	CHECK(tried > 40);
	CHECK(lost == 0);
	if (lost)
		printf("  %d of %d late-recognised swings lost\n", lost, tried);
}

/* Review fix 2: a swing while the hit ball is flying away must not erase
 * the hit's record (its log line and the overlay depend on it). */
void test_later_swing_keeps_hit_record(void)
{
	Lab lab = ready_lab();
	while (lab.t < lab.arrival_t + 0.06f)
		lab_step(&lab, 0, 0, 1.0f / 60);
	stand_at_arrival(&lab);
	SwingEvent s1 = swing_at(lab.arrival_t, 16);
	CHECK(lab_swing(&lab, &s1));
	for (int i = 0; i < 30; i++)
		lab_step(&lab, 0, 0, 1.0f / 60);
	SwingEvent s2 = swing_at(lab.t - 0.05f, 12);
	CHECK(!lab_swing(&lab, &s2));
	CHECK(lab.last.hit);
}

/* Review fix 7: the hit record carries the stroke and contact details. */
void test_hit_record_has_stroke_details(void)
{
	Lab lab = ready_lab();
	while (lab.t < lab.arrival_t + 0.06f)
		lab_step(&lab, 0, 0, 1.0f / 60);
	stand_at_arrival(&lab);
	SwingEvent s = swing_at(lab.arrival_t, 16);
	CHECK(lab_swing(&lab, &s));
	CHECK(lab.last.face != 0 || lab.last.path != 0);
	CHECK(v3_len(lab.last.contact_vel) > 1);
	CHECK(fabsf(lab.last.contact_pos.z - lab.arrival_pos.z) < 0.3f);
}

/* Movement assist: with no D-pad input the player drifts to where the ball
 * will arrive; without it the player stays put and mostly cannot reach. */
static void reach_stats(bool assist, int *in_reach, int *valid)
{
	*in_reach = 0;
	*valid = 0;
	for (uint32_t seed = 1; seed <= 60; seed++) {
		Lab lab;
		lab_init(&lab, seed, true);
		lab.assist_move = assist;
		lab_feed(&lab);
		while (lab.state == LAB_INCOMING && lab.t < lab.arrival_t)
			lab_step(&lab, 0, 0, 1.0f / 60);
		if (lab.state != LAB_INCOMING)
			continue;
		if (lab.arrival_pos.y < REACH_Y_MIN || lab.arrival_pos.y > REACH_Y_MAX)
			continue; /* height is nobody's fault but the machine's */
		(*valid)++;
		if (player_reach(&lab.player, lab.arrival_pos) != REACH_NONE)
			(*in_reach)++;
	}
}

void test_movement_assist_brings_player_into_reach(void)
{
	int with, with_n, without, without_n;
	reach_stats(true, &with, &with_n);
	reach_stats(false, &without, &without_n);
	CHECK(with_n > 40 && without_n > 40);
	CHECK(with >= with_n * 9 / 10);
	CHECK(without <= without_n * 6 / 10);
	if (with < with_n * 9 / 10 || without > without_n * 6 / 10)
		printf("  in reach: assist %d/%d, without %d/%d\n", with, with_n, without, without_n);
}

void test_movement_assist_yields_to_the_dpad(void)
{
	Lab lab;
	lab_init(&lab, 11, true);
	lab.assist_move = true;
	lab_feed(&lab);
	float x0 = lab.player.pos.x;
	for (int i = 0; i < 30; i++)
		lab_step(&lab, 1, 0, 1.0f / 60); /* D-pad right = toward -x */
	CHECK(lab.player.pos.x < x0 - 1.0f);
}

/* Aim assist in the lab: a standard-remote swing (accelerometer only) put
 * through live balls ends up in far more often with the assist on. */
static int in_count(bool aim, int *hits_out)
{
	int in = 0, hits = 0;
	for (uint32_t seed = 1; seed <= 60; seed++) {
		Lab lab;
		lab_init(&lab, seed, true);
		lab.assist_aim = aim;
		lab_feed(&lab);
		while (lab.state == LAB_INCOMING && lab.t < lab.arrival_t - 0.0f)
			lab_step(&lab, 0, 0, 1.0f / 60);
		if (lab.state != LAB_INCOMING)
			continue;
		SwingEvent s;
		memset(&s, 0, sizeof s);
		s.used_gyro = false;
		s.peak = 3.0f;
		s.acc_start = v3(0, 0, 1);
		s.acc_peak = v3(0, 3, 2);
		s.t_peak = lab.arrival_t;
		if (!lab_swing(&lab, &s))
			continue;
		hits++;
		for (int i = 0; i < 60 * 6 && lab.state == LAB_OUTGOING; i++)
			lab_step(&lab, 0, 0, 1.0f / 60);
		if (lab.result == RES_IN)
			in++;
	}
	*hits_out = hits;
	return in;
}

void test_aim_assist_in_the_lab(void)
{
	int h_on, h_off;
	int on = in_count(true, &h_on), off = in_count(false, &h_off);
	printf("  lab: %d/%d in with assist, %d/%d without\n", on, h_on, off, h_off);
	CHECK(h_on > 30 && h_off > 30);
	CHECK(on > off + h_on / 5);
}

void test_hit_record_has_aim_nudge(void)
{
	Lab lab;
	lab_init(&lab, 21, true);
	lab.assist_aim = true;
	lab_feed(&lab);
	while (lab.state == LAB_INCOMING && lab.t < lab.arrival_t)
		lab_step(&lab, 0, 0, 1.0f / 60);
	SwingEvent s;
	memset(&s, 0, sizeof s);
	s.peak = 3.0f;
	s.acc_start = v3(0, 0, 1);
	s.acc_peak = v3(0, 3, 2);
	s.t_peak = lab.arrival_t;
	CHECK(lab_swing(&lab, &s));
	CHECK(fabsf(lab.last.aim_elev) <= AIM_MAX_ELEV + 1e-4f);
	CHECK(fabsf(lab.last.aim_azim) <= AIM_MAX_AZIM + 1e-4f);
}

/* A swing is recognised after its peak, so the hit is applied to the past and
 * the ball is moved. What is drawn must glide there, not jump. */
void test_hit_does_not_teleport_the_drawn_ball(void)
{
	for (int arcade = 0; arcade <= 1; arcade++) {
		Lab lab = ready_lab();
		lab_set_arcade(&lab, arcade);
		lab_feed(&lab);
		stand_at_arrival(&lab);
		while (lab.t < lab.arrival_t + 0.12f) /* recognised 120 ms after the peak */
			lab_step(&lab, 0, 0, 1.0f / 60);
		stand_at_arrival(&lab);
		Ball before = lab_ball_visual(&lab);
		SwingEvent s = swing_at(lab.arrival_t, 16);
		if (!lab_swing(&lab, &s))
			continue; /* this feed was out of reach: nothing to check */
		Ball after = lab_ball_visual(&lab);
		Vec3 d = v3_sub(after.pos, before.pos);
		CHECK(v3_len(d) < 0.05f); /* same place on the first frame */
		for (int i = 0; i < 30; i++)
			lab_step(&lab, 0, 0, 1.0f / 60);
		Ball later = lab_ball_visual(&lab);
		CHECK(v3_len(v3_sub(later.pos, lab.ball.pos)) < 0.05f); /* converged */
	}
}

/* Auto-run must put the player in reach of the ball every time, on both the
 * real and the arcade ball, including at a lower (console) frame rate. */
static void reach_all(bool arcade, float dt, int *in_reach, int *valid)
{
	*in_reach = *valid = 0;
	for (uint32_t seed = 1; seed <= 80; seed++) {
		Lab lab;
		lab_init(&lab, seed, true);
		lab_set_arcade(&lab, arcade);
		lab_feed(&lab);
		while (lab.state == LAB_INCOMING && lab.t < lab.arrival_t)
			lab_step(&lab, 0, 0, dt);
		if (lab.state != LAB_INCOMING)
			continue;
		if (lab.arrival_pos.y < REACH_Y_MIN || lab.arrival_pos.y > REACH_Y_MAX)
			continue;
		(*valid)++;
		if (player_reach(&lab.player, lab.arrival_pos) != REACH_NONE)
			(*in_reach)++;
	}
}

void test_auto_run_always_reaches_the_ball(void)
{
	for (int arcade = 0; arcade <= 1; arcade++)
		for (int slow = 0; slow <= 1; slow++) {
			int in, n;
			reach_all(arcade, slow ? 1.0f / 25.0f : 1.0f / 60.0f, &in, &n);
			printf("  auto-run %s %s: in reach %d/%d\n", arcade ? "arcade" : "real",
			       slow ? "25fps" : "60fps", in, n);
			CHECK(n > 50);
			CHECK(in * 100 >= n * 98);
		}
}

/* Two-player receiver: it starts running when the other player's serve is struck, not only when the
 * serve bounces and arrives for real. */
void test_remote_receiver_runs_while_the_serve_flies(void)
{
	Lab lab;
	lab_start_remote(&lab, 5, true, 1); /* this player receives */
	lab.state = LAB_WAIT;
	lab.timer = 1e9f;
	Ball serve = {0};
	serve.pos = v3(-1.5f, 2.3f, -12.1f); /* the server's coordinates: from their baseline, to our side */
	float el = 0, az = 0;
	CHECK(solve_launch(serve.pos, v3(2.0f, 0.0f, 5.0f), 26.0f, 150.0f, 0.0f, &lab.world, &el, &az));
	serve.vel = launch_velocity(26.0f, el, az);
	float x0 = lab.player.pos.x, z0 = lab.player.pos.z;
	lab_remote_serve(&lab, serve);
	CHECK(lab.anticipate);
	for (int i = 0; i < 30; i++)
		lab_step(&lab, 0, 0, 1.0f / 60);
	float moved = fabsf(lab.player.pos.x - x0) + fabsf(lab.player.pos.z - z0);
	CHECK(moved > 0.3f);
	lab_remote_ball(&lab, serve, 0.0f, false); /* the real ball arrives: no longer anticipating */
	CHECK(!lab.anticipate);
}

/* Two-player receiver: the served ball arrives already bounced; a meeting point must still be found
 * (it used to wait for a second bounce beyond the baseline, leaving the receiver standing). */
void test_remote_receiver_finds_the_served_ball_after_its_bounce(void)
{
	Lab lab;
	lab_start_remote(&lab, 5, true, 1);
	lab.state = LAB_WAIT;
	lab.timer = 1e9f;
	Ball b = {0};
	b.pos = v3(0.8f, 0.04f, 4.2f); /* the server's coordinates, just after the bounce in their service box */
	b.vel = v3(1.9f, 5.2f, 14.6f);
	lab_remote_ball(&lab, b, 0.0f, true);
	CHECK(lab.state == LAB_INCOMING);
	CHECK(lab.arrival_t < 1e8f);
	float x0 = lab.player.pos.x, z0 = lab.player.pos.z;
	for (int i = 0; i < 20; i++)
		lab_step(&lab, 0, 0, 1.0f / 60);
	CHECK(fabsf(lab.player.pos.x - x0) + fabsf(lab.player.pos.z - z0) > 0.05f);
}

/* Two-player receiver: a ball the other player hit long sails past before it lands. That is their error
 * (out), not a miss by the receiver: the receiver must not award them the point. */
void test_remote_long_ball_is_out_not_a_miss(void)
{
	Lab lab;
	lab_start_remote(&lab, 5, true, 1);
	lab.state = LAB_WAIT;
	lab.timer = 1e9f;
	Ball b = {0};
	b.pos = v3(0.0f, 1.5f, 8.0f); /* the hitter's coordinates: a hard, flat shot that carries far past their baseline target */
	b.vel = v3(0.0f, 3.0f, 38.0f);
	lab_remote_ball(&lab, b, 0.0f, false);
	for (int i = 0; i < 60 * 4 && lab.state == LAB_INCOMING; i++)
		lab_step(&lab, 0, 0, 1.0f / 60);
	CHECK(lab.state == LAB_RESULT);
	CHECK(lab.winner == PT_HUMAN);
	CHECK(lab.why == WHY_OUT);
}

/* Online: the guest adopts the host's score, mirrored, and only in a remote lab. */
void test_remote_score_is_adopted_and_ignored_outside_remote(void)
{
	Lab lab;
	int pts[2] = {2, 1}, games[2] = {1, 3}, total[2] = {9, 7};
	lab_start_rally(&lab, 5, true, 1);
	lab_remote_score(&lab, pts, games, 1, false, 0, total); /* not a remote lab: ignored */
	CHECK(lab.score.games[1] == 0 && lab.points[0] == 0);
	lab_start_remote(&lab, 5, true, 1);
	lab_remote_score(&lab, pts, games, 1, false, 0, total);
	CHECK(lab.score.points[0] == 2 && lab.score.points[1] == 1);
	CHECK(lab.score.games[0] == 1 && lab.score.games[1] == 3);
	CHECK(lab.score.server == 1 && !lab.score.over);
	CHECK(lab.points[0] == 9 && lab.points[1] == 7);
	int bad[2] = {-4, 3};
	lab_remote_score(&lab, bad, games, 0, true, 1, total);
	CHECK(lab.score.points[0] == 0 && lab.score.over && lab.score.winner == 1);
}

/* The toss must stay in the strike window long enough to hit, and the swing must serve it, on both
 * the real and the arcade (Fast) ball. Arcade gravity is far heavier, so the toss is scaled to it. */
void test_serve_toss_is_hittable_on_both_balls(void)
{
	for (int arcade = 0; arcade <= 1; arcade++) {
		Lab lab;
		lab_start_rally(&lab, 5, true, 1);
		lab_set_arcade(&lab, arcade);
		lab.human_serves = true;
		lab_feed(&lab);
		CHECK(lab.state == LAB_SERVE);
		float in_window = 0;
		for (int i = 0; i < 180 && lab.state == LAB_SERVE; i++) {
			lab_step(&lab, 0, 0, 1.0f / 60);
			if (lab.ball.pos.y >= 1.3f && lab.ball.pos.y <= 2.8f)
				in_window += 1.0f / 60;
		}
		CHECK(in_window > 0.25f);
		lab_feed(&lab);
		for (int i = 0; i < 120 && lab.state == LAB_SERVE && lab.ball.vel.y > 0; i++) /* swing at the top of the toss */
			lab_step(&lab, 0, 0, 1.0f / 60);
		SwingEvent s = swing_at(lab.t, 16);
		lab_swing(&lab, &s);
		CHECK(lab.state == LAB_OUTGOING);
	}
}

/* Two linked remote labs over a laggy link (100 ms each way), both swinging at random speeds for several
 * minutes of play. Rules must hold on both sides: the player who hit the ball last never wins a point by
 * a fault, a net or an out, and once the link has drained both sides show the same score, mirrored. */
typedef struct {
	float at;
	int kind;
	Ball b;
	float age;
	int bounced, w, why;
	float x, z;
	Lab *to;
} LagMsg;

typedef struct {
	LagMsg q[4096];
	int qn;
	float now, lat;
} LagLink;

typedef struct {
	int serve, out, pt;
} LagSeen;

static void lag_push(LagLink *l, LagMsg m)
{
	if (l->qn >= 4096)
		return;
	m.at = l->now + l->lat;
	l->q[l->qn++] = m;
}

static void lag_deliver(LagLink *l)
{
	for (int i = 0; i < l->qn; i++) {
		if (l->q[i].at > l->now)
			continue;
		LagMsg m = l->q[i];
		l->q[i] = l->q[--l->qn];
		i--;
		if (m.kind == 0)
			lab_remote_serve(m.to, m.b);
		else if (m.kind == 1)
			lab_remote_ball(m.to, m.b, m.age + l->lat, m.bounced);
		else if (m.kind == 2)
			lab_remote_point(m.to, m.w, m.why);
		else
			lab_remote_pos(m.to, m.x, m.z);
	}
}

static void lag_carry(LagLink *l, Lab *from, Lab *to, LagSeen *s)
{
	LagMsg m;
	memset(&m, 0, sizeof m);
	m.to = to;
	if (from->serve_seq != s->serve) {
		s->serve = from->serve_seq;
		m.kind = 0;
		m.b = from->serve_out;
		lag_push(l, m);
	}
	if (from->out_seq != s->out) {
		s->out = from->out_seq;
		m.kind = 1;
		m.b = from->out_ball;
		m.age = from->out_age;
		m.bounced = from->out_bounced;
		lag_push(l, m);
	}
	if (from->pt_seq != s->pt) {
		s->pt = from->pt_seq;
		m.kind = 2;
		m.w = from->pt_winner;
		m.why = from->pt_why;
		lag_push(l, m);
	}
	m.kind = 3;
	m.x = from->player.pos.x;
	m.z = from->player.pos.z;
	lag_push(l, m);
}

static unsigned lag_rand(unsigned *st)
{
	*st = *st * 1664525u + 1013904223u;
	return *st >> 8;
}

void test_remote_pair_over_lag_keeps_rules_and_scores_in_sync(void)
{
	static LagLink link;
	static Lab lab[2];
	LagSeen seen[2] = {{0, 0, 0}, {0, 0, 0}};
	int tossed[2] = {0, 0}, prev_mine[2] = {0, 0}, last = -1, last_pts[2] = {0, 0}, bad = 0, points = 0;
	unsigned rs = 3;

	memset(&link, 0, sizeof link);
	link.lat = 0.1f;
	for (int i = 0; i < 2; i++) {
		lab_start_remote(&lab[i], 5 + i * 7919, true, i);
		lab[i].human_serves = true;
	}
	/* 400 s of play, then 10 s with no swings so the link drains and the last point settles */
	for (int f = 0; f < 60 * 410; f++) {
		bool swinging = f < 60 * 400;
		link.now += 1.0f / 60;
		lag_deliver(&link);
		for (int i = 0; i < 2; i++)
			lab_step(&lab[i], 0, 0, 1.0f / 60);
		for (int i = 0; i < 2; i++) {
			static int so[2], sv[2];
			if (f == 0)
				so[i] = sv[i] = 0;
			if ((lab[i].out_seq != so[i] || lab[i].serve_seq != sv[i]) && lab[i].state != LAB_WAIT)
				last = i;
			so[i] = lab[i].out_seq;
			sv[i] = lab[i].serve_seq;
		}
		lag_carry(&link, &lab[0], &lab[1], &seen[0]);
		lag_carry(&link, &lab[1], &lab[0], &seen[1]);
		for (int i = 0; i < 2; i++) {
			Lab *a = &lab[i];
			if (!swinging)
				break;
			if (a->state == LAB_SERVE && a->ball.vel.y < 0.5f && !tossed[i]) {
				tossed[i] = 1;
				SwingEvent e = swing_at(a->t, 6 + (int)(lag_rand(&rs) % 20));
				lab_swing(a, &e);
			}
			if (a->state != LAB_SERVE)
				tossed[i] = 0;
			if (a->state == LAB_INCOMING && a->arrival_t < 1e8f && fabsf(a->t - a->arrival_t) < 0.009f) {
				StrokeParams sp = {10 + (int)(lag_rand(&rs) % 140) / 10.0f, 0.0f,
						   ((int)(lag_rand(&rs) % 100) - 50) / 200.0f, 0};
				if (lag_rand(&rs) % 5) {
					SwingEvent e = swing_at(a->arrival_t, 16);
					lab_swing_params(a, &e, &sp);
				}
			}
		}
		for (int i = 0; i < 2; i++) {
			int total = lab[i].points[0] + lab[i].points[1];
			if (total == last_pts[i])
				continue;
			last_pts[i] = total;
			int mine = lab[i].points[0] > prev_mine[i];
			int why = lab[i].why;
			int winner_side = mine ? i : 1 - i;
			prev_mine[i] = lab[i].points[0];
			points++;
			if ((why == WHY_OUT || why == WHY_NET || why == WHY_FAULT) && winner_side == last)
				bad++;
		}
	}
	CHECK(points > 20);
	CHECK(bad == 0);
	CHECK(lab[0].points[0] == lab[1].points[1]);
	CHECK(lab[0].points[1] == lab[1].points[0]);
}
