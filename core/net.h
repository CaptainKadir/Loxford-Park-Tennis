/* Ball vs net: the cord (top tape) is a thin cylinder along x at the net
 * height; below it is mesh. Design spec section 6.4. */
#ifndef LOXFORD_NET_H
#define LOXFORD_NET_H

#include "physics.h"

#define NET_CORD_R 0.005f

/* Resolve contact with the net for a ball that moved from prev_pos to
 * b->pos this step. Returns SIM_NONE, SIM_NET_CORD or SIM_NET_MESH. */
int net_collide(Ball *b, Vec3 prev_pos);

#endif
