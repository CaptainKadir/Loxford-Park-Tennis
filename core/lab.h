/* Swing Lab: a ball machine feeds the near-side player, who moves and
 * swings. A swing is recognised after its peak, so hits are applied
 * retroactively from a short ball history and then re-simulated. */
#ifndef LOXFORD_LAB_H
#define LOXFORD_LAB_H

#include <stdbool.h>
#include <stdint.h>

#include "aim.h"
#include "cpu.h"
#include "player.h"
#include "score.h"
#include "sim.h"
#include "stroke.h"
#include "swing.h"

#define LAB_HISTORY 168       /* 0.7 s of SIM_DT steps */
#define LAB_PATH 960          /* 4 s predicted incoming path */
#define LAB_WAIT_TIME 1.5f
#define LAB_RESULT_TIME 1.0f
#define LAB_MAX_DT 0.1f       /* longest frame simulated; excess dropped */
#define LAB_TIMEOUT 6.0f      /* s a ball may stay in play */
#define LAB_SWING_GRACE 0.35f /* s after arrival before a miss is called: a
			       * swing is recognised only once its
			       * follow-through slows down */

typedef enum { LAB_WAIT, LAB_INCOMING, LAB_OUTGOING, LAB_RESULT, LAB_CPU_TURN, LAB_SERVE } LabState;

/* Rally mode (vs CPU): who won the point and why. */
typedef enum { PT_NONE, PT_HUMAN, PT_CPU } PointWinner;
typedef enum { WHY_NONE, WHY_OUT, WHY_NET, WHY_MISS, WHY_DOUBLE_BOUNCE, WHY_FAULT } PointWhy;
typedef enum { RES_NONE, RES_IN, RES_OUT, RES_NET, RES_MISS, RES_WHIFF } LabResult;

typedef struct {
	float t_peak, timing_err; /* s; negative = early */
	float racket_speed;       /* m/s */
	float ball_speed;         /* m/s just after contact */
	float spin_rpm;           /* + topspin, - backspin */
	float net_margin;         /* m over the net, -1000 until it crosses */
	Reach side;
	bool hit;
	float face, path, azim;   /* stroke parameters used (rad, ratio, rad) */
	Vec3 contact_pos;         /* ball centre at contact */
	Vec3 contact_vel;         /* incoming ball velocity at contact */
	float aim_elev, aim_azim; /* aim assist nudge applied, rad */
} LabHit;

typedef struct {
	Ball ball;
	Player player;
	World world;
	float vscale; /* hit and serve speed multiplier: 1 real, ARCADE_VSCALE arcade */
	LabState state;
	float t;            /* lab clock, s (advances in SIM_DT steps) */
	float acc;          /* unsimulated time */
	float timer;        /* WAIT / RESULT countdown */
	float play_t;       /* time the current ball entered play */
	uint32_t rng;

	Ball hist[LAB_HISTORY];
	float hist_t[LAB_HISTORY];
	int hist_n, hist_head;

	Vec3 path[LAB_PATH]; /* predicted incoming ball centre, one per SIM_DT */
	int path_n;
	float path_t0;
	int path_bounce;     /* index of the first near-side bounce, -1 if none */

	bool hittable;
	bool bounced_near;
	bool net_touched;
	bool miss_pending;
	bool crossed;
	float arrival_t;
	Vec3 arrival_pos;
	Vec3 vis_off; /* drawn-ball offset left by a retroactive hit; eases to zero */
	Vec3 arrival_stand;  /* where the player should stand to meet the ball there */
	int arrival_idx;     /* chosen path index (kept to avoid flip-flopping) */
	LabResult result;
	LabHit last;
	int feeds, hits, ins;
	bool assist_move;   /* player drifts toward the ball when the D-pad is idle */
	bool want_backhand; /* phone is turned to the backhand side: auto-run stands for a backhand */
	bool assist_aim;    /* "Assisted": launch direction nudged toward an in shot */

	/* Rally mode: a CPU opponent on the far side (facing -z). */
	bool vs_cpu;
	Player cpu;
	CpuSkill skill;
	uint32_t cpu_rng;
	int points[2];       /* [0] human, [1] CPU: rally points won in all */
	Score score;         /* tennis score: points, games, set, server */
	bool human_serves;   /* the human serves in the games they are the server in (the game build); off = the CPU always feeds */
	int serve_n;         /* 1 first serve, 2 second serve of the human's service point */
	bool serve_ball;     /* the ball in flight is the human's serve and must land in the box */
	PointWinner winner;
	PointWhy why;
	float cpu_react_until, cpu_swing_t;
	bool cpu_swung;
	bool cpu_planned;    /* it has read the human's shot and is on its way */
	int cpu_hits;

	/* Two-player link: the "CPU" is the other human, simulated in another Lab. This Lab sends its
	 * shots and point results out through the out_* / pt_* fields (JS carries them across, mirrored)
	 * and takes the other player's in through lab_remote_ball / lab_remote_point. */
	bool remote;
	int out_seq;      /* counts shots handed to the other player */
	Ball out_ball;    /* the shot, as this Lab sees it (not yet mirrored) */
	float out_age;    /* seconds the ball has flown since contact */
	bool out_bounced; /* a serve is sent when it lands, so it has already bounced */
	int pt_seq;       /* counts point results */
	int pt_winner;    /* 0 = this player won, 1 = the other */
	int pt_why;
	bool applying_remote;
	int serve_seq;    /* counts serves launched (the other Lab shows the flight before the bounce hands over) */
	Ball serve_out;   /* the serve at contact, not yet mirrored */
	bool anticipate;  /* two-player receiver: running to where the other player's serve will be met, before it arrives for real */
	bool ghost_on;    /* the other player's serve, drawn only: it flies here until it bounces and arrives for real */
	Ball ghost;
	float ghost_t;

	/* Tutorial: 0 off. 1 the CPU feeds balls to the player's forehand side, 2 to the backhand side, 3 random
	 * feeds with no serving by the human. */
	int tutorial_side;

	/* Doubles (2 vs 2): off by default, and then none of the fields below is touched, so singles play is
	 * exactly what it was. The near team is the human (player) and a CPU partner; the far team is cpu and
	 * cpu2. See docs/notes/doubles-design.md. */
	bool doubles;
	Player partner, cpu2;
	CpuSkill pskill;      /* the partner's skill */
	int near_owner;       /* 0 human, 1 partner: who is to return the ball now heading for the near side */
	int cpu_hitter;       /* 0 cpu, 1 cpu2: who is to return the ball now heading for the far side */
	int serve_rot[2];     /* service games each team has played: the server is serve_rot[team] & 1 */
	int serve_tx;         /* sign of x of the box a near-side serve lands in (+1 in singles) */
	int cpu_server;       /* 0 cpu, 1 cpu2: the far player serving this game */
	int partner_hits, cpu2_hits; /* subsets of hits / cpu_hits made by the partner / cpu2 */
	bool partner_planned, partner_swung;
	float partner_react_until, partner_swing_t;
	int p_arr_idx;        /* the partner's own meeting point (the human's is arrival_*) */
	float p_arr_t;
	Vec3 p_arr_pos, p_arr_stand;
} Lab;

