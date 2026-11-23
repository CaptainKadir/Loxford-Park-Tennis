#include "player.h"
#include "court.h"

void player_init(Player *p, int facing, bool right_handed)
{
	p->facing = facing >= 0 ? 1 : -1;
	p->pos = v3(0, 0, -(float)p->facing * (COURT_HALF_LEN + 0.5f));
	p->vel = v3(0, 0, 0);
	p->right_handed = right_handed;
	p->plant = 0;
}

Vec3 player_fwd(const Player *p)
{
	return v3(0, 0, (float)p->facing);
}

Vec3 player_right(const Player *p)
{
	return v3(-(float)p->facing, 0, 0);
}

static Vec3 approach(Vec3 v, Vec3 target, float max_dv)
{
	Vec3 d = v3_sub(target, v);
	float l = v3_len(d);
	if (l <= max_dv)
		return target;
	return v3_add(v, v3_scale(d, max_dv / l));
}

void player_move(Player *p, float in_right, float in_fwd, float dt)
{
	Vec3 dir = v3_add(v3_scale(player_right(p), in_right), v3_scale(player_fwd(p), in_fwd));
	dir = v3_norm(dir);
	float top = PLAYER_MAX_SPEED * (p->plant > 0 ? PLAYER_PLANT_FACTOR : 1.0f);

	if (v3_len(dir) > 0)
		p->vel = approach(p->vel, v3_scale(dir, top), PLAYER_ACCEL * dt);
	else
		p->vel = approach(p->vel, v3(0, 0, 0), PLAYER_DECEL * dt);

	p->pos = v3_add(p->pos, v3_scale(p->vel, dt));

	/* Stay on the own half and near the court. */
	float zf = p->pos.z * (float)p->facing;
	float zmin = -COURT_HALF_LEN - 4.0f, zmax = -0.5f;
	if (zf < zmin || zf > zmax) {
		zf = fminf(fmaxf(zf, zmin), zmax);
		p->pos.z = zf * (float)p->facing;
		p->vel.z = 0;
	}
	float xmax = COURT_DOUBLES_HALF_W + 2.5f;
	if (fabsf(p->pos.x) > xmax) {
		p->pos.x = p->pos.x > 0 ? xmax : -xmax;
		p->vel.x = 0;
	}

	if (p->plant > 0)
		p->plant = fmaxf(p->plant - dt, 0);
}

void player_steer_to(Player *p, float x, float z, float dt, float max_speed)
{
	float ex = x - p->pos.x, ez = z - p->pos.z;
	Vec3 want = v3(fminf(fmaxf(ex * 8.0f, -max_speed), max_speed), 0,
		       fminf(fmaxf(ez * 8.0f, -max_speed), max_speed));
	bool arrived = fabsf(ex) < 0.03f && fabsf(ez) < 0.03f;
	if (fabsf(ex) < 0.03f)
		want.x = 0;
	if (fabsf(ez) < 0.03f)
		want.z = 0;
	p->vel = approach(p->vel, want, (arrived || v3_len(want) == 0 ? PLAYER_DECEL : PLAYER_ACCEL) * dt);
	p->pos = v3_add(p->pos, v3_scale(p->vel, dt));
	if (p->plant > 0)
		p->plant = fmaxf(p->plant - dt, 0);
}

void player_steer_x(Player *p, float target_x, float dt)
{
	player_steer_to(p, target_x, p->pos.z, dt, PLAYER_MAX_SPEED * 0.9f);
}

void player_plant(Player *p)
{
	p->plant = PLAYER_PLANT_TIME;
}

Reach player_reach(const Player *p, Vec3 ball) { return player_reach_scaled(p, ball, 1.0f); }

/* k > 1 stretches the reach (Assist): a bigger box around the player in every direction. */
Reach player_reach_scaled(const Player *p, Vec3 ball, float k)
{
	Vec3 d = v3_sub(ball, p->pos);
	float lat = v3_dot(d, player_right(p));
	float fwd = v3_dot(d, player_fwd(p));
	float al = fabsf(lat);
	if (al < REACH_LAT_MIN || al > REACH_LAT_MAX * k)
		return REACH_NONE;
	if (fwd < REACH_FWD_MIN * k || fwd > REACH_FWD_MAX * k)
		return REACH_NONE;
	if (ball.y < REACH_Y_MIN / k || ball.y > REACH_Y_MAX * k)
		return REACH_NONE;
	bool right_side = lat > 0;
	return right_side == p->right_handed ? REACH_FOREHAND : REACH_BACKHAND;
}
