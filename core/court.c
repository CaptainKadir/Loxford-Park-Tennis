#include "court.h"
#include "physics.h"

float net_height_at(float x)
{
	float ax = fabsf(x);
	if (ax <= NET_STICK_X)
		return NET_H_CENTRE + (NET_H_POST - NET_H_CENTRE) * ax / NET_STICK_X;
	if (ax <= NET_POST_X)
		return NET_H_POST;
	return 0.0f;
}

static bool within(float v, float lo, float hi)
{
	return v >= lo && v <= hi;
}

bool court_in_singles(Vec3 p, int z_sign)
{
	return fabsf(p.x) <= COURT_SINGLES_HALF_W + BALL_RADIUS &&
	       within(p.z * (float)z_sign, -BALL_RADIUS, COURT_HALF_LEN + BALL_RADIUS);
}

bool court_in_doubles(Vec3 p, int z_sign)
{
	return fabsf(p.x) <= COURT_DOUBLES_HALF_W + BALL_RADIUS &&
	       within(p.z * (float)z_sign, -BALL_RADIUS, COURT_HALF_LEN + BALL_RADIUS);
}

bool court_in_service_box(Vec3 p, int z_sign, int x_sign)
{
	return within(p.z * (float)z_sign, -BALL_RADIUS, COURT_SERVICE_Z + BALL_RADIUS) &&
	       /* the centre service line is centred on x = 0, so its far edge is
	        * half a line width past it, on the other box's side */
	       within(p.x * (float)x_sign, -(LINE_W / 2) - BALL_RADIUS,
		      COURT_SINGLES_HALF_W + BALL_RADIUS);
}
