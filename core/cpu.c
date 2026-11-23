#include "cpu.h"
#include "court.h"

CpuSkill cpu_skill(int level)
{
	static const CpuSkill table[CPU_LEVELS] = {
		{10, 14, 0.14f, 0.060f, 0.22f, 4.0f, 0.45f, 0}, /* easy */
		{11, 16, 0.08f, 0.035f, 0.08f, 5.5f, 0.25f, 0}, /* medium */
		{12, 16, 0.01f, 0.004f, 0.01f, 9.0f, 0.02f, 8}, /* hard: fast, accurate, almost never errs */
		{13, 17, 0.004f, 0.002f, 0.003f, 10.0f, 0.0f, 12}, /* boss: faster still, near-perfect */
	};
	if (level < 0)
		level = 0;
	if (level >= CPU_LEVELS)
		level = CPU_LEVELS - 1;
	return table[level];
}

uint32_t cpu_rand(uint32_t *state)
{
	uint32_t x = *state ? *state : 0x9e3779b9u;
	x ^= x << 13;
	x ^= x >> 17;
	x ^= x << 5;
	*state = x;
	return x;
}

float cpu_rand_range(uint32_t *state, float lo, float hi)
{
	return lo + (hi - lo) * (float)(cpu_rand(state) >> 8) / 16777216.0f;
}

StrokeParams cpu_choose_stroke(const CpuSkill *k, uint32_t *rng, float ball_x, float contact_y,
			       bool *mistake)
{
	const float lim = COURT_SINGLES_HALF_W - 1.0f;
	float tx;
	if (cpu_rand_range(rng, 0, 1) < 0.7f) /* usually across the court */
		tx = ball_x > 0 ? cpu_rand_range(rng, -lim, 0) : cpu_rand_range(rng, 0, lim);
	else
		tx = cpu_rand_range(rng, -lim, lim);

	StrokeParams sp;
	float err = 0.5f * (cpu_rand_range(rng, -1, 1) + cpu_rand_range(rng, -1, 1)) * k->aim_err;
	sp.azim = atan2f(tx - ball_x, 22.0f) + err;
	sp.speed = cpu_rand_range(rng, k->speed_lo, k->speed_hi);
	sp.face = 0;
	sp.path = 0.35f + 0.025f * (sp.speed - 10.0f);
	stroke_adapt_height(&sp, contact_y);

	*mistake = cpu_rand_range(rng, 0, 1) < k->miss_prob;
	if (*mistake) {
		if (cpu_rand_range(rng, 0, 1) < 0.5f) {
			sp.speed *= 1.8f; /* flat and fast: long */
		} else {
			sp.speed *= 0.4f; /* soft and flat: into the net */
		}
		sp.path = 0;
	}
	if (sp.azim > 0.6f)
		sp.azim = 0.6f;
	if (sp.azim < -0.6f)
		sp.azim = -0.6f;
	return sp;
}
