/* Spectators in the stands and how excited they are. Drawing reads it. */
#ifndef LOXFORD_CROWD_H
#define LOXFORD_CROWD_H

#include <stdint.h>

#include "vec.h"

#define CROWD_MAX 240

typedef struct {
	Vec3 pos; /* seat position (feet) */
	uint32_t shirt, hair;
	float phase;
} CrowdMember;

typedef struct {
	CrowdMember m[CROWD_MAX];
	int n;
	float cheer; /* 0..1 excitement */
} Crowd;

void crowd_init(Crowd *c, uint32_t seed);
void crowd_cheer(Crowd *c, float amount); /* adds excitement, clamped to 1 */
void crowd_update(Crowd *c, float dt);    /* excitement decays about 0.5 per second */
float crowd_head_y(const Crowd *c, int i, float t);

#endif
