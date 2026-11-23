/* Phone controller input: the phone reports its own orientation (already in
 * the court reference frame R, see orient.h), angular rate in rad/s and
 * acceleration in g. Swing detection reuses the gyro swing detector. */
#ifndef LOXFORD_PHONE_H
#define LOXFORD_PHONE_H

#include <stdbool.h>

#include "orient.h"
#include "swing.h"

/* Phones swing harder than the handheld remotes the swing detector was first tuned on: real swings peak at 20-30 rad/s, and a
 * hit scales with that rate, so most hard swings flew out. The peak rate seen by
 * the stroke code is soft-capped: cap * tanh(peak / cap). See tools/swing_sweep.c. */
#define PHONE_EARLY_FRAC 0.5f /* a swing is reported once its rate has halved from the peak: the return is not
				* held back until the follow-through dies away */
#define PHONE_PEAK_CAP 15.0f /* rad/s */

typedef struct {
	Orient o;
	SwingDetector d;
	float last_t; /* time of the last accepted sample, < 0 before the first */
	Quat last_q;  /* orientation at last_t */
} PhoneInput;

void phone_init(PhoneInput *p);

/* Feed one sample. Samples whose time is not after the last accepted one are
 * ignored. Returns true once per completed swing, filling *out. */
bool phone_feed(PhoneInput *p, float t, Quat q, Vec3 rate_rads, Vec3 acc_g, SwingEvent *out);

/* Current racket orientation (phone orientation in frame R). */
Quat phone_racket_quat(const PhoneInput *p);

#endif
