/* Flat C API over the portable core, exported to JavaScript through WASM.
 * State is read through oc_state(): a fixed float array, layout below. Keep
 * STATE_NAMES in web/game/core.js in the same order. */
#include <emscripten.h>
#include <string.h>

#include "camera.h"
#include "lab.h"
#include "phone.h"
#include "shot.h"
#include "stroke.h"

enum {
	S_BALL_X, S_BALL_Y, S_BALL_Z, S_BALL_VX, S_BALL_VY, S_BALL_VZ,
	S_PLAYER_X, S_PLAYER_Y, S_PLAYER_Z, S_PLAYER_VX, S_PLAYER_VZ,
	S_CPU_X, S_CPU_Z,
	S_POINTS_HUMAN, S_POINTS_CPU,
	S_LAB_STATE, S_WINNER, S_WHY,
	S_HITS, S_HIT_SPEED, S_HIT_SPIN, S_HIT_FACE, S_HIT_PATH, S_HIT_SIDE, S_HIT_SHOT,
	S_CPU_HITS,
	S_CAM_EX, S_CAM_EY, S_CAM_EZ, S_CAM_TX, S_CAM_TY, S_CAM_TZ, S_CAM_FOV,
	S_RACKET_W, S_RACKET_X, S_RACKET_Y, S_RACKET_Z,
	S_LAB_T,
	S_SW_N, S_SW_SPEED, S_SW_FACE_F, S_SW_FACE_B, S_SW_PATH,
	S_ARRIVAL_T,
	S_PTS_H, S_PTS_C, S_GAMES_H, S_GAMES_C, S_SERVER, S_MATCH_OVER, S_MATCH_WINNER, S_SERVE_N,
	S_OUT_SEQ, S_OUT_X, S_OUT_Y, S_OUT_Z, S_OUT_VX, S_OUT_VY, S_OUT_VZ, S_OUT_SX, S_OUT_SY, S_OUT_SZ,
	S_OUT_AGE, S_OUT_BOUNCED, S_PT_SEQ, S_PT_WINNER, S_PT_WHY,
	S_SERVE_SEQ, S_SX, S_SY, S_SZ, S_SVX, S_SVY, S_SVZ, S_SSX, S_SSY, S_SSZ,
	S_GHOST, S_GX, S_GY, S_GZ,
	S_WAITSERVE,
	S_DOUBLES, S_PARTNER_X, S_PARTNER_Z, S_CPU2_X, S_CPU2_Z, S_PARTNER_HITS, S_CPU2_HITS,
	S_NEAR_OWNER, S_FAR_HITTER, S_SERVER_PLAYER,
	S_COUNT
};

#define DOUBLES_FOV_EXTRA 6.0f /* degrees wider so the alleys fit */

static Lab lab;
static PhoneInput phone;
static Camera cam;
static float st[S_COUNT];
/* Trainer mode: any swing returns the ball exactly like the example (forced stroke); the swing's
 * own measurements are still reported in the state. */
static bool forced_on;
static StrokeParams forced_sp;
static bool forced_pending; /* swing came early: hit when the ball arrives */
static float sw[5]; /* last recognised swing: count, speed, forehand face, backhand face, path */

EMSCRIPTEN_KEEPALIVE void oc_set_match_games(int n) { score_set_games_to_win(n); } /* 0 = the normal length */

EMSCRIPTEN_KEEPALIVE void oc_init(unsigned seed, int right_handed, int arcade, int cpu_level)
{
	lab_start_rally(&lab, seed, right_handed != 0, cpu_level);
	lab_set_arcade(&lab, arcade != 0);
	lab.human_serves = true; /* the web game has serves and tennis scoring */
	phone_init(&phone);
	forced_pending = false;
	sw[0] = 0;
	camera_init(&cam, &lab.player);
}

/* Doubles: you and a CPU partner against two CPUs (see lab_start_doubles). */
EMSCRIPTEN_KEEPALIVE void oc_init_doubles(unsigned seed, int right_handed, int arcade, int cpu_level, int partner_level)
{
	lab_start_doubles(&lab, seed, right_handed != 0, cpu_level, partner_level);
	lab_set_arcade(&lab, arcade != 0);
	lab.human_serves = true;
	phone_init(&phone);
	forced_pending = false;
	sw[0] = 0;
	camera_init(&cam, &lab.player);
}

