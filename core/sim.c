#include "sim.h"
#include "bounce.h"
#include "net.h"

/* Rebound slower than this (apex ~1 mm) and the ball stays down. Must sit
 * well above g*dt (~0.04 m/s at 240 Hz) or the ball chatters forever. */
#define REST_VY 0.15f
#define ROLL_RESIST 0.05f    /* rolling deceleration = mu g ROLL_RESIST */

World world_std(void)
{
	World w = {AIR_STD, COURT_MU};
	return w;
}

World world_arcade(void)
{
	World w = {AIR_ARCADE, COURT_MU};
	return w;
}

static int is_resting(const Ball *b)
{
	return b->pos.y == BALL_RADIUS && b->vel.y == 0.0f;
}

static int roll(Ball *b, const World *w, float dt)
{
	float speed = v3_len(b->vel);
	float dv = w->mu * GRAVITY * ROLL_RESIST * dt;
	if (speed <= dv)
		b->vel = v3(0, 0, 0);
	else
		b->vel = v3_scale(b->vel, (speed - dv) / speed);
	Vec3 prev = b->pos;
	b->pos = v3_add(b->pos, v3_scale(b->vel, dt));
	return SIM_REST | net_collide(b, prev);
}

int sim_step(Ball *b, const World *w, float dt)
{
	if (is_resting(b))
		return roll(b, w, dt);

	int ev = SIM_NONE;
	Vec3 prev = b->pos;
	ball_fly(b, &w->air, dt);
	ev |= net_collide(b, prev);

	if (b->pos.y < BALL_RADIUS && b->vel.y < 0) {
		/* Bounce where the ball actually met the ground inside this step,
		 * then use the rest of the step after the bounce, so landing
		 * spots are not snapped to the step grid. */
		float f = prev.y > b->pos.y ? (prev.y - BALL_RADIUS) / (prev.y - b->pos.y) : 1.0f;
		f = fminf(fmaxf(f, 0), 1);
		Vec3 hit = v3_add(prev, v3_scale(v3_sub(b->pos, prev), f));
		b->pos = v3(hit.x, BALL_RADIUS, hit.z);
		ball_bounce(b, w->mu);
		float rest = (1 - f) * dt;
		b->pos = v3_add(b->pos, v3(b->vel.x * rest, 0, b->vel.z * rest));
		b->pos.y = BALL_RADIUS + b->vel.y * rest;
		ev |= SIM_BOUNCE;
		if (b->vel.y < REST_VY) {
			b->vel.y = 0;
			b->pos.y = BALL_RADIUS;
			ev |= SIM_REST;
		}
	}
	return ev;
}
