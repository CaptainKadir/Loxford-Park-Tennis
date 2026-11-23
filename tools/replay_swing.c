/* Replay a Swing Lab log through the orientation filter and swing detector.
 *   build/host/replay_swing <log.csv> [--accel]
 * Prints one line per detected swing and a summary. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "orient.h"
#include "phone.h"
#include "shot.h"
#include "stroke.h"
#include "samplecsv.h"
#include "swing.h"

static int cmp_float(const void *a, const void *b)
{
	float x = *(const float *)a, y = *(const float *)b;
	return (x > y) - (x < y);
}

int main(int argc, char **argv)
{
	if (argc < 2) {
		fprintf(stderr, "usage: %s <log.csv> [--accel]\n", argv[0]);
		return 2;
	}
	bool use_gyro = !(argc > 2 && strcmp(argv[2], "--accel") == 0);
	FILE *f = fopen(argv[1], "r");
	if (!f) {
		perror(argv[1]);
		return 1;
	}

	Orient o;
	PhoneInput ph;
	phone_init(&ph);
	int phone_swings = 0;
	SwingDetector d;
	orient_init(&o);
	swing_init(&d);

	size_t cap = 1024, n = 0;
	float *gaps = malloc(cap * sizeof *gaps);
	char line[256];
	float prev_t = -1;
	int swings = 0, hits = 0;
	while (fgets(line, sizeof line, f)) {
		if (line[0] == 'H') {
			hits++;
			continue;
		}
		PhoneSample ps;
		if (samplecsv_parse_phone(line, &ps)) {
			SwingEvent pev;
			if (phone_feed(&ph, ps.t, ps.q, ps.rate, ps.acc, &pev)) {
				phone_swings++;
				for (int side = REACH_FOREHAND; side <= REACH_BACKHAND; side++) {
					StrokeParams sp = stroke_params(&pev, 0.0f, (Reach)side, true);
					LabHit h = {0};
					h.hit = true;
					h.racket_speed = sp.speed;
					h.face = sp.face;
					h.path = sp.path;
					h.side = (Reach)side;
					printf("phone swing t_peak=%.3f peak=%.2f side=%s speed=%.1f face=%.2f path=%.2f shot=%s\n",
					       pev.t_peak, pev.peak, side == REACH_FOREHAND ? "fh" : "bh",
					       sp.speed, sp.face, sp.path,
					       shot_name(shot_classify(&h), (Reach)side));
				}
			}
			continue;
		}
		MotionSample s;
		if (!samplecsv_parse(line, &s))
			continue;
		float dt = prev_t >= 0 ? s.t - prev_t : 0.01f;
		if (prev_t >= 0) {
			if (n == cap)
				gaps = realloc(gaps, (cap *= 2) * sizeof *gaps);
			gaps[n++] = dt;
		}
		prev_t = s.t;
		orient_update(&o, &s, dt > 0 && dt < 0.1f ? dt : 0.01f);
		SwingEvent ev;
		if (swing_feed(&d, &o, &s, use_gyro && s.has_gyro && !o.gyro_dead, &ev)) {
			swings++;
			printf("swing t_peak=%.3f peak=%.2f %s\n", ev.t_peak, ev.peak,
			       ev.used_gyro ? "gyro" : "accel");
		}
	}
	fclose(f);

	float median = 0;
	if (n) {
		qsort(gaps, n, sizeof *gaps, cmp_float);
		median = gaps[n / 2];
	}
	printf("phone_swings=%d\n", phone_swings);
	printf("samples=%zu median_interval_ms=%.2f swings=%d hit_lines=%d gyro_zero=%.1f,%.1f,%.1f%s%s\n",
	       n + (prev_t >= 0), median * 1000, swings, hits, o.zero.x, o.zero.y, o.zero.z,
	       o.calibrated ? "" : " (not calibrated)", o.gyro_dead ? " GYRO DEAD" : "");
	free(gaps);
	return 0;
}
