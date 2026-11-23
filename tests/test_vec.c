#include "test.h"

void test_vec_cross_right_handed(void)
{
	Vec3 c = v3_cross(v3(1, 0, 0), v3(0, 1, 0));
	CHECK_NEAR(c.x, 0, 1e-6f);
	CHECK_NEAR(c.y, 0, 1e-6f);
	CHECK_NEAR(c.z, 1, 1e-6f);
}

void test_vec_norm_zero_safe(void)
{
	Vec3 n = v3_norm(v3(0, 0, 0));
	CHECK(n.x == 0 && n.y == 0 && n.z == 0);
}

void test_vec_len(void)
{
	CHECK_NEAR(v3_len(v3(3, 4, 12)), 13, 1e-5f);
}