/* Two-player link (see lab_start_remote). */
EMSCRIPTEN_KEEPALIVE void oc_init_remote(unsigned seed, int right_handed, int arcade, int first_server)
{
	lab_start_remote(&lab, seed, right_handed != 0, first_server);
	lab_set_arcade(&lab, arcade != 0);
	lab.human_serves = true;
	phone_init(&phone);
	forced_pending = false;
	sw[0] = 0;
	camera_init(&cam, &lab.player);
}

EMSCRIPTEN_KEEPALIVE void oc_remote_ball(float x, float y, float z, float vx, float vy, float vz,
					 float sx, float sy, float sz, float age, int bounced)
{
	Ball b = lab.ball;
	b.pos = v3(x, y, z); b.vel = v3(vx, vy, vz); b.spin = v3(sx, sy, sz);
	lab_remote_ball(&lab, b, age, bounced != 0);
}

EMSCRIPTEN_KEEPALIVE void oc_set_tutorial(int side) { lab.tutorial_side = side; }

EMSCRIPTEN_KEEPALIVE void oc_remote_serve(float x, float y, float z, float vx, float vy, float vz, float sx, float sy, float sz)
{
	Ball b;
	memset(&b, 0, sizeof b);
	b.pos = v3(x, y, z); b.vel = v3(vx, vy, vz); b.spin = v3(sx, sy, sz);
	lab_remote_serve(&lab, b);
}
EMSCRIPTEN_KEEPALIVE void oc_remote_point(int winner, int why) { lab_remote_point(&lab, winner, why); }
EMSCRIPTEN_KEEPALIVE void oc_remote_pos(float x, float z) { lab_remote_pos(&lab, x, z); }
EMSCRIPTEN_KEEPALIVE void oc_remote_score(int pts0, int pts1, int g0, int g1, int server, int over, int winner, int t0, int t1)
{
	int pts[2] = {pts0, pts1}, games[2] = {g0, g1}, total[2] = {t0, t1};
	lab_remote_score(&lab, pts, games, server, over != 0, winner, total);
}

EMSCRIPTEN_KEEPALIVE void oc_step(float dt, float in_right, float in_fwd)
{
	lab_step(&lab, in_right, in_fwd, dt);
	if (forced_pending) {
		if (lab.state != LAB_INCOMING)
			forced_pending = false;
		else if (lab.t >= lab.arrival_t) {
			SwingEvent ev;
			memset(&ev, 0, sizeof ev);
			ev.t_peak = lab.arrival_t;
			ev.used_gyro = true;
			lab_swing_params(&lab, &ev, &forced_sp);
			forced_pending = false;
		}
	}
	Ball b = lab_ball_visual(&lab);
	bool in_play = lab.state == LAB_INCOMING || lab.state == LAB_OUTGOING ||
		       lab.state == LAB_CPU_TURN;
	if (lab.doubles) { /* frame the pair: follow the team's middle */
		Player mid = lab.player;
		mid.pos.x = 0.5f * (lab.player.pos.x + lab.partner.pos.x);
		camera_update(&cam, &mid, in_play ? &b.pos : NULL, dt);
	} else {
		camera_update(&cam, &lab.player, in_play ? &b.pos : NULL, dt);
	}
}

/* q: phone orientation in court frame R; rates rad/s; acc in g. Returns 1 when
 * a swing completed in this sample. */
EMSCRIPTEN_KEEPALIVE int oc_phone_sample(float t, float qw, float qx, float qy, float qz,
					 float rx, float ry, float rz, float ax, float ay, float az)
{
	Quat q = {qw, qx, qy, qz};
	/* Phone turned to the backhand side (left for a right-hander): stand for a backhand. */
	if (!forced_on) {
		float h = quat_heading(quat_normalize(q)); /* CCW from above = toward the left */
		if (!lab.player.right_handed)
			h = -h;
		if (h > 0.45f)
			lab.want_backhand = true;
		else if (h < 0.25f)
			lab.want_backhand = false;
	}
	SwingEvent ev;
	if (!phone_feed(&phone, t, q, v3(rx, ry, rz), v3(ax, ay, az), &ev))
		return 0;
	{
		StrokeParams f = stroke_params(&ev, 0.0f, REACH_FOREHAND, lab.player.right_handed);
		StrokeParams b = stroke_params(&ev, 0.0f, REACH_BACKHAND, lab.player.right_handed);
		sw[0] += 1.0f; sw[1] = f.speed; sw[2] = f.face; sw[3] = b.face; sw[4] = f.path;
	}
	if (forced_on) {
		/* Any swing while a ball is coming returns it like the example: early swings wait for the
		 * ball, late ones count as on time. */
		if (lab.state == LAB_INCOMING && lab.arrival_t < 1e8f) {
			float early = lab.arrival_t - lab.t;
			if (early <= 0.0f && early > -0.4f) {
				ev.t_peak = lab.arrival_t;
				lab_swing_params(&lab, &ev, &forced_sp);
			} else if (early > 0.0f && early < 0.6f) {
				forced_pending = true;
			}
		}
		return 1;
	}
	lab_swing(&lab, &ev);
	return 1;
}

