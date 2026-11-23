#include "test.h"
#include "court.h"
#include "cpu.h"
#include "player.h"

void test_skill_levels_differ(void)
{
	CpuSkill e = cpu_skill(CPU_EASY), m = cpu_skill(CPU_MEDIUM), h = cpu_skill(CPU_HARD);
	CHECK(h.aim_err < m.aim_err && m.aim_err < e.aim_err);
	CHECK(h.timing_err < m.timing_err && m.timing_err < e.timing_err);
	CHECK(h.miss_prob < m.miss_prob && m.miss_prob < e.miss_prob);
	CHECK(h.run_speed > m.run_speed && m.run_speed > e.run_speed);
	CHECK(h.react < m.react && m.react < e.react);
	CHECK(h.run_speed <= 1.5f * PLAYER_MAX_SPEED && e.run_speed > 0); /* Hard may outrun a human a little */
}

void test_cpu_rand_deterministic_and_spread(void)
{
	uint32_t a = 7, b = 7;
	for (int i = 0; i < 20; i++)
		CHECK(cpu_rand(&a) == cpu_rand(&b));
	uint32_t s = 12345;
	double sum = 0;
	for (int i = 0; i < 1000; i++) {
		float v = cpu_rand_range(&s, 0, 1);
		CHECK(v >= 0 && v <= 1);
		sum += v;
	}
	CHECK_NEAR(sum / 1000, 0.5, 0.05);
}

void test_choose_stroke_in_ranges(void)
{
	for (int level = 0; level < CPU_LEVELS; level++) {
		CpuSkill k = cpu_skill(level);
		uint32_t rng = 99 + (uint32_t)level;
		int mistakes = 0;
		for (int i = 0; i < 1000; i++) {
			bool mistake;
			StrokeParams sp = cpu_choose_stroke(&k, &rng, (float)(i % 7) - 3.0f, 1.2f, &mistake); /* 1.2 m: no low-ball lift */
			CHECK(sp.speed >= 0 && sp.speed <= k.speed_hi * 1.8f + 1e-3f);
			CHECK(fabsf(sp.azim) <= 0.6f);
			if (mistake)
				mistakes++;
			else
				CHECK(sp.speed >= k.speed_lo - 1e-3f && sp.speed <= k.speed_hi + 1e-3f);
		}
		CHECK_NEAR(mistakes / 1000.0, k.miss_prob, 0.05);
	}
}

void test_choose_stroke_aims_across_the_court(void)
{
	CpuSkill k = cpu_skill(CPU_HARD);
	uint32_t rng = 5;
	int toward_middle = 0, n = 400;
	for (int i = 0; i < n; i++) {
		bool mistake;
		StrokeParams sp = cpu_choose_stroke(&k, &rng, 3.0f, 1.0f, &mistake); /* ball on the +x side */
		if (sp.azim < 0.02f)
			toward_middle++; /* target left of the ball: azimuth toward -x */
	}
	CHECK(toward_middle > n / 2);
}
