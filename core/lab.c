#include <string.h>

#include "lab.h"
#include "court.h"
#include "solver.h"

#define DEG (3.14159265f / 180.0f)

static uint32_t rng_next(Lab *lab)
{
	uint32_t x = lab->rng;
	x ^= x << 13;
	x ^= x >> 17;
	x ^= x << 5;
	lab->rng = x;
	return x;
}

static float rng_range(Lab *lab, float lo, float hi)
{
	return lo + (hi - lo) * (float)(rng_next(lab) >> 8) / 16777216.0f;
}

void lab_init(Lab *lab, uint32_t seed, bool right_handed)
{
	memset(lab, 0, sizeof *lab);
	player_init(&lab->player, +1, right_handed);
	lab->world = world_std();
	lab->vscale = 1.0f;
	lab->rng = seed ? seed : 0x9e3779b9u;
	lab->state = LAB_WAIT;
	lab->timer = LAB_WAIT_TIME;
	lab->result = RES_NONE;
	lab->arrival_t = 1e9f;
	lab->path_bounce = -1;
	lab->last.net_margin = -1000.0f;
	lab->assist_move = true;
	lab->assist_aim = true;
	lab->serve_tx = 1;
	lab->p_arr_t = 1e9f;
}

static bool g_easy_returns;
void lab_set_easy_returns(bool on) { g_easy_returns = on; }

#define STRONG_AIM 1.8f /* times the normal nudge limits */
static bool g_strong_aim;
void lab_set_strong_aim(bool on) { g_strong_aim = on; }
#define EASY_WINDOW 1.7f /* timing window x, Assist */
#define EASY_REACH 1.4f  /* reach x, Assist */

void lab_set_arcade(Lab *lab, bool arcade)
{
	lab->world = arcade ? world_arcade() : world_std();
	lab->vscale = arcade ? ARCADE_VSCALE : 1.0f;
}

void lab_start_rally(Lab *lab, uint32_t seed, bool right_handed, int cpu_level)
{
	lab_init(lab, seed, right_handed);
	lab->vs_cpu = true;
	player_init(&lab->cpu, -1, true);
	lab->skill = cpu_skill(cpu_level);
	lab->cpu_rng = (seed ? seed : 1u) * 2654435761u + 12345u;
	lab->winner = PT_NONE;
	lab->why = WHY_NONE;
	score_init(&lab->score, 0); /* the human serves first */
	lab->serve_n = 1;
}

void lab_start_remote(Lab *lab, uint32_t seed, bool right_handed, int first_server)
{
	lab_start_rally(lab, seed, right_handed, 0);
	lab->remote = true;
	score_init(&lab->score, first_server);
}

void lab_start_doubles(Lab *lab, uint32_t seed, bool right_handed, int cpu_level, int partner_level)
{
	lab_start_rally(lab, seed, right_handed, cpu_level);
	lab->doubles = true;
	player_init(&lab->partner, +1, true);
	player_init(&lab->cpu2, -1, true);
	lab->pskill = cpu_skill(partner_level);
	lab->player.pos.x = -COURT_DOUBLES_HALF_W * 0.5f;
	lab->partner.pos.x = COURT_DOUBLES_HALF_W * 0.5f;
	lab->cpu.pos.x = COURT_DOUBLES_HALF_W * 0.5f;
	lab->cpu2.pos.x = -COURT_DOUBLES_HALF_W * 0.5f;
}

static void mirror_ball(Ball *b)
{
	b->pos.x = -b->pos.x; b->pos.z = -b->pos.z;
	b->vel.x = -b->vel.x; b->vel.z = -b->vel.z;
	b->spin.x = -b->spin.x; b->spin.z = -b->spin.z;
}

/* Signed landing error along the launch direction; net contact = short. */
static float feed_error(Vec3 from, Vec3 target, float speed, float topspin, float el,
			float az, const World *w)
{
	Vec3 dir = launch_velocity(1, el, az);
	Ball b = {from, launch_velocity(speed, el, az), spin_vector(dir, topspin, 0)};
	Trace tr = flight_trace(b, w, 4.0f);
	if (tr.hit_net || !tr.crossed_net)
		return -100.0f;
	Vec3 d = v3_norm(v3(dir.x, 0, dir.z));
	return v3_dot(v3_sub(tr.first_bounce, target), d);
}

/* side: -1 = the ball is bound for the near (human) court, +1 = the far one;
 * the bounce that counts is the first on that side. */
static void predict_path(Lab *lab, int side)
{
	Ball b = lab->ball;
	lab->arrival_t = 1e9f; /* a new flight: no meeting point chosen yet */
	lab->arrival_idx = -1;
	lab->path_t0 = lab->t;
	lab->path_bounce = -1;
	lab->path_n = 0;
	for (int i = 0; i < LAB_PATH; i++) {
		int ev = sim_step(&b, &lab->world, SIM_DT);
		lab->path[i] = b.pos;
		lab->path_n = i + 1;
		if ((ev & SIM_BOUNCE) && b.pos.z * (float)side > 0 && lab->path_bounce < 0)
			lab->path_bounce = i;
		if (ev & SIM_REST)
			break;
	}
}

/* Where and when a player should meet the ball: a point on the ball's path,
 * after its bounce, that the player can run to in time and that is at a
 * comfortable height (best near 1 m). The player then stands 0.8 m to one
 * side of it and half a metre behind, which puts it in reach. delay is how
 * long before the player can start running; run_speed its top speed. */
/* Auto-run top speed: steering stays stable at 90% of the D-pad speed. */
#define HUMAN_RUN_SPEED (PLAYER_MAX_SPEED * 0.9f)
#define HUMAN_RUN_UP 0.0f /* s allowed for the human to get up to speed */
#define STAND_SIDE 0.6f /* m from the ball to the body, racket side */

