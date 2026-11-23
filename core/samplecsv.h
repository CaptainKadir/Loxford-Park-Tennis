/* Swing log line format (text only, no file I/O).
 *   # loxford swing log v1, mode=<MP|STD>, frame_hz=<50|60>
 *   S,<t>,<ax>,<ay>,<az>,<rx>,<ry>,<rz>,<slow>,<has_gyro>
 *   H,<t_peak>,<timing_err_ms>,<racket_speed>,<ball_speed_kmh>,<spin_rpm>,
 *     <net_margin>,<side>,<hit>,<result>,<face>,<path>,<azim>,
 *     <contact_x>,<contact_y>,<contact_z>,<in_vx>,<in_vy>,<in_vz>,
 *     <aim_elev_deg>,<aim_azim_deg> */
#ifndef LOXFORD_SAMPLECSV_H
#define LOXFORD_SAMPLECSV_H

#include <stdbool.h>
#include <stddef.h>

#include "lab.h"
#include "motion.h"
#include "orient.h"

/* Phone sample line: P,<t>,<qw>,<qx>,<qy>,<qz>,<rx>,<ry>,<rz>,<ax>,<ay>,<az>
 * (orientation in court frame R, rate rad/s, acceleration g). */
typedef struct {
	float t;
	Quat q;
	Vec3 rate;
	Vec3 acc;
} PhoneSample;

int samplecsv_format_phone(char *buf, size_t n, const PhoneSample *s);
bool samplecsv_parse_phone(const char *line, PhoneSample *out);

int samplecsv_format(char *buf, size_t n, const MotionSample *s);
int samplecsv_format_hit(char *buf, size_t n, const LabHit *h, LabResult r);
int samplecsv_format_header(char *buf, size_t n, bool gyro, int frame_hz);

/* Parse an S line; false for comments, hit lines and malformed lines. */
bool samplecsv_parse(const char *line, MotionSample *out);

#endif
