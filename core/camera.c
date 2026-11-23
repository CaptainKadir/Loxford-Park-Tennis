#include <math.h>

#include "camera.h"

#define EYE_RATE 4.0f
#define TARGET_RATE 6.0f
#define FOV_RATE 3.0f
#define EYE_HEIGHT 6.0f
#define EYE_BACK 8.5f
#define LOOK_AHEAD 9.0f
#define MAX_AHEAD 16.0f
#define BALL_PULL 0.3f
#define EYE_Z_LIMIT 21.0f /* a serve is at 20.5; a player chasing a ball far back (eye past 23 m, behind the end stands) must not drag the camera out over the crowd */

static void ideal(const Player *h, const Vec3 *ball, Vec3 *eye, Vec3 *target)
{
	float f = (float)h->facing;
	float ez = h->pos.z - EYE_BACK * f;
	ez = fminf(fmaxf(ez, -EYE_Z_LIMIT), EYE_Z_LIMIT);
	*eye = v3(h->pos.x * 0.6f, EYE_HEIGHT, ez);
	float tz = h->pos.z + LOOK_AHEAD * f;
	float tx = h->pos.x * 0.3f;
	if (ball) {
		float bz = fminf(fmaxf(ball->z, h->pos.z - 2.0f), h->pos.z + MAX_AHEAD);
		if (f < 0)
			bz = fmaxf(fminf(ball->z, h->pos.z + 2.0f), h->pos.z - MAX_AHEAD);
		float bx = fminf(fmaxf(ball->x, -8.0f), 8.0f);
		tz += (bz - tz) * BALL_PULL;
		tx += (bx - tx) * BALL_PULL;
	}
	if ((tz - h->pos.z) * f > MAX_AHEAD)
		tz = h->pos.z + MAX_AHEAD * f;
	*target = v3(tx, 0.6f, tz);
}

void camera_init(Camera *c, const Player *human)
{
	ideal(human, NULL, &c->eye, &c->target);
	c->fov = 50.0f;
}

static Vec3 ease(Vec3 a, Vec3 b, float k)
{
	return v3_add(a, v3_scale(v3_sub(b, a), k));
}

void camera_update(Camera *c, const Player *human, const Vec3 *ball, float dt)
{
	Vec3 eye, target;
	ideal(human, ball, &eye, &target);
	c->eye = ease(c->eye, eye, 1.0f - expf(-EYE_RATE * dt));
	c->target = ease(c->target, target, 1.0f - expf(-TARGET_RATE * dt));
	float want_fov = 50.0f;
	if (ball && fabsf(ball->z) < 4.0f)
		want_fov = 54.0f;
	c->fov += (want_fov - c->fov) * (1.0f - expf(-FOV_RATE * dt));
}