static void arrival_calc(const Lab *lab, const Player *p, float run_speed, float delay, float run_up,
			 int *a_idx, float *a_t, Vec3 *a_pos, Vec3 *a_stand)
{
	if (*a_idx >= 0 && lab->t >= *a_t)
		return; /* the moment has come: stop moving the target */
	int start = lab->path_bounce >= 0 ? lab->path_bounce + 1 : 1;
	float best = -1e9f;
	int best_i = -1;
	Vec3 best_stand = v3(0, 0, 0);
	float f = (float)p->facing;
	for (int i = start; i < lab->path_n; i += 2) {
		Vec3 q = lab->path[i];
		float avail = lab->path_t0 + (float)(i + 1) * SIM_DT - lab->t;
		if (avail < 0 || q.y < 0.3f || q.y > 2.3f)
			continue;
		/* stand 0.5 m behind the contact point, to the nearer side */
		float sz = q.z - 0.5f * f;
		if (sz * f > -0.5f || sz * f < -COURT_HALF_LEN - 4.0f)
			continue; /* not on the player's own half */
		/* stand with the ball on the racket side (forehand) when there is time,
		 * otherwise on whichever side is nearer */
		float hand = p->right_handed ? 1.0f : -1.0f;
		float xf = q.x + f * hand * STAND_SIDE, xb = q.x - f * hand * STAND_SIDE;
		float dzs = sz - p->pos.z;
		float need_f = delay + run_up + sqrtf((xf - p->pos.x) * (xf - p->pos.x) + dzs * dzs) / run_speed;
		float sx = xf;
		if (need_f > avail - 0.05f && fabsf(xb - p->pos.x) < fabsf(xf - p->pos.x))
			sx = xb;
		if (lab->want_backhand && p == &lab->player) {
			/* the phone is turned to the backhand side: stand with the ball there if there is time */
			float need_b = delay + run_up + sqrtf((xb - p->pos.x) * (xb - p->pos.x) + dzs * dzs) / run_speed;
			if (need_b <= avail - 0.05f)
				sx = xb;
		}
		float dx = sx - p->pos.x, dz = dzs;
		float need = delay + run_up + sqrtf(dx * dx + dz * dz) / run_speed;
		float margin = avail - need;
		float score = margin >= 0 ? -fabsf(q.y - 1.0f) - 0.05f * avail : -10.0f + margin;
		if (i == *a_idx)
			score += 0.1f; /* stick with the last choice unless something is clearly better */
		if (score > best) {
			best = score;
			best_i = i;
			best_stand = v3(sx, 0, sz);
		}
	}
	if (best_i < 0)
		return; /* nothing viable (the ball has passed them all): keep the last choice */
	*a_idx = best_i;
	*a_t = lab->path_t0 + (float)(best_i + 1) * SIM_DT;
	*a_pos = lab->path[best_i];
	*a_stand = best_stand;
}

static void arrival_for(Lab *lab, const Player *p, float run_speed, float delay, float run_up)
{
	arrival_calc(lab, p, run_speed, delay, run_up, &lab->arrival_idx, &lab->arrival_t, &lab->arrival_pos,
		     &lab->arrival_stand);
}

/* ---- doubles helpers (every use is guarded by lab->doubles, except where noted as a no-op in singles) ---- */
#define DBL_READY_X (COURT_DOUBLES_HALF_W * 0.5f) /* each player's own half of the court */
#define DBL_APART 1.4f                            /* m: teammates keep this far apart sideways */

static Player *far_hitter(Lab *lab) { return lab->doubles && lab->cpu_hitter ? &lab->cpu2 : &lab->cpu; }
static bool partner_owns(const Lab *lab) { return lab->doubles && lab->near_owner == 1; }
static float human_ready_x(const Lab *lab) { return lab->doubles ? -DBL_READY_X : 0.0f; }
static float far_ready_x(const Lab *lab, const Player *p) { return !lab->doubles ? 0.0f : (p == &lab->cpu2 ? -DBL_READY_X : DBL_READY_X); }
static bool in_court(const Lab *lab, Vec3 p, int z_sign)
{
	return lab->doubles ? court_in_doubles(p, z_sign) : court_in_singles(p, z_sign);
}
/* +1 on the deuce (right) court points, -1 on the ad ones: serving alternates with the points played. */
static int serve_sign(const Lab *lab) { return ((lab->score.points[0] + lab->score.points[1]) & 1) ? -1 : 1; }
/* x where the ball on its way over will first bounce (or end its flight), from the last predicted path. */
static float path_land_x(const Lab *lab)
{
	int i = lab->path_bounce >= 0 ? lab->path_bounce : lab->path_n - 1;
	return i >= 0 ? lab->path[i].x : lab->ball.pos.x;
}
/* Keep a teammate from standing on the other: the one that is not playing the ball steps aside. */
static void nudge_apart(Player *mover, const Player *other, float dt)
{
	float dx = mover->pos.x - other->pos.x;
	if (fabsf(dx) >= DBL_APART || fabsf(mover->pos.z - other->pos.z) > 2.0f)
		return;
	float side = dx >= 0 ? 1.0f : -1.0f;
	float need = DBL_APART - fabsf(dx);
	mover->pos.x += side * fminf(need, 5.0f * dt);
}

static void partner_plan(Lab *lab)
{
	lab->partner_swung = false;
	lab->partner_planned = false;
	lab->p_arr_idx = -1;
	lab->p_arr_t = 1e9f;
	if (!partner_owns(lab))
		return;
	arrival_calc(lab, &lab->partner, lab->pskill.run_speed, lab->pskill.react, 0.0f, &lab->p_arr_idx,
		     &lab->p_arr_t, &lab->p_arr_pos, &lab->p_arr_stand);
	lab->partner_planned = lab->p_arr_t < 1e8f;
	lab->partner_react_until = lab->t + lab->pskill.react;
	lab->partner_swing_t = lab->p_arr_t +
			       cpu_rand_range(&lab->cpu_rng, -lab->pskill.timing_err, lab->pskill.timing_err);
}

/* A ball is heading for the near side (its path is predicted): the player nearer where it will land takes
 * it, the human winning close calls. Only decides who runs for it and swings first: the human can always
 * swing at it too. */
static void choose_near_owner(Lab *lab)
{
	float bx = path_land_x(lab);
	lab->near_owner = fabsf(bx - lab->partner.pos.x) + 0.4f < fabsf(bx - lab->player.pos.x) ? 1 : 0;
	partner_plan(lab);
}

int lab_server_player(const Lab *lab)
{
	return lab->doubles ? (lab->serve_rot[lab->score.server ? 1 : 0] & 1) : 0;
}

static void update_arrival(Lab *lab)
{
	arrival_for(lab, &lab->player, HUMAN_RUN_SPEED, 0.0f, HUMAN_RUN_UP);
}

#define SERVE_TOSS_VY 5.0f     /* m/s up: the toss peaks a little over 2.3 m */
#define SERVE_HIT_MIN_Y 1.3f   /* m: the ball can be struck between these heights */
#define SERVE_HIT_MAX_Y 2.8f
#define SERVE_BASE_SPEED 26.0f /* m/s for an average swing */
#define SERVE_BOX_Z 6.4f
#define SERVE_FAULT_WAIT 0.9f

