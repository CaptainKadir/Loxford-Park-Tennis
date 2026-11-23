/* Gyro orientation filter: gyro integration, automatic zero
 * calibration when still, tilt correction toward gravity. Spec 7.4.
 *
 * q rotates remote-frame vectors into reference frame R, whose axes match
 * the remote lying flat, buttons up, pointing at the TV:
 * R.x = right, R.y = toward the TV, R.z = up. */
#ifndef LOXFORD_ORIENT_H
#define LOXFORD_ORIENT_H

#include <stdbool.h>

#include "motion.h"

#define MP_ZERO_DEFAULT 8063.0f
#define MP_UNITS_PER_DEG 13.768f            /* slow mode, raw units per deg/s */
#define MP_FAST_FACTOR (2000.0f / 440.0f)   /* fast mode is this much coarser */
#define MP_RAW_MAX 16383.0f

typedef struct {
	float w, x, y, z;
} Quat;

Quat quat_identity(void);
Quat quat_mul(Quat a, Quat b);
Quat quat_normalize(Quat q);
Vec3 quat_rotate(Quat q, Vec3 v);

/* Rotation of q about R.z (heading), radians in (-pi, pi]. q and -q give
 * the same result. */
float quat_heading(Quat q);

typedef struct {
	Quat q;
	Vec3 zero;        /* raw gyro reading at rest */
	bool calibrated;
	float still_time;
	Vec3 still_sum;
	Vec3 still_min, still_max; /* raw range in the current still window */
	int still_n;
	bool gyro_dead;             /* gyro reported but its data is frozen */
	float check_t;              /* gyro health window */
	Vec3 chk_min, chk_max;      /* raw gyro range in the window */
	float acc_min, acc_max;     /* |accel| range in the window */
} Orient;

void orient_init(Orient *o);

/* Angular rate in the remote frame, rad/s (zero vector without gyro). */
Vec3 orient_rates(const Orient *o, const MotionSample *s);

void orient_update(Orient *o, const MotionSample *s, float dt);

/* Remove the rotation about R.z (heading), keep tilt. */
void orient_reset_heading(Orient *o);

/* Rotation about R.z, radians in (-pi, pi]. */
float orient_heading(const Orient *o);

/* R-frame vector to court frame for the near-side player (facing +z):
 * court x = -R.x, court y = R.z, court z = R.y. */
Vec3 orient_to_court(Vec3 r);

#endif
