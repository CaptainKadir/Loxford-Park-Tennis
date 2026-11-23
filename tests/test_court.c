#include "test.h"
#include "court.h"
#include "physics.h"

void test_net_profile(void)
{
	CHECK_NEAR(net_height_at(0), 0.914f, 1e-5f);
	CHECK_NEAR(net_height_at(NET_STICK_X), 1.07f, 1e-5f);
	CHECK_NEAR(net_height_at(-6.0f), 1.07f, 1e-5f);
	CHECK(net_height_at(7.0f) == 0);
}

/* Review Focus 4 */
void test_line_edge_inclusive(void)
{
	float edge = COURT_SINGLES_HALF_W + BALL_RADIUS;
	CHECK(court_in_singles(v3(edge, 0, 5), +1));
	CHECK(!court_in_singles(v3(edge + 0.001f, 0, 5), +1));
	CHECK(court_in_singles(v3(0, 0, COURT_HALF_LEN + BALL_RADIUS), +1));
	CHECK(!court_in_singles(v3(0, 0, COURT_HALF_LEN + BALL_RADIUS + 0.001f), +1));
}

void test_service_box(void)
{
	CHECK(court_in_service_box(v3(2, 0, 3), +1, +1));
	CHECK(!court_in_service_box(v3(-2, 0, 3), +1, +1));   /* wrong half */
	CHECK(!court_in_service_box(v3(2, 0, 6.5f), +1, +1)); /* long */
	CHECK(court_in_service_box(v3(-1, 0, -3), -1, -1));
	CHECK(!court_in_singles(v3(0, 0, 3), -1)); /* wrong side */
}

/* Review fix 3: the centre service line (5 cm wide, centred on x = 0) is
 * part of both boxes; a ball touching its far edge is in. */
void test_centre_service_line_is_in(void)
{
	float edge = -(LINE_W / 2) - BALL_RADIUS;
	CHECK(court_in_service_box(v3(-0.05f, 0, 3), +1, +1));
	CHECK(court_in_service_box(v3(edge, 0, 3), +1, +1));
	CHECK(!court_in_service_box(v3(edge - 0.001f, 0, 3), +1, +1));
	CHECK(court_in_service_box(v3(0.05f, 0, 3), +1, -1));
}