/* Toss speed that peaks at the real-ball height (about 2.33 m) whatever the world's gravity and drag. */
static float toss_speed(const Lab *lab)
{
	float target = 1.0f + SERVE_TOSS_VY * SERVE_TOSS_VY / (2.0f * AIR_STD.gravity);
	float lo = SERVE_TOSS_VY, hi = SERVE_TOSS_VY * 3.0f;
	for (int i = 0; i < 20; i++) {
		float mid = 0.5f * (lo + hi);
		Ball b = {v3(0, 1.0f, 0), v3(0, mid, 0), v3(0, 0, 0)};
		float top = b.pos.y;
		for (int k = 0; k < 600 && b.vel.y > 0; k++) {
			sim_step(&b, &lab->world, SIM_DT);
			if (b.pos.y > top)
				top = b.pos.y;
		}
		if (top < target)
			lo = mid;
		else
			hi = mid;
	}
	return 0.5f * (lo + hi);
}

/* The human serves: stand at the baseline, toss the ball up, the next swing hits it. */
static void start_human_serve(Lab *lab)
{
	lab->serve_tx = lab->doubles ? serve_sign(lab) : 1;
	lab->player.pos = v3(-1.2f * (float)lab->serve_tx, 0.0f, -(COURT_HALF_LEN + 0.3f));
	lab->player.vel = v3(0, 0, 0);
	lab->cpu.pos.x = -1.5f;
	lab->cpu.pos.z = COURT_HALF_LEN + 0.5f;
	lab->cpu.vel = v3(0, 0, 0);
	if (lab->doubles) { /* the others wait on their own halves */
		lab->cpu.pos.x = DBL_READY_X;
		lab->cpu2.pos = v3(-DBL_READY_X, 0, COURT_HALF_LEN + 0.5f);
		lab->cpu2.vel = v3(0, 0, 0);
		lab->partner.pos = v3(DBL_READY_X, 0, -(COURT_HALF_LEN + 0.5f));
		lab->partner.vel = v3(0, 0, 0);
	}
	lab->cpu_planned = false;
	lab->ball.pos = v3(lab->player.pos.x - 0.1f, 1.0f, lab->player.pos.z + 0.3f);
	lab->ball.vel = v3(0, toss_speed(lab), 0);
	lab->ball.spin = v3(0, 0, 0);
	lab->state = LAB_SERVE;
	lab->play_t = lab->t;
	lab->hittable = false;
	lab->serve_ball = false;
	lab->winner = PT_NONE;
	lab->why = WHY_NONE;
	lab->result = RES_NONE;
	lab->hist_n = 0;
	lab->hist_head = 0;
	lab->arrival_t = 1e9f;
	lab->arrival_idx = -1;
	lab->path_n = 0;
}

static void end_point(Lab *lab, PointWinner w, PointWhy why);

/* The toss fell without being struck: that is not a fault, the serve (first or second) is tossed again. */
static void serve_toss_again(Lab *lab)
{
	lab->serve_ball = false;
	lab->state = LAB_WAIT;
	lab->timer = SERVE_FAULT_WAIT * 0.6f;
	lab->why = WHY_NONE;
}

/* A fault: the first one gives a second serve, the second loses the point. */
static void serve_fault(Lab *lab)
{
	lab->serve_ball = false;
	if (lab->serve_n >= 2) {
		end_point(lab, PT_CPU, WHY_FAULT);
		return;
	}
	lab->serve_n = 2;
	lab->state = LAB_WAIT;
	lab->timer = SERVE_FAULT_WAIT;
	lab->why = WHY_FAULT; /* shown while waiting for the second serve */
}

static void cpu_plan(Lab *lab);

/* The CPU partner serves: it hits at once from the baseline into the box diagonally across. */
static void partner_serve(Lab *lab)
{
	int sg = serve_sign(lab);
	lab->serve_tx = sg;
	Player *pt = &lab->partner;
	pt->pos = v3(-1.2f * (float)sg, 0.0f, -(COURT_HALF_LEN + 0.3f));
	pt->vel = v3(0, 0, 0);
	lab->cpu.pos = v3(DBL_READY_X, 0.0f, COURT_HALF_LEN + 0.5f);
	lab->cpu.vel = v3(0, 0, 0);
	lab->cpu2.pos = v3(-DBL_READY_X, 0.0f, COURT_HALF_LEN + 0.5f);
	lab->cpu2.vel = v3(0, 0, 0);
	lab->winner = PT_NONE;
	lab->why = WHY_NONE;
	lab->result = RES_NONE;
	lab->hist_n = 0;
	lab->hist_head = 0;
	lab->arrival_t = 1e9f;
	lab->arrival_idx = -1;
	lab->path_n = 0;
	lab->cpu_planned = false;
	lab->partner_planned = false;

	Vec3 from = v3(pt->pos.x - 0.1f, 2.4f, pt->pos.z + 0.3f);
	bool mistake = cpu_rand_range(&lab->cpu_rng, 0, 1) < lab->pskill.miss_prob * 0.5f;
	Vec3 target = v3((float)sg * cpu_rand_range(&lab->cpu_rng, 0.8f, 3.4f), 0.0f, cpu_rand_range(&lab->cpu_rng, 4.0f, 5.9f));
	if (mistake)
		target.z = SERVE_BOX_Z + 1.5f; /* long: a fault */
	float speed = SERVE_BASE_SPEED * cpu_rand_range(&lab->cpu_rng, 0.75f, 0.95f) * lab->vscale;
	float topspin = 150.0f, el = 0, az = 0;
	bool ok = solve_launch(from, target, speed, topspin, 0.0f, &lab->world, &el, &az);
	for (int i = 0; !ok && i < 4; i++) {
		speed *= 1.1f;
		ok = solve_launch(from, target, speed, topspin, 0.0f, &lab->world, &el, &az);
	}
	float base = SERVE_BASE_SPEED * 0.85f * lab->vscale;
	for (int i = 0; !ok && i < 8; i++) {
		speed = base * powf(0.92f, (float)(i + 1));
		ok = solve_launch(from, target, speed, topspin, 0.0f, &lab->world, &el, &az);
	}
	if (!ok) {
		lab->ball.pos = from;
		serve_fault(lab);
		return;
	}
	Vec3 dir = launch_velocity(1, el, az);
	lab->ball.pos = from;
	lab->ball.vel = launch_velocity(speed, el, az);
	lab->ball.spin = spin_vector(dir, topspin, 0);
	player_plant(pt);
	lab->state = LAB_OUTGOING;
	lab->serve_ball = true;
	lab->hittable = false;
	lab->net_touched = false;
	lab->crossed = false;
	lab->hits++;
	lab->partner_hits++;
	lab->play_t = lab->t;
	cpu_plan(lab);
}

