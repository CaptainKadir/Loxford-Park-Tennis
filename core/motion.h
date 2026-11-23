/* One motion sample (angular rate and acceleration) on the lab clock. */
#ifndef LOXFORD_MOTION_H
#define LOXFORD_MOTION_H

#include <stdbool.h>

#include "vec.h"

#define MOTION_RATES_RADS 8u

typedef struct {
	float t;        /* s, lab clock */
	Vec3 accel_g;   /* accelerometer, g, remote frame */
	Vec3 gyro_raw;  /* Gyro raw rx (pitch), ry (roll), rz (yaw) */
	unsigned slow;  /* Gyro slow-mode bits: 1 pitch, 2 yaw, 4 roll;
			 * MOTION_RATES_RADS: gyro_raw already holds rad/s (phone) */
	bool has_gyro;  /* Gyro data present in this sample */
} MotionSample;

#endif