/* Basic: every hit is a plain forehand or backhand. Off: topspin, slice, drop shot and lob are named too. */
EMSCRIPTEN_KEEPALIVE void oc_set_basic_shots(int basic) { shot_set_basic(basic != 0); }

/* Assist: easier returns (wider timing window and reach). */
EMSCRIPTEN_KEEPALIVE void oc_set_easy_returns(int on) { lab_set_easy_returns(on != 0); }
EMSCRIPTEN_KEEPALIVE void oc_set_strong_aim(int on) { lab_set_strong_aim(on != 0); }

/* Replace the shot-naming thresholds (see ShotTuning in core/shot.h). */
EMSCRIPTEN_KEEPALIVE void oc_set_shot_tuning(float slow, float fast, float open, float closed, float lob)
{
	ShotTuning t = {slow, fast, open, closed, lob};
	shot_set_tuning(&t);
}

EMSCRIPTEN_KEEPALIVE int oc_classify_shot(float speed, float face, float path)
{
	return (int)shot_classify_values(speed, face, path);
}

/* Example returns for the trainer: stand for a backhand (or not), then make the swing happen
 * now with exactly these stroke parameters. Returns 1 if the ball was hit. */
/* Trainer: return every ball like this example whatever the swing was (on = 0 turns it off). */
EMSCRIPTEN_KEEPALIVE void oc_force_stroke(int on, float speed, float face, float path)
{
	forced_on = on != 0;
	forced_pending = false;
	forced_sp = (StrokeParams){speed, 0.0f, face, path};
}

EMSCRIPTEN_KEEPALIVE void oc_demo_prepare(int backhand) { lab.want_backhand = backhand != 0; }

EMSCRIPTEN_KEEPALIVE int oc_demo_swing(float speed, float face, float path)
{
	SwingEvent ev;
	memset(&ev, 0, sizeof ev);
	ev.t_peak = lab.t;
	ev.t_end = lab.t;
	ev.used_gyro = true;
	StrokeParams sp = {speed, 0.0f, face, path};
	return lab_swing_params(&lab, &ev, &sp) ? 1 : 0;
}

/* Forget the phone's clock and any half-seen swing (new controller, reload). */
EMSCRIPTEN_KEEPALIVE void oc_phone_reset(void) { phone_init(&phone); }

EMSCRIPTEN_KEEPALIVE int oc_state_len(void) { return S_COUNT; }

