/* One fixed simulation step of the ball in the world: flight, net, ground. */
#ifndef LOXFORD_SIM_H
#define LOXFORD_SIM_H

#include "physics.h"

typedef enum {
	SIM_NONE = 0,
	SIM_BOUNCE = 1,
	SIM_NET_CORD = 2,
	SIM_NET_MESH = 4,
	SIM_REST = 8
} SimEvents;

typedef struct {
	Air air;
	float mu; /* court friction */
} World;

World world_std(void);
World world_arcade(void);

/* Advance the ball by dt; returns a bitwise OR of SimEvents. */
int sim_step(Ball *b, const World *w, float dt);

#endif