void lab_feed(Lab *lab)
{
	if (lab->tutorial_side == 0 && lab->vs_cpu && lab->human_serves && lab->score.server == 0 && !lab->score.over) {
		if (lab->doubles && lab_server_player(lab) == 1)
			partner_serve(lab);
		else
			start_human_serve(lab);
		return;
	}
	if (lab->remote && !lab->score.over) { /* the other player serves: wait for their ball */
		lab->state = LAB_WAIT;
		lab->timer = 1e9f;
		lab->winner = PT_NONE;
		lab->why = WHY_NONE;
		return;
	}
	Vec3 from = v3(rng_range(lab, -1.0f, 1.0f), 1.0f, COURT_HALF_LEN - 0.5f);
	Vec3 target = v3(rng_range(lab, -2.5f, 2.5f), 0, rng_range(lab, -9.5f, -6.5f));
	if (lab->doubles) { /* the far team serves cross-court, the two of them taking turns and sides */
		int sg = serve_sign(lab);
		lab->cpu_server = lab->serve_rot[1] & 1;
		from.x = 1.2f * (float)sg;
		target.x = -(float)sg * rng_range(lab, 0.8f, 3.4f);
	}
	if (lab->tutorial_side == 1 || lab->tutorial_side == 2) { /* a ball to the forehand (right) or backhand side */
		bool fore = lab->tutorial_side == 1;
		float sign = (fore == lab->player.right_handed) ? -1.0f : 1.0f; /* a right-hander's right is -x */
		target.x = sign * rng_range(lab, 1.2f, 2.6f);
	}
	float speed = rng_range(lab, 18.0f, 26.0f) * lab->vscale;
	float topspin = rng_range(lab, 0.0f, 250.0f);
	float az = atan2f(target.x - from.x, target.z - from.z);

	float lo = -5 * DEG, hi = (lab->vscale > 1.0f ? 55.0f : 20.0f) * DEG;
	for (int i = 0; i < 12; i++) {
		float mid = 0.5f * (lo + hi);
		if (feed_error(from, target, speed, topspin, mid, az, &lab->world) < 0)
			lo = mid;
		else
			hi = mid;
	}
	float el = hi; /* the long side of the bracket clears the net */

	if (lab->vs_cpu) { /* the CPU serves: it stands where the ball comes from */
		Player *sv = lab->doubles && lab->cpu_server ? &lab->cpu2 : &lab->cpu;
		sv->pos.x = from.x;
		sv->pos.z = COURT_HALF_LEN + 0.5f;
		lab->cpu_planned = false;
		sv->vel = v3(0, 0, 0);
		if (lab->doubles) { /* the other one waits on its half */
			Player *ot = sv == &lab->cpu ? &lab->cpu2 : &lab->cpu;
			ot->pos = v3(far_ready_x(lab, ot), 0, COURT_HALF_LEN + 0.5f);
			ot->vel = v3(0, 0, 0);
		}
		lab->winner = PT_NONE;
		lab->why = WHY_NONE;
	}

	Vec3 dir = launch_velocity(1, el, az);
	lab->ball.pos = from;
	lab->ball.vel = launch_velocity(speed, el, az);
	lab->ball.spin = spin_vector(dir, topspin, 0);

	lab->state = LAB_INCOMING;
	lab->play_t = lab->t;
	lab->hittable = true;
	lab->bounced_near = false;
	lab->net_touched = false;
	lab->miss_pending = false;
	lab->crossed = false;
	lab->result = RES_NONE;
	lab->hist_n = 0;
	lab->hist_head = 0;
	lab->feeds++;
	predict_path(lab, -1);
	lab->arrival_idx = -1;
	update_arrival(lab);
	if (lab->doubles)
		choose_near_owner(lab);
}

static void finish(Lab *lab, LabResult r)
{
	lab->result = r;
	if (r == RES_IN)
		lab->ins++;
	lab->state = LAB_RESULT;
	lab->timer = LAB_RESULT_TIME;
}

static void record(Lab *lab)
{
	lab->hist[lab->hist_head] = lab->ball;
	lab->hist_t[lab->hist_head] = lab->t;
	lab->hist_head = (lab->hist_head + 1) % LAB_HISTORY;
	if (lab->hist_n < LAB_HISTORY)
		lab->hist_n++;
}

static void end_point(Lab *lab, PointWinner w, PointWhy why)
{
	lab->winner = w;
	lab->why = why;
	if (!lab->applying_remote) {
		lab->pt_winner = w == PT_HUMAN ? 0 : 1;
		lab->pt_why = why;
		lab->pt_seq++;
	}
	lab->points[w == PT_HUMAN ? 0 : 1]++;
	int srv = lab->score.server;
	if (lab->vs_cpu)
		score_point(&lab->score, w == PT_HUMAN ? 0 : 1);
	if (lab->doubles && lab->score.game_just_won)
		lab->serve_rot[srv ? 1 : 0]++; /* that team's server hands over to its partner next time */
	lab->serve_n = 1;
	lab->serve_ball = false;
	LabResult r = w == PT_HUMAN ? RES_IN
				     : (why == WHY_OUT ? RES_OUT : why == WHY_NET ? RES_NET : RES_MISS);
	finish(lab, r);
}

static void begin_human_turn(Lab *lab)
{
	lab->state = LAB_INCOMING;
	lab->hittable = true;
	lab->bounced_near = false;
	lab->net_touched = false;
	lab->miss_pending = false;
	lab->crossed = false;
	lab->hist_n = 0;
	lab->hist_head = 0;
	lab->play_t = lab->t;
	lab->result = RES_NONE;
	lab->cpu_planned = false;
	predict_path(lab, -1);
	lab->arrival_idx = -1;
	update_arrival(lab);
	if (lab->doubles)
		choose_near_owner(lab);
}

/* The CPU reads the human's shot as soon as it is struck (after its reaction
 * time it starts running) and picks when it will swing. */
static void cpu_plan(Lab *lab)
{
	if (lab->remote)
		return; /* the other player decides when to swing */
	predict_path(lab, +1);
	lab->arrival_idx = -1;
	if (lab->doubles) /* the one nearer where it will land takes it */
		lab->cpu_hitter = fabsf(path_land_x(lab) - lab->cpu2.pos.x) < fabsf(path_land_x(lab) - lab->cpu.pos.x) ? 1 : 0;
	arrival_for(lab, far_hitter(lab), lab->skill.run_speed, lab->skill.react, 0.0f);
	lab->cpu_swung = false;
	lab->cpu_planned = true;
	lab->cpu_react_until = lab->t + lab->skill.react;
	lab->cpu_swing_t = lab->arrival_t +
			   cpu_rand_range(&lab->cpu_rng, -lab->skill.timing_err, lab->skill.timing_err);
}

static void begin_cpu_turn(Lab *lab)
{
	lab->state = LAB_CPU_TURN;
}

/* The CPU's aim assist: mirror the court through the net post line (a half
 * turn about the vertical axis) so the ball heads +z like the human's does. */