EMSCRIPTEN_KEEPALIVE const float *oc_state(void)
{
	Ball b = lab_ball_visual(&lab);
	st[S_BALL_X] = b.pos.x; st[S_BALL_Y] = b.pos.y; st[S_BALL_Z] = b.pos.z;
	st[S_BALL_VX] = b.vel.x; st[S_BALL_VY] = b.vel.y; st[S_BALL_VZ] = b.vel.z;
	st[S_PLAYER_X] = lab.player.pos.x; st[S_PLAYER_Y] = lab.player.pos.y;
	st[S_PLAYER_Z] = lab.player.pos.z;
	st[S_PLAYER_VX] = lab.player.vel.x; st[S_PLAYER_VZ] = lab.player.vel.z;
	st[S_CPU_X] = lab.cpu.pos.x; st[S_CPU_Z] = lab.cpu.pos.z;
	st[S_POINTS_HUMAN] = (float)lab.points[0]; st[S_POINTS_CPU] = (float)lab.points[1];
	st[S_LAB_STATE] = (float)lab.state; st[S_WINNER] = (float)lab.winner;
	st[S_WHY] = (float)lab.why;
	st[S_HITS] = (float)lab.hits;
	st[S_HIT_SPEED] = lab.last.racket_speed; st[S_HIT_SPIN] = lab.last.spin_rpm;
	st[S_HIT_FACE] = lab.last.face; st[S_HIT_PATH] = lab.last.path;
	st[S_HIT_SIDE] = (float)lab.last.side;
	st[S_HIT_SHOT] = (float)shot_classify(&lab.last);
	st[S_CPU_HITS] = (float)lab.cpu_hits;
	st[S_CAM_EX] = cam.eye.x; st[S_CAM_EY] = cam.eye.y; st[S_CAM_EZ] = cam.eye.z;
	st[S_CAM_TX] = cam.target.x; st[S_CAM_TY] = cam.target.y; st[S_CAM_TZ] = cam.target.z;
	st[S_CAM_FOV] = cam.fov + (lab.doubles ? DOUBLES_FOV_EXTRA : 0.0f);
	Quat r = phone_racket_quat(&phone);
	st[S_RACKET_W] = r.w; st[S_RACKET_X] = r.x; st[S_RACKET_Y] = r.y; st[S_RACKET_Z] = r.z;
	st[S_LAB_T] = lab.t;
	for (int i = 0; i < 5; i++) st[S_SW_N + i] = sw[i];
	st[S_ARRIVAL_T] = lab.arrival_t;
	st[S_PTS_H] = (float)lab.score.points[0]; st[S_PTS_C] = (float)lab.score.points[1];
	st[S_GAMES_H] = (float)lab.score.games[0]; st[S_GAMES_C] = (float)lab.score.games[1];
	st[S_SERVER] = (float)lab.score.server;
	st[S_MATCH_OVER] = lab.score.over ? 1.0f : 0.0f; st[S_MATCH_WINNER] = (float)lab.score.winner;
	st[S_SERVE_N] = (float)lab.serve_n;
	st[S_OUT_SEQ] = (float)lab.out_seq;
	st[S_OUT_X] = lab.out_ball.pos.x; st[S_OUT_Y] = lab.out_ball.pos.y; st[S_OUT_Z] = lab.out_ball.pos.z;
	st[S_OUT_VX] = lab.out_ball.vel.x; st[S_OUT_VY] = lab.out_ball.vel.y; st[S_OUT_VZ] = lab.out_ball.vel.z;
	st[S_OUT_SX] = lab.out_ball.spin.x; st[S_OUT_SY] = lab.out_ball.spin.y; st[S_OUT_SZ] = lab.out_ball.spin.z;
	st[S_OUT_AGE] = lab.out_age; st[S_OUT_BOUNCED] = lab.out_bounced ? 1.0f : 0.0f;
	st[S_PT_SEQ] = (float)lab.pt_seq; st[S_PT_WINNER] = (float)lab.pt_winner; st[S_PT_WHY] = (float)lab.pt_why;
	st[S_SERVE_SEQ] = (float)lab.serve_seq;
	st[S_SX] = lab.serve_out.pos.x; st[S_SY] = lab.serve_out.pos.y; st[S_SZ] = lab.serve_out.pos.z;
	st[S_SVX] = lab.serve_out.vel.x; st[S_SVY] = lab.serve_out.vel.y; st[S_SVZ] = lab.serve_out.vel.z;
	st[S_SSX] = lab.serve_out.spin.x; st[S_SSY] = lab.serve_out.spin.y; st[S_SSZ] = lab.serve_out.spin.z;
	st[S_GHOST] = lab.ghost_on ? 1.0f : 0.0f;
	st[S_WAITSERVE] = (lab.remote && lab.state == LAB_WAIT && lab.timer > 1e8f) ? 1.0f : 0.0f; /* waiting for the other player's serve */
	st[S_DOUBLES] = lab.doubles ? 1.0f : 0.0f;
	st[S_PARTNER_X] = lab.partner.pos.x; st[S_PARTNER_Z] = lab.partner.pos.z;
	st[S_CPU2_X] = lab.cpu2.pos.x; st[S_CPU2_Z] = lab.cpu2.pos.z;
	st[S_PARTNER_HITS] = (float)lab.partner_hits; st[S_CPU2_HITS] = (float)lab.cpu2_hits;
	st[S_NEAR_OWNER] = (float)lab.near_owner; st[S_FAR_HITTER] = (float)lab.cpu_hitter;
	st[S_SERVER_PLAYER] = (float)lab_server_player(&lab);
	st[S_GX] = lab.ghost.pos.x; st[S_GY] = lab.ghost.pos.y; st[S_GZ] = lab.ghost.pos.z;
	return st;
}
