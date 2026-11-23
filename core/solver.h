/* Flight analysis and launch solving through the real physics.
 * Used by the CPU player, aim assist and the accuracy tests. */
#ifndef LOXFORD_SOLVER_H
#define LOXFORD_SOLVER_H

#include <stdbool.h>

#include "sim.h"

/* Velocity for speed (m/s), elevation up from horizontal and azimuth from
 * +z toward +x (radians). */
Vec3 launch_velocity(float speed, float elev, float azim);

typedef struct {
	bool crossed_net;   /* reached the other side of z = 0 */
	float net_margin;   /* ball bottom minus net height at the crossing, m */
	bool hit_net;       /* touched cord or mesh */
	Vec3 first_bounce;  /* ball centre at the first bounce */
	float flight_time;  /* s, until the first bounce (or max_time) */
} Trace;

/* Simulate b until its first bounce or max_time. */
Trace flight_trace(Ball b, const World *w, float max_time);

/* Lowest elevation (and matching azimuth) whose first bounce lands at
 * target within 5 cm, for a fixed speed and spin. Returns false and leaves
 * the outputs untouched if the target is unreachable. */
bool solve_launch(Vec3 from, Vec3 target, float speed, float topspin, float sidespin,
		  const World *w, float *elev_out, float *azim_out);

#endif