static void cpu_aim_ball(Lab *lab, Ball *ball)
{
	Ball m = *ball;
	m.pos.x = -m.pos.x;
	m.pos.z = -m.pos.z;
	m.vel.x = -m.vel.x;
	m.vel.z = -m.vel.z;
	m.spin.x = -m.spin.x;
	m.spin.z = -m.spin.z;
	aim_assist(&m, &lab->world);
	ball->vel = v3(-m.vel.x, m.vel.y, -m.vel.z);
	ball->spin = v3(-m.spin.x, m.spin.y, -m.spin.z);
}

static void cpu_aim(Lab *lab)
{
	cpu_aim_ball(lab, &lab->ball);
}

/* Would this CPU shot (ball just struck) clear the net and land in? Looked at from the CPU's side. */
static bool cpu_shot_ok(Lab *lab, Ball b)
{
	b.pos.x = -b.pos.x; b.pos.z = -b.pos.z;
	b.vel.x = -b.vel.x; b.vel.z = -b.vel.z;
	b.spin.x = -b.spin.x; b.spin.z = -b.spin.z;
	Trace t = flight_trace(b, &lab->world, 4.0f);
	return aim_shot_ok(&t);
}

static void cpu_hit(Lab *lab)
{
	lab->cpu_swung = true;
	Ball *b = &lab->ball;
	Player *hitter = far_hitter(lab);
	if (player_reach(hitter, b->pos) == REACH_NONE)
		return; /* too late or too far: the ball goes by */
	bool mistake;
	StrokeParams sp = cpu_choose_stroke(&lab->skill, &lab->cpu_rng, b->pos.x, b->pos.y, &mistake);
	Ball start = *b;
	for (int k = 0;; k++) {
		*b = start;
		RacketContact rc = stroke_contact(hitter, &sp, 0);
		racket_hit(b, &rc);
		b->vel = v3_scale(b->vel, lab->vscale);
		if (!mistake)
			cpu_aim(lab);
		/* a good CPU swings softer when its first try would not land in */
		if (mistake || k >= lab->skill.retries || cpu_shot_ok(lab, *b))
			break;
		sp.speed *= 0.88f;
	}
	player_plant(hitter);
	lab->cpu_planned = false;
	lab->cpu_hits++;
	if (hitter == &lab->cpu2)
		lab->cpu2_hits++;
	begin_human_turn(lab);
}

/* The CPU partner returns a ball: like cpu_hit but from the near side (facing +z), so no mirroring.
 * The stroke chooser thinks in the far player's frame, hence the flipped azimuth. */
static void partner_hit(Lab *lab)
{
	lab->partner_swung = true;
	Ball *b = &lab->ball;
	Player *pt = &lab->partner;
	if (player_reach(pt, b->pos) == REACH_NONE)
		return;
	bool mistake;
	StrokeParams sp = cpu_choose_stroke(&lab->pskill, &lab->cpu_rng, b->pos.x, b->pos.y, &mistake);
	sp.azim = -sp.azim;
	Ball start = *b;
	for (int k = 0;; k++) {
		*b = start;
		RacketContact rc = stroke_contact(pt, &sp, 0);
		racket_hit(b, &rc);
		b->vel = v3_scale(b->vel, lab->vscale);
		if (!mistake)
			aim_assist(b, &lab->world);
		Trace tr = flight_trace(*b, &lab->world, 4.0f);
		if (mistake || k >= lab->pskill.retries || aim_shot_ok(&tr))
			break;
		sp.speed *= 0.88f;
	}
	player_plant(pt);
	lab->partner_planned = false;
	lab->partner_hits++;
	lab->hits++;
	lab->state = LAB_OUTGOING;
	lab->hittable = false;
	lab->net_touched = false;
	lab->crossed = false;
	lab->result = RES_NONE;
	lab->play_t = lab->t;
	lab->hist_n = 0;
	cpu_plan(lab);
}

static void cpu_move(Lab *lab, float dt)
{
	if (lab->remote)
		return; /* positioned from outside */
	Player *c = far_hitter(lab);
	float ready_z = COURT_HALF_LEN + 2.0f;
	if (lab->cpu_planned && !lab->cpu_swung && lab->arrival_t < 1e8f) {
		if (lab->t >= lab->cpu_react_until)
			player_steer_to(c, lab->arrival_stand.x, lab->arrival_stand.z, dt, lab->skill.run_speed);
		else
			player_steer_to(c, c->pos.x, c->pos.z, dt, lab->skill.run_speed);
	} else {
		player_steer_to(c, far_ready_x(lab, c), ready_z, dt, lab->skill.run_speed * 0.6f);
	}
	if (lab->doubles) { /* the other one holds its half and keeps out of the way */
		Player *o = c == &lab->cpu ? &lab->cpu2 : &lab->cpu;
		player_steer_to(o, far_ready_x(lab, o), ready_z, dt, lab->skill.run_speed * 0.6f);
		nudge_apart(o, c, dt);
	}
}

/* The partner runs to its own meeting point when it is to play the ball, else holds its half. */
static void partner_move(Lab *lab, float dt)
{
	Player *pt = &lab->partner;
	if (lab->state == LAB_INCOMING && lab->partner_planned && !lab->partner_swung && lab->p_arr_t < 1e8f) {
		if (lab->t >= lab->partner_react_until)
			player_steer_to(pt, lab->p_arr_stand.x, lab->p_arr_stand.z, dt, lab->pskill.run_speed);
		else
			player_steer_to(pt, pt->pos.x, pt->pos.z, dt, lab->pskill.run_speed);
	} else {
		player_steer_to(pt, DBL_READY_X, -(COURT_HALF_LEN + 1.0f), dt, lab->pskill.run_speed * 0.6f);
	}
	nudge_apart(pt, &lab->player, dt);
}

