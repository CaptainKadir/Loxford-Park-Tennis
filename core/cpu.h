/* The CPU opponent's skill levels and shot choice. It swings through the same
 * stroke and racket physics as the human; only its decisions and mistakes are
 * made here. */
#ifndef LOXFORD_CPU_H
#define LOXFORD_CPU_H

#include <stdbool.h>
#include <stdint.h>

#include "stroke.h"

typedef struct {
	float speed_lo, speed_hi; /* racket speed range, m/s (pace is similar on every
				   * level: a harder shot only makes the return harder) */
	float aim_err;            /* direction error spread, rad */
	float timing_err;         /* swing timing error spread, s */
	float miss_prob;          /* chance of a plain mistake (long or into the net) */
	float run_speed;          /* m/s */
	float react;              /* s before it starts running after the human's hit */
	int retries;              /* tries at a softer swing when the first would miss the court (hard only) */
} CpuSkill;

enum { CPU_EASY, CPU_MEDIUM, CPU_HARD, CPU_BOSS, CPU_LEVELS }; /* BOSS: story mode's final opponent */

CpuSkill cpu_skill(int level);

uint32_t cpu_rand(uint32_t *state);
float cpu_rand_range(uint32_t *state, float lo, float hi);

/* Pick a shot. ball_x: where the ball is struck; contact_y: its height.
 * *mistake is set when the shot is deliberately bad. */
StrokeParams cpu_choose_stroke(const CpuSkill *k, uint32_t *rng, float ball_x, float contact_y,
			       bool *mistake);

#endif
