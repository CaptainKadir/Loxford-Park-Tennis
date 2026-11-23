#include "solver.h"
#include "court.h"

#define DEG (3.14159265f / 180.0f)
#define SOLVE_TOL 0.05f
#define MAX_TIME 5.0f

Vec3 launch_velocity(float speed, float elev, float azim)
{
	float c = cosf(elev);
	return v3(speed * c * sinf(azim), speed * sinf(elev), speed * c * cosf(azim));
}

Trace flight_trace(Ball b, const World *w, float max_time)
{
	Trace t = {false, -1000.0f, false, b.pos, 0};
	float side = b.pos.z < 0 ? -1.0f : 1.0f;
	for (float time = 0; time < max_time; time += SIM_DT) {
		Vec3 prev = b.pos;
		int ev = sim_step(&b, w, SIM_DT);
		t.flight_time = time + SIM_DT;
		if (ev & (SIM_NET_CORD | SIM_NET_MESH))
			t.hit_net = true;
		if (!t.crossed_net && prev.z * side > 0 && b.pos.z * side <= 0) {
			float f = prev.z / (prev.z - b.pos.z);
			float x = prev.x + (b.pos.x - prev.x) * f;
			float y = prev.y + (b.pos.y - prev.y) * f;
			t.crossed_net = true;
			t.net_margin = y - BALL_RADIUS - net_height_at(x);
		}
		if (ev & SIM_BOUNCE) {
			/* contact point: undo the post-bounce part of the step */
			float rest = b.vel.y > 0 ? (b.pos.y - BALL_RADIUS) / b.vel.y : 0;
			t.first_bounce = v3(b.pos.x - b.vel.x * rest, BALL_RADIUS,
					    b.pos.z - b.vel.z * rest);
			return t;
		}
	}
	t.first_bounce = b.pos;
	return t;
}

/* Landing error for one launch: along = how far past the target (signed),
 * across = sideways miss (positive toward increasing azimuth). */
static void landing_error(Vec3 from, Vec3 target, float speed, Vec3 spin_tb, float el,
			  float az, const World *w, float *along, float *across)
{
	Vec3 dir = launch_velocity(1, el, az);
	Ball b = {from, launch_velocity(speed, el, az), spin_vector(dir, spin_tb.x, spin_tb.y)};
	Trace t = flight_trace(b, w, MAX_TIME);
	Vec3 d = v3(dir.x, 0, dir.z);
	d = v3_norm(d);
	Vec3 perp = v3(d.z, 0, -d.x);
	Vec3 miss = v3_sub(t.first_bounce, target);
	miss.y = 0;
	/* Any net contact counts as short, so the search never settles on a
	 * cord-dribble that happens to land on the target, and the along error
	 * stays monotone across the net. */
	*along = t.hit_net ? -1000.0f : v3_dot(miss, d);
	*across = v3_dot(miss, perp);
}

bool solve_launch(Vec3 from, Vec3 target, float speed, float topspin, float sidespin,
		  const World *w, float *elev_out, float *azim_out)
{
	Vec3 spin = v3(topspin, sidespin, 0);
	float dx = target.x - from.x, dz = target.z - from.z;
	float dist = sqrtf(dx * dx + dz * dz);
	if (dist < 1e-3f)
		return false;
	float az = atan2f(dx, dz);
	float el = 0;

	for (int outer = 0; outer < 8; outer++) {
		/* Lowest elevation where the ball goes from short to long. */
		float lo = -15 * DEG, along_lo, across;
		landing_error(from, target, speed, spin, lo, az, w, &along_lo, &across);
		float hi = lo, along_hi = along_lo;
		bool found = false;
		for (float e = lo + 0.5f * DEG; e <= 45 * DEG + 1e-4f; e += 0.5f * DEG) {
			float a;
			landing_error(from, target, speed, spin, e, az, w, &a, &across);
			if (along_hi < 0 && a >= 0) {
				lo = e - 0.5f * DEG;
				hi = e;
				found = true;
				break;
			}
			along_hi = a;
		}
		if (!found)
			return false;
		for (int i = 0; i < 30; i++) {
			float mid = 0.5f * (lo + hi), a;
			landing_error(from, target, speed, spin, mid, az, w, &a, &across);
			if (a < 0)
				lo = mid;
			else
				hi = mid;
		}
		el = 0.5f * (lo + hi);

		float along;
		landing_error(from, target, speed, spin, el, az, w, &along, &across);
		if (fabsf(along) < SOLVE_TOL && fabsf(across) < SOLVE_TOL) {
			*elev_out = el;
			*azim_out = az;
			return true;
		}
		az -= across / dist;
	}
	return false;
}
