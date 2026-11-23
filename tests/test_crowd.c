#include "test.h"
#include "court.h"
#include "crowd.h"

void test_crowd_deterministic_and_filled(void)
{
	Crowd a, b;
	crowd_init(&a, 7);
	crowd_init(&b, 7);
	CHECK(a.n >= 150 && a.n <= CROWD_MAX);
	CHECK(a.n == b.n);
	int same = 1;
	for (int i = 0; i < a.n; i++)
		if (a.m[i].pos.x != b.m[i].pos.x || a.m[i].pos.z != b.m[i].pos.z ||
		    a.m[i].shirt != b.m[i].shirt)
			same = 0;
	CHECK(same);
}

void test_crowd_stays_in_the_stands(void)
{
	Crowd c;
	crowd_init(&c, 3);
	int bad = 0, close = 0;
	for (int i = 0; i < c.n; i++) {
		Vec3 p = c.m[i].pos;
		bool side = fabsf(p.x) >= COURT_DOUBLES_HALF_W + 3.5f;
		bool end = p.z >= COURT_HALF_LEN + 3.5f;
		if (!(side || end) || p.y < 0 || p.y > 3.0f || fabsf(p.x) > 14.0f || p.z > 30.0f)
			bad++;
		for (int j = i + 1; j < c.n; j++) {
			float dx = p.x - c.m[j].pos.x, dy = p.y - c.m[j].pos.y, dz = p.z - c.m[j].pos.z;
			if (sqrtf(dx * dx + dy * dy + dz * dz) < 0.4f)
				close++;
		}
	}
	CHECK(bad == 0);
	CHECK(close == 0);
}

static float mean_head(const Crowd *c, float t0, float t1)
{
	double sum = 0;
	int n = 0;
	for (float t = t0; t < t1; t += 0.05f)
		for (int i = 0; i < c->n; i++, n++)
			sum += crowd_head_y(c, i, t);
	return (float)(sum / n);
}

void test_cheer_raises_and_decays(void)
{
	Crowd c;
	crowd_init(&c, 5);
	float calm = mean_head(&c, 0, 1);
	crowd_cheer(&c, 1.0f);
	crowd_cheer(&c, 1.0f);
	CHECK(c.cheer <= 1.0f);
	float excited = mean_head(&c, 0, 1);
	CHECK(excited - calm >= 0.05f);
	for (int i = 0; i < 240; i++)
		crowd_update(&c, 1.0f / 60);
	CHECK(fabsf(mean_head(&c, 0, 1) - calm) < 0.01f);
}
