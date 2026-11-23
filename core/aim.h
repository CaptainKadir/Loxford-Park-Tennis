/* Aim assist ("Assisted" mode, spec 7.3): at the moment of contact the launch
 * direction is nudged, by a bounded amount, toward a shot that clears the net
 * and lands in. Speed and spin magnitude are never changed and the flight
 * afterwards is pure physics. "Pro" mode simply does not call this. */
#ifndef LOXFORD_AIM_H
#define LOXFORD_AIM_H

#include <stdbool.h>

#include "sim.h"
#include "solver.h"

#define AIM_MAX_ELEV (10.0f * 3.14159265f / 180.0f) /* rad; wider (16-22 deg) was swept and lost in-court rate on hard swings */
#define AIM_MAX_AZIM (30.0f * 3.14159265f / 180.0f) /* rad */
#define AIM_NET_CLEAR 0.10f                         /* m over the tape */
#define AIM_LINE_SAFETY 0.05f                       /* m inside the lines */

typedef struct {
	bool changed;
	float d_elev; /* rad, + = more upward */
	float d_azim; /* rad, + = toward +x */
} AimInfo;

/* A shot the assist is happy with: over the net with margin, first bounce
 * inside the far singles court with a little room to spare. */
bool aim_shot_ok(const Trace *t);

/* Scales the limits above (1 = normal, more = a wider nudge, so more shots stay in). */
void aim_set_strength(float k);

/* Nudge b (just after contact, heading down-court) if it would not be ok. */
AimInfo aim_assist(Ball *b, const World *w);

#endif