/* Rally rules, one SIM_DT: whose shot is this and where did it go. */
static void advance_vs_cpu(Lab *lab, Vec3 prev, int ev)
{
	Ball *b = &lab->ball;
	switch (lab->state) {
	case LAB_INCOMING: /* a CPU shot (or serve) heading for the human */
		if (ev & SIM_BOUNCE) {
			if (b->pos.z > 0) {
				end_point(lab, PT_HUMAN, WHY_NET); /* never got over the net */
				return;
			}
			if (!lab->bounced_near) {
				if (!in_court(lab, b->pos, -1)) {
					end_point(lab, PT_HUMAN, WHY_OUT);
					return;
				}
				lab->bounced_near = true;
			} else {
				lab->miss_pending = true; /* second bounce */
			}
		}
		{
			/* doubles: the one who is to play it is the one who can miss it */
			const Player *own = partner_owns(lab) ? &lab->partner : &lab->player;
			float arr = partner_owns(lab) ? lab->p_arr_t : lab->arrival_t;
			/* A ball that flew past but has not landed in court yet is not a miss: it may still land out (the hitter's fault). */
			if ((b->pos.z < own->pos.z - 3.0f && lab->bounced_near) || (ev & SIM_REST))
				lab->miss_pending = true;
			if (lab->miss_pending &&
			    (lab->t >= arr + LAB_SWING_GRACE || arr > 1e8f))
				end_point(lab, PT_CPU, WHY_MISS);
		}
		break;
	case LAB_OUTGOING: /* the human's shot heading for the far court */
		if (lab->serve_ball) { /* a serve must land in the opposite service box */
			if (ev & SIM_BOUNCE) {
				lab->serve_ball = false;
				if (b->pos.z > 0 && b->pos.z <= SERVE_BOX_Z && b->pos.x * (float)lab->serve_tx >= -0.05f &&
				    b->pos.x * (float)lab->serve_tx <= COURT_SINGLES_HALF_W)
				{
					begin_cpu_turn(lab);
					lab->out_ball = lab->ball;
					lab->out_age = 0;
					lab->out_bounced = true;
					lab->out_seq++;
				} else
					serve_fault(lab);
			} else if (ev & SIM_REST) {
				serve_fault(lab);
			}
			break;
		}
		if (!lab->crossed && prev.z < 0 && b->pos.z >= 0) {
			float f = -prev.z / (b->pos.z - prev.z);
			float x = prev.x + (b->pos.x - prev.x) * f;
			float y = prev.y + (b->pos.y - prev.y) * f;
			lab->crossed = true;
			lab->last.net_margin = y - BALL_RADIUS - net_height_at(x);
		}
		if (ev & SIM_BOUNCE) {
			if (b->pos.z > 0 && in_court(lab, b->pos, +1))
				begin_cpu_turn(lab);
			else if (b->pos.z > 0)
				end_point(lab, PT_CPU, WHY_OUT);
			else
				end_point(lab, PT_CPU, WHY_NET);
		} else if (ev & SIM_REST) {
			end_point(lab, PT_CPU, WHY_NET);
		}
		break;
	case LAB_CPU_TURN: /* waiting for the CPU to get to the ball */
		if (lab->remote)
			break; /* the other player's Lab rules on their own miss */
		if ((ev & SIM_BOUNCE) && b->pos.z > 0)
			end_point(lab, PT_HUMAN, WHY_MISS); /* second bounce: it never got there */
		else if (b->pos.z > far_hitter(lab)->pos.z + 3.0f || (ev & SIM_REST))
			end_point(lab, PT_HUMAN, WHY_MISS);
		break;
	default:
		break;
	}
}

/* One SIM_DT of ball flight and rally bookkeeping (lab->t not advanced). */
static void advance_ball(Lab *lab)
{
	if (lab->state == LAB_SERVE) { /* the toss: it only has gravity, and falling unhit is a fault */
		sim_step(&lab->ball, &lab->world, SIM_DT);
		if (lab->ball.pos.y < 0.6f && lab->ball.vel.y < 0)
			serve_toss_again(lab); /* the toss was not hit: not a fault, toss again */
		return;
	}
	Vec3 prev = lab->ball.pos;
	int ev = sim_step(&lab->ball, &lab->world, SIM_DT);
	Ball *b = &lab->ball;
	if (ev & (SIM_NET_CORD | SIM_NET_MESH))
		lab->net_touched = true;

	if (lab->vs_cpu) {
		advance_vs_cpu(lab, prev, ev);
		return;
	}

	if (lab->state == LAB_INCOMING) {
		if ((ev & SIM_BOUNCE) && b->pos.z < 0) {
			if (lab->bounced_near)
				lab->miss_pending = true;
			lab->bounced_near = true;
		}
		if (b->pos.z < lab->player.pos.z - 3.0f || (ev & SIM_REST))
			lab->miss_pending = true;
		/* Wait out the grace time so a swing still being recognised can
		 * reach back to the ball. */
		if (lab->miss_pending &&
		    (lab->t >= lab->arrival_t + LAB_SWING_GRACE || lab->arrival_t > 1e8f))
			finish(lab, RES_MISS);
	} else if (lab->state == LAB_OUTGOING) {
		if (!lab->crossed && prev.z < 0 && b->pos.z >= 0) {
			float f = -prev.z / (b->pos.z - prev.z);
			float x = prev.x + (b->pos.x - prev.x) * f;
			float y = prev.y + (b->pos.y - prev.y) * f;
			lab->crossed = true;
			lab->last.net_margin = y - BALL_RADIUS - net_height_at(x);
		}
		if (ev & SIM_BOUNCE) {
			if (b->pos.z > 0)
				finish(lab, court_in_singles(b->pos, +1) ? RES_IN : RES_OUT);
			else
				finish(lab, lab->net_touched ? RES_NET : RES_OUT);
		} else if (ev & SIM_REST) {
			finish(lab, lab->net_touched ? RES_NET : RES_OUT);
		}
	}
}

