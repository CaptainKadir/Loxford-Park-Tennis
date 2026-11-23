#include "test.h"
#include "player.h"

void test_player_reaches_top_speed_smoothly(void)
{
	Player p;
	player_init(&p, +1, true);
	for (int i = 0; i < 12; i++)
		player_move(&p, 1, 0, 1.0f / 60); /* 0.2 s */
	float s1 = v3_len(p.vel);
	for (int i = 0; i < 12; i++)
		player_move(&p, 1, 0, 1.0f / 60); /* 0.4 s */
	CHECK(s1 > 2 && s1 < PLAYER_MAX_SPEED);
	CHECK_NEAR(v3_len(p.vel), PLAYER_MAX_SPEED, 0.01f);
	CHECK(p.vel.x < 0); /* right = -x facing +z */
}

void test_player_stops_within_0_2s(void)
{
	Player p;
	player_init(&p, +1, true);
	p.vel = v3(PLAYER_MAX_SPEED, 0, 0);
	for (int i = 0; i < 12; i++)
		player_move(&p, 0, 0, 1.0f / 60);
	CHECK(v3_len(p.vel) < 0.01f);
}

void test_diagonal_not_faster(void)
{
	Player p;
	player_init(&p, +1, true);
	for (int i = 0; i < 60; i++)
		player_move(&p, 1, 1, 1.0f / 60);
	CHECK(v3_len(p.vel) <= PLAYER_MAX_SPEED + 1e-4f);
}

void test_player_stays_on_own_side(void)
{
	Player p;
	player_init(&p, +1, true);
	for (int i = 0; i < 600; i++)
		player_move(&p, 0, 1, 1.0f / 60);
	CHECK(p.pos.z <= -0.5f + 1e-4f);
}

void test_reach_forehand_backhand(void)
{
	Player p;
	player_init(&p, +1, true);
	p.pos = v3(0, 0, -11);
	CHECK(player_reach(&p, v3(-0.8f, 1.0f, -10.5f)) == REACH_FOREHAND); /* right of a +z-facing player */
	CHECK(player_reach(&p, v3(0.8f, 1.0f, -10.5f)) == REACH_BACKHAND);
	CHECK(player_reach(&p, v3(-2.4f, 1.0f, -10.5f)) == REACH_NONE);
	CHECK(player_reach(&p, v3(-0.8f, 3.4f, -10.5f)) == REACH_NONE);
	Player l;
	player_init(&l, +1, false);
	l.pos = p.pos;
	CHECK(player_reach(&l, v3(-0.8f, 1.0f, -10.5f)) == REACH_BACKHAND);
}

void test_plant_slows_player(void)
{
	Player p;
	player_init(&p, +1, true);
	player_plant(&p);
	for (int i = 0; i < 12; i++)
		player_move(&p, 1, 0, 1.0f / 60);
	CHECK(v3_len(p.vel) <= PLAYER_MAX_SPEED * PLAYER_PLANT_FACTOR + 1e-3f);
}

void test_assist_widens_the_reach(void)
{
	Player p;
	player_init(&p, +1, true);
	p.pos = v3(0, 0, 0);
	Vec3 far_side = v3(-2.6f, 1.0f, 0.5f); /* right = -x facing +z: beyond the normal 2.1 m */
	CHECK(player_reach(&p, far_side) == REACH_NONE);
	CHECK(player_reach_scaled(&p, far_side, 1.4f) == REACH_FOREHAND);
	Vec3 near_ball = v3(-1.0f, 1.0f, 0.5f);
	CHECK(player_reach(&p, near_ball) == player_reach_scaled(&p, near_ball, 1.0f));
	CHECK(player_reach_scaled(&p, v3(-6.0f, 1.0f, 0.5f), 1.4f) == REACH_NONE); /* still not everywhere */
}
