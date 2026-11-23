#include "test.h"
#include "pose.h"

static void step(Pose *p, Player *pl, int n, float dt)
{
	for (int i = 0; i < n; i++)
		pose_update(p, pl, dt);
}

void test_pose_rest_is_neutral(void)
{
	Pose p;
	Player pl;
	player_init(&pl, 1, true);
	pose_init(&p);
	step(&p, &pl, 100, 1.0f / 60);
	CHECK(p.run_phase == 0.0f);
	CHECK(fabsf(p.bob) < 1e-4f);
	CHECK(p.lean < 0.01f);
	CHECK_NEAR(p.arm_angle, 0.2f, 0.01f);
}

void test_pose_run_phase_follows_speed(void)
{
	Pose fast, slow;
	Player pl;
	player_init(&pl, 1, true);
	pose_init(&fast);
	pose_init(&slow);
	pl.vel = v3(5, 0, 0);
	step(&fast, &pl, 60, 1.0f / 60);
	pl.vel = v3(2, 0, 0);
	step(&slow, &pl, 60, 1.0f / 60);
	CHECK(fast.run_phase > slow.run_phase || fast.run_phase < slow.run_phase); /* wrapped: both moved */
	CHECK(isfinite(fast.run_phase) && isfinite(slow.run_phase));
	pl.vel = v3(6, 0, 0);
	Pose top;
	pose_init(&top);
	step(&top, &pl, 120, 1.0f / 60);
	CHECK(top.lean <= 0.35f + 1e-4f && top.lean > 0.2f);
	/* faster running advances the phase faster over one short step */
	Pose a, b;
	pose_init(&a);
	pose_init(&b);
	pl.vel = v3(5, 0, 0);
	pose_update(&a, &pl, 0.05f);
	pl.vel = v3(2, 0, 0);
	pose_update(&b, &pl, 0.05f);
	CHECK(a.run_phase > b.run_phase);
}

void test_pose_swing_sweeps_forward(void)
{
	Pose p;
	Player pl;
	player_init(&pl, 1, true);
	pose_init(&p);
	pose_update(&p, &pl, 1.0f / 60);
	pose_start_swing(&p);
	float prev = -10, at01 = 0, at09 = 0;
	int mono = 1;
	for (int i = 0; i < 60 * 0.4f + 5; i++) {
		pose_update(&p, &pl, 1.0f / 60);
		if (p.swing_t > 0 && p.swing_t <= 1) {
			if (p.arm_angle < prev - 1e-4f)
				mono = 0;
			prev = p.arm_angle;
			if (p.swing_t <= 0.1f)
				at01 = p.arm_angle;
			if (p.swing_t <= 0.9f)
				at09 = p.arm_angle;
		}
	}
	CHECK(mono);
	CHECK(at01 <= -0.5f);
	CHECK(at09 >= 1.2f);
	CHECK(p.swing_t == 0.0f);
}

void test_pose_left_hand_mirrors(void)
{
	Pose r, l;
	Player pr, pl;
	player_init(&pr, 1, true);
	player_init(&pl, 1, false);
	pose_init(&r);
	pose_init(&l);
	pose_update(&r, &pr, 1.0f / 60);
	pose_update(&l, &pl, 1.0f / 60);
	CHECK(r.arm_side == 1.0f);
	CHECK(l.arm_side == -1.0f);
}

void test_pose_long_dt_is_stable(void)
{
	Pose p;
	Player pl;
	player_init(&pl, 1, true);
	pose_init(&p);
	pl.vel = v3(0, 0, 6);
	pose_start_swing(&p);
	pose_update(&p, &pl, 0.1f);
	CHECK(isfinite(p.run_phase) && isfinite(p.lean) && isfinite(p.bob));
	CHECK(isfinite(p.arm_angle) && isfinite(p.swing_t));
	CHECK(p.lean >= 0 && p.lean <= 0.35f + 1e-4f);
	CHECK(fabsf(p.bob) <= 0.05f + 1e-4f);
	CHECK(p.arm_angle >= -1.2f - 1e-3f && p.arm_angle <= 1.6f + 1e-3f);
}
