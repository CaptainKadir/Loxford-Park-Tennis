/* Swing detection from a stream of remote samples, with a gyro (angular
 * rate) or accelerometer only (acceleration magnitude). Spec 7.2. */
#ifndef LOXFORD_SWING_H
#define LOXFORD_SWING_H

#include <stdbool.h>

#include "motion.h"
#include "orient.h"

#define SWING_GYRO_START 3.0f  /* rad/s */
#define SWING_GYRO_END 1.5f    /* rad/s */
#define SWING_ACC_START 2.0f   /* g, magnitude */
#define SWING_ACC_END 1.4f     /* g, magnitude */
#define SWING_MIN_DUR 0.05f    /* s */
#define SWING_REFRACTORY 0.25f /* s after a swing ends */
#define SWING_MAX_GAP 0.05f    /* s between samples before a swing is abandoned */

typedef struct {
	float t_start, t_peak, t_end;
	float peak;      /* rad/s (gyro) or g (accel) */
	bool used_gyro;
	bool phone;      /* came from a phone: the racket face is the phone's screen, not its edge */
	Vec3 axis;       /* unit rotation axis at the peak, remote frame (gyro) */
	Quat q_peak;     /* orientation at the peak */
	Vec3 acc_start;  /* accel at swing start, g (wrist roll in Standard mode) */
	Vec3 acc_peak;   /* accel at the peak, g */
} SwingEvent;

typedef struct {
	int state;       /* 0 idle, 1 in a swing, 2 ignoring a blocked swing */
	float last_t;    /* time of the previous sample, < 0 before the first */
	float last_end;  /* end time of the previous reported swing */
	SwingEvent cur;
	float early_frac; /* > 0: report the swing as soon as the signal falls below this fraction of its
			   * peak (the hit lands sooner), instead of when it dies away. 0 = off (remote) */
} SwingDetector;

void swing_init(SwingDetector *d);

/* Feed one sample; returns true once per completed swing, filling *out. */
bool swing_feed(SwingDetector *d, const Orient *o, const MotionSample *s, bool use_gyro,
		SwingEvent *out);

#endif