void lab_init(Lab *lab, uint32_t seed, bool right_handed);

/* Rally against a CPU: it serves, returns, and every point has a winner. */
/* Real tennis physics (default) or the arcade feel: heavy gravity, exponential
 * drag and faster shots. Call right after lab_init / lab_start_rally. */
#define ARCADE_VSCALE 1.85f
void lab_set_arcade(Lab *lab, bool arcade);
/* Easy returns (the Assist setting): a wider timing window and a longer reach for the human player. Global, so it survives a new rally. */
void lab_set_easy_returns(bool on);
/* A stronger aim assist for the human's shots (a wider nudge toward the court). */
void lab_set_strong_aim(bool on);

void lab_start_rally(Lab *lab, uint32_t seed, bool right_handed, int cpu_level);
/* Two players, one Lab each. first_server: 0 this player serves first, 1 the other. */
void lab_start_remote(Lab *lab, uint32_t seed, bool right_handed, int first_server);
/* The other player's shot arrives (in their coordinates; mirrored here). */
void lab_remote_ball(Lab *lab, Ball b, float age, bool after_bounce);
/* The other Lab ended the point: winner 0 = they won, 1 = we won (their view mirrored by the caller). */
void lab_remote_point(Lab *lab, int winner, int why);
/* The other player's serve just left the racket: show its flight (visual only). */
void lab_remote_serve(Lab *lab, Ball b);
void lab_remote_pos(Lab *lab, float x, float z);
/* Adopt the other side's score (already mirrored to this side: [0] is this player). Used by the guest of an online match so a crossed ruling can never leave the two scores apart. */
void lab_remote_score(Lab *lab, const int pts[2], const int games[2], int server, bool over, int winner, const int total[2]);
/* Doubles: you and a CPU partner against two CPUs. partner_level / cpu_level are CPU_* levels. */
void lab_start_doubles(Lab *lab, uint32_t seed, bool right_handed, int cpu_level, int partner_level);
/* Who serves now, as the index within its team (0 = player / cpu, 1 = partner / cpu2). */
int lab_server_player(const Lab *lab);
void lab_feed(Lab *lab);
void lab_step(Lab *lab, float in_right, float in_fwd, float dt);
bool lab_swing(Lab *lab, const SwingEvent *s);
/* Same, but with the stroke measured elsewhere (forced != NULL): used to show example returns. */
bool lab_swing_params(Lab *lab, const SwingEvent *s, const StrokeParams *forced);

/* The ball as it should be drawn: the true ball plus the easing offset that
 * hides the jump when a late-recognised swing moves it. */
Ball lab_ball_visual(const Lab *lab);

#endif
