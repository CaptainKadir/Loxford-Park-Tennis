/* Smooth follow camera for the rally view. */
#ifndef LOXFORD_CAMERA_H
#define LOXFORD_CAMERA_H

#include <stddef.h>

#include "player.h"

typedef struct {
	Vec3 eye, target;
	float fov;
} Camera;

void camera_init(Camera *c, const Player *human);
/* ball may be NULL (no ball in play): the camera settles behind the player. */
void camera_update(Camera *c, const Player *human, const Vec3 *ball, float dt);

#endif