void lab_step(Lab *lab, float in_right, float in_fwd, float dt)
{
	if (dt > LAB_MAX_DT)
		dt = LAB_MAX_DT;
	if (lab->assist_move && in_right == 0 && in_fwd == 0 && lab->anticipate && lab->state == LAB_WAIT &&
	    lab->t < lab->arrival_t + 0.5f && lab->arrival_t < 1e8f) {
		/* a serve is on its way: slide sideways toward where it is heading, but stay on the baseline,
		 * since where it can be met depth-wise is only known once it has bounced */
		player_steer_to(&lab->player, lab->arrival_stand.x, lab->player.pos.z, dt, HUMAN_RUN_SPEED);
	} else if (lab->assist_move && in_right == 0 && in_fwd == 0 && lab->state == LAB_INCOMING &&
		   lab->arrival_t < 1e8f && !partner_owns(lab)) {
		player_steer_to(&lab->player, lab->arrival_stand.x, lab->arrival_stand.z, dt,
				HUMAN_RUN_SPEED);
		/* the last stretch: close the final gap quickly so the ball is met */
		float ex = lab->arrival_stand.x - lab->player.pos.x, ez = lab->arrival_stand.z - lab->player.pos.z;
		float gap = sqrtf(ex * ex + ez * ez);
		if (lab->t > lab->arrival_t - 0.2f && gap > 0.02f && gap < 1.5f) {
			float step = fminf(gap, 9.0f * dt);
			lab->player.pos.x += ex / gap * step;
			lab->player.pos.z += ez / gap * step;
		}
	} else if (lab->vs_cpu && lab->assist_move && in_right == 0 && in_fwd == 0 && !(lab->doubles && lab->state == LAB_SERVE)) { /* (doubles: a server stays on its side of the centre mark) */
		/* between shots the player drifts back to the ready spot */
		player_steer_to(&lab->player, human_ready_x(lab), -(COURT_HALF_LEN + 0.5f), dt, HUMAN_RUN_SPEED);
	} else {
		player_move(&lab->player, in_right, in_fwd, dt);
	}
	if (lab->vs_cpu)
		cpu_move(lab, dt);
	if (lab->doubles)
		partner_move(lab, dt);
	lab->acc += dt;
	lab->vis_off = v3_scale(lab->vis_off, expf(-dt / 0.06f));

	while (lab->acc >= SIM_DT) {
		lab->acc -= SIM_DT;
		lab->t += SIM_DT;
		if (lab->ghost_on) {
			lab->ghost_t += SIM_DT;
			sim_step(&lab->ghost, &lab->world, SIM_DT);
			if (lab->ghost_t > 4.0f || lab->state == LAB_INCOMING)
				lab->ghost_on = false;
		}
		switch (lab->state) {
		case LAB_WAIT:
			lab->timer -= SIM_DT;
			if (lab->timer <= 0)
				lab_feed(lab);
			break;
		case LAB_RESULT:
			advance_ball(lab);
			lab->timer -= SIM_DT;
			if (lab->vs_cpu && lab->human_serves && lab->score.over)
				break; /* the match is over: stay on the result until a new one starts */
			if (lab->timer <= 0) {
				lab->state = LAB_WAIT;
				lab->timer = LAB_WAIT_TIME;
			}
			break;
		default:
			if (lab->state == LAB_CPU_TURN && !lab->remote && !lab->cpu_swung && lab->t >= lab->cpu_swing_t)
				cpu_hit(lab);
			if (lab->doubles && lab->state == LAB_INCOMING && lab->partner_planned && !lab->partner_swung &&
			    lab->bounced_near && lab->t >= lab->partner_swing_t)
				partner_hit(lab);
			advance_ball(lab);
			record(lab);
			if ((lab->state == LAB_INCOMING || lab->state == LAB_OUTGOING ||
			     lab->state == LAB_CPU_TURN) &&
			    lab->t - lab->play_t > LAB_TIMEOUT) {
				if (lab->vs_cpu)
					end_point(lab, lab->state == LAB_CPU_TURN ? PT_HUMAN : PT_CPU, WHY_MISS);
				else
					finish(lab, lab->state == LAB_INCOMING ? RES_MISS : RES_OUT);
			}
			break;
		}
	}
	if (lab->state == LAB_INCOMING)
		update_arrival(lab);
	else if (lab->vs_cpu && lab->cpu_planned && !lab->cpu_swung)
		arrival_for(lab, far_hitter(lab), lab->skill.run_speed, fmaxf(lab->cpu_react_until - lab->t, 0.0f), 0.0f);
	if (lab->doubles && lab->state == LAB_INCOMING && lab->partner_planned && !lab->partner_swung)
		arrival_calc(lab, &lab->partner, lab->pskill.run_speed, fmaxf(lab->partner_react_until - lab->t, 0.0f), 0.0f,
			     &lab->p_arr_idx, &lab->p_arr_t, &lab->p_arr_pos, &lab->p_arr_stand);
}

static float topspin_rpm(const Ball *b)
{
	Vec3 axis = spin_vector(b->vel, 1, 0);
	return v3_dot(b->spin, axis) * 60.0f / (2 * 3.14159265f);
}

Ball lab_ball_visual(const Lab *lab)
{
	Ball b = lab->ball;
	b.pos = v3_add(b.pos, lab->vis_off);
	return b;
}

bool lab_swing(Lab *lab, const SwingEvent *s)
{
	return lab_swing_params(lab, s, NULL);
}

/* The swing at the tossed ball: it goes to a spot in the opposite service box whatever the swing
 * direction, and the swing's power sets the speed. */
static bool serve_swing(Lab *lab, const SwingEvent *s)
{
	Ball *b = &lab->ball;
	if (b->pos.y < SERVE_HIT_MIN_Y || b->pos.y > SERVE_HIT_MAX_Y)
		return false; /* too early or too late: the swing finds nothing */
	float power = fminf(fmaxf(0.75f + 0.05f * (s->peak - 6.0f), 0.7f), 1.1f);
	float speed = SERVE_BASE_SPEED * power * lab->vscale;
	Vec3 target = v3(rng_range(lab, 0.8f, 3.4f) * (float)lab->serve_tx, 0.0f, rng_range(lab, 4.0f, 5.9f));
	float topspin = 150.0f;
	float el = 0, az = 0;
	Vec3 from = b->pos;
	bool ok = solve_launch(from, target, speed, topspin, 0.0f, &lab->world, &el, &az);
	for (int i = 0; !ok && i < 4; i++) { /* too slow to reach: serve harder */
		speed *= 1.1f;
		ok = solve_launch(from, target, speed, topspin, 0.0f, &lab->world, &el, &az);
	}
	float base = SERVE_BASE_SPEED * power * lab->vscale;
	for (int i = 0; !ok && i < 8; i++) { /* too fast to clear the net and still land in the box: ease off */
		speed = base * powf(0.92f, (float)(i + 1));
		ok = solve_launch(from, target, speed, topspin, 0.0f, &lab->world, &el, &az);
	}
	if (!ok) {
		serve_fault(lab);
		return false;
	}
	Vec3 dir = launch_velocity(1, el, az);
	b->vel = launch_velocity(speed, el, az);
	b->spin = spin_vector(dir, topspin, 0);

	LabHit h;
	memset(&h, 0, sizeof h);
	h.hit = true;
	h.side = REACH_NONE; /* a serve */
	h.t_peak = s->t_peak;
	h.racket_speed = speed;
	h.ball_speed = speed;
	h.net_margin = -1000.0f;
	h.contact_pos = from;
	lab->last = h;

	lab->serve_out = *b;
	lab->serve_seq++;
	lab->state = LAB_OUTGOING;
	lab->serve_ball = true;
	lab->net_touched = false;
	lab->crossed = false;
	lab->result = RES_NONE;
	lab->hits++;
	lab->play_t = lab->t;
	lab->hist_n = 0;
	cpu_plan(lab);
	return true;
}

