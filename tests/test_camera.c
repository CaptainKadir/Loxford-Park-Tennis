#include "test.h"
#include "camera.h"
#include "court.h"

static Player human(float x, float z)
{
	Player p;
	player_init(&p, 1, true);
	p.pos.x = x;
	p.pos.z = z;
	return p;
}

void test_camera_settles_behind_player(void)
{
	Player p = human(1.0f, -12.0f);
	Camera c;
	camera_init(&c, &p);
	for (int i = 0; i < 180; i++)
		camera_update(&c, &p, NULL, 1.0f / 60);
	CHECK_NEAR(c.eye.x, 0.6f, 0.05f);
	CHECK_NEAR(c.eye.y, 6.0f, 0.05f);
	CHECK_NEAR(c.eye.z, -12.0f - 8.5f, 0.05f);
	CHECK(c.target.z >= p.pos.z + 8.0f);
}

void test_camera_follows_sideways_smoothly(void)
{
	Player p = human(0, -12.0f);
	Camera c;
	camera_init(&c, &p);
	for (int i = 0; i < 120; i++)
		camera_update(&c, &p, NULL, 1.0f / 60);
	float worst = 0;
	for (int i = 0; i < 60; i++) {
		p.pos.x = 4.0f * (float)(i + 1) / 60.0f;
		float before = c.eye.x;
		camera_update(&c, &p, NULL, 1.0f / 60);
		worst = fmaxf(worst, fabsf(c.eye.x - before));
	}
	CHECK(worst <= 0.12f);
	CHECK(fabsf(c.eye.x - 0.6f * 4.0f) <= 0.9f);
	for (int i = 0; i < 240; i++)
		camera_update(&c, &p, NULL, 1.0f / 60);
	CHECK_NEAR(c.eye.x, 2.4f, 0.1f);
}

void test_camera_ball_pulls_target_downcourt(void)
{
	Player p = human(0, -12.0f);
	Camera a, b;
	camera_init(&a, &p);
	camera_init(&b, &p);
	Vec3 ball = v3(0, 1, 8);
	for (int i = 0; i < 240; i++) {
		camera_update(&a, &p, NULL, 1.0f / 60);
		camera_update(&b, &p, &ball, 1.0f / 60);
	}
	CHECK(b.target.z > a.target.z);
	CHECK(b.target.z <= p.pos.z + 16.0f + 1e-3f);
}

void test_camera_teleport_is_bounded(void)
{
	Player p = human(0, -12.0f);
	Camera c;
	camera_init(&c, &p);
	for (int i = 0; i < 120; i++)
		camera_update(&c, &p, NULL, 1.0f / 60);
	Vec3 e0 = c.eye;
	Vec3 ball = v3(50, 30, 50);
	camera_update(&c, &p, &ball, 1.0f / 60);
	Vec3 d = v3_sub(c.eye, e0);
	CHECK(v3_len(d) < 0.2f);
	CHECK(c.fov >= 40.0f && c.fov <= 60.0f);
}

void test_camera_long_dt_is_stable(void)
{
	Player p = human(3, -12.0f);
	Camera c;
	camera_init(&c, &p);
	Vec3 ball = v3(0, 2, 0);
	camera_update(&c, &p, &ball, 0.1f);
	camera_update(&c, &p, &ball, 0.1f);
	CHECK(isfinite(c.eye.x) && isfinite(c.eye.y) && isfinite(c.eye.z));
	CHECK(isfinite(c.target.x) && isfinite(c.target.y) && isfinite(c.target.z));
	CHECK(isfinite(c.fov));
}
