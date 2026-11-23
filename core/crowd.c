#include <math.h>

#include "court.h"
#include "crowd.h"

static const uint32_t SHIRTS[8] = {0xf2c230ffu, 0xe4572eff, 0x2e86abff, 0x76b041ff,
				   0xa23b72ff, 0xf5f5f5ff, 0xff8fa3ff, 0x3d5a80ff};
static const uint32_t HAIRS[5] = {0x2b1d14ffu, 0x5a3825ff, 0xc9a24dff, 0x9c9c9cff, 0x8a2f1eff};

static uint32_t rnd(uint32_t *s)
{
	uint32_t x = *s;
	x ^= x << 13;
	x ^= x >> 17;
	x ^= x << 5;
	return *s = x;
}

static float rf(uint32_t *s)
{
	return (float)(rnd(s) >> 8) / 16777216.0f;
}

static void seat(Crowd *c, uint32_t *s, float x, float y, float z)
{
	if (c->n >= CROWD_MAX || rf(s) < 0.1f)
		return; /* an empty seat */
	CrowdMember *m = &c->m[c->n++];
	m->pos = v3(x + (rf(s) - 0.5f) * 0.1f, y, z + (rf(s) - 0.5f) * 0.1f);
	m->shirt = SHIRTS[rnd(s) % 8];
	m->hair = HAIRS[rnd(s) % 5];
	m->phase = rf(s) * 6.2831853f;
}

void crowd_init(Crowd *c, uint32_t seed)
{
	uint32_t s = seed ? seed : 0x1234567u;
	c->n = 0;
	c->cheer = 0;
	/* two long side stands: 4 rows rising 0.5 m each */
	for (int side = -1; side <= 1; side += 2)
		for (int r = 0; r < 4; r++)
			for (float z = -11.0f; z <= 11.0f; z += 1.2f)
				seat(c, &s, (float)side * (COURT_DOUBLES_HALF_W + 4.0f + 1.0f * (float)r),
				     0.5f * (float)(r + 1), z);
	/* end stand behind the far baseline: 3 rows */
	for (int r = 0; r < 3; r++)
		for (float x = -9.0f; x <= 9.0f; x += 1.2f)
			seat(c, &s, x, 0.5f * (float)(r + 1), COURT_HALF_LEN + 3.6f + 1.0f * (float)r);
}

void crowd_cheer(Crowd *c, float amount)
{
	c->cheer = fminf(1.0f, c->cheer + amount);
}

void crowd_update(Crowd *c, float dt)
{
	c->cheer = fmaxf(0.0f, c->cheer - 0.5f * dt);
}

float crowd_head_y(const Crowd *c, int i, float t)
{
	const CrowdMember *m = &c->m[i];
	return m->pos.y + 0.55f + 0.12f * c->cheer * fabsf(sinf(7.0f * t + m->phase));
}