bool lab_swing_params(Lab *lab, const SwingEvent *s, const StrokeParams *forced)
{
	if (lab->state == LAB_SERVE)
		return serve_swing(lab, s);
	player_plant(&lab->player);
	float err = s->t_peak - lab->arrival_t;

	LabHit h;
	memset(&h, 0, sizeof h);
	h.t_peak = s->t_peak;
	h.timing_err = err;
	h.net_margin = -1000.0f;
	h.side = REACH_NONE;

	int idx = -1;
	if (lab->state == LAB_INCOMING && lab->hittable && (!lab->vs_cpu || lab->bounced_near) &&
	    fabsf(err) <= STROKE_WINDOW * (g_easy_returns ? EASY_WINDOW : 1.0f)) {
		/* History entry closest to the swing peak. */
		float best = SIM_DT;
		for (int i = 0; i < lab->hist_n; i++) {
			float d = fabsf(lab->hist_t[i] - s->t_peak);
			if (d <= best) {
				best = d;
				idx = i;
			}
		}
	}
	if (idx >= 0)
		h.side = player_reach_scaled(&lab->player, lab->hist[idx].pos, g_easy_returns ? EASY_REACH : 1.0f);

	if (idx < 0 || h.side == REACH_NONE) {
		/* Only a swing at an incoming ball replaces the shown record; a
		 * swing while a hit ball flies away must not erase that hit. */
		if (lab->state == LAB_INCOMING) {
			h.hit = false;
			lab->last = h;
			lab->result = RES_WHIFF;
		}
		return false;
	}

	StrokeParams sp = forced ? *forced : stroke_params(s, err, h.side, lab->player.right_handed);
	float swing_path = sp.path;
	float swing_speed = sp.speed; /* what the player swung, for naming the shot (low balls are slowed below) */
	stroke_adapt_height(&sp, lab->hist[idx].pos.y);
	RacketContact c = stroke_contact(&lab->player, &sp, err);
	Vec3 shown = v3_add(lab->ball.pos, lab->vis_off); /* where the ball is drawn now */
	lab->ball = lab->hist[idx];
	h.contact_pos = lab->ball.pos;
	h.contact_vel = lab->ball.vel;
	racket_hit(&lab->ball, &c);
	lab->ball.vel = v3_scale(lab->ball.vel, lab->vscale);
	if (lab->assist_aim) {
		aim_set_strength(g_strong_aim ? STRONG_AIM : 1.0f);
		AimInfo a = aim_assist(&lab->ball, &lab->world);
		aim_set_strength(1.0f); /* the CPU keeps the normal nudge */
		h.aim_elev = a.d_elev;
		h.aim_azim = a.d_azim;
	}

	lab->out_ball = lab->ball;
	lab->out_age = lab->t - lab->hist_t[idx];
	lab->out_bounced = false;
	lab->out_seq++;

	h.hit = true;
	h.face = sp.face;
	h.path = swing_path;
	h.azim = sp.azim;
	h.racket_speed = swing_speed;
	h.ball_speed = v3_len(lab->ball.vel);
	h.spin_rpm = topspin_rpm(&lab->ball);
	lab->last = h;

	lab->state = LAB_OUTGOING;
	lab->hittable = false;
	lab->net_touched = false;
	lab->crossed = false;
	lab->result = RES_NONE;
	lab->hits++;
	lab->play_t = lab->t;

	if (lab->vs_cpu)
		cpu_plan(lab);

	/* Catch up from the contact time to now. */
	int steps = (int)((lab->t - lab->hist_t[idx]) / SIM_DT + 0.5f);
	for (int i = 0; i < steps && lab->state == LAB_OUTGOING; i++)
		advance_ball(lab);
	lab->hist_n = 0;
	lab->vis_off = v3_sub(shown, lab->ball.pos);
	return true;
}

void lab_remote_ball(Lab *lab, Ball b, float age, bool after_bounce)
{
	if (!lab->remote || (lab->state != LAB_OUTGOING && lab->state != LAB_CPU_TURN && lab->state != LAB_WAIT))
		return;
	lab->ghost_on = false;
	lab->anticipate = false;
	mirror_ball(&b);
	for (int i = 0; i < (int)(age / SIM_DT + 0.5f); i++)
		sim_step(&b, &lab->world, SIM_DT);
	lab->ball = b;
	lab->cpu_hits++;
	lab->serve_ball = false;
	lab->state = LAB_INCOMING;
	lab->play_t = lab->t;
	lab->hittable = true;
	lab->bounced_near = after_bounce;
	lab->net_touched = false;
	lab->miss_pending = false;
	lab->crossed = false;
	lab->result = RES_NONE;
	lab->winner = PT_NONE;
	lab->why = WHY_NONE;
	lab->hist_n = 0;
	lab->hist_head = 0;
	lab->vis_off = v3(0, 0, 0);
	predict_path(lab, -1);
	if (after_bounce) /* a serve arrives already bounced: the meeting point is anywhere after now, not after a 2nd bounce */
		lab->path_bounce = 0;
	lab->arrival_idx = -1;
	update_arrival(lab);
}

void lab_remote_serve(Lab *lab, Ball b)
{
	if (!lab->remote)
		return;
	mirror_ball(&b);
	lab->ghost = b;
	lab->ghost_on = true;
	lab->ghost_t = 0;
	/* Don't stand still while the serve flies: aim for where it will be met after its bounce. The ball
	 * only arrives for real at the bounce, which leaves little time to run. */
	if (lab->state == LAB_WAIT) {
		Ball keep = lab->ball;
		lab->ball = b;
		predict_path(lab, -1);
		lab->ball = keep;
		lab->arrival_idx = -1;
		update_arrival(lab);
		lab->anticipate = lab->arrival_t < 1e8f;
	}
}

void lab_remote_point(Lab *lab, int winner, int why)
{
	if (!lab->remote)
		return;
	lab->ghost_on = false;
	lab->anticipate = false;
	if (lab->state != LAB_INCOMING && lab->state != LAB_OUTGOING && lab->state != LAB_CPU_TURN &&
	    lab->state != LAB_SERVE && lab->state != LAB_WAIT)
		return; /* this Lab already ruled on the point */
	if (lab->state == LAB_WAIT && lab->timer < 1e8f)
		return; /* between points */
	lab->applying_remote = true;
	end_point(lab, winner == 1 ? PT_HUMAN : PT_CPU, (PointWhy)why);
	lab->applying_remote = false;
}

void lab_remote_pos(Lab *lab, float x, float z)
{
	lab->cpu.pos.x = -x;
	lab->cpu.pos.z = -z;
}

void lab_remote_score(Lab *lab, const int pts[2], const int games[2], int server, bool over, int winner, const int total[2])
{
	if (!lab->remote)
		return;
	for (int i = 0; i < 2; i++) {
		lab->score.points[i] = pts[i] < 0 ? 0 : pts[i];
		lab->score.games[i] = games[i] < 0 ? 0 : games[i];
		lab->points[i] = total[i] < 0 ? 0 : total[i];
	}
	lab->score.server = server ? 1 : 0;
	lab->score.over = over;
	lab->score.winner = winner ? 1 : 0;
}
