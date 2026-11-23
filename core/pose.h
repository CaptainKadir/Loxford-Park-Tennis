/* Body pose of a character from its motion and swing timing. Drawing only
 * reads this; nothing here affects play. */
#ifndef LOXFORD_POSE_H
#define LOXFORD_POSE_H

#include "player.h"

#define POSE_ARM_REST 0.2f
#define POSE_ARM_BACK (-1.2f)
#define POSE_ARM_FORWARD 1.6f
#define POSE_SWING_TIME 0.35f

typedef struct {
	float run_phase; /* radians, advances while moving; 0 when stopped */
	float lean;      /* forward body lean, radians, 0..0.35 */
	float bob;       /* body height offset, metres, |bob| <= 0.05 */
	float arm_angle; /* racket arm: -1.2 back .. +1.6 follow-through; 0.2 at rest */
	float arm_side;  /* +1 racket on the player's right, -1 on the left */
	float swing_t;   /* 0 when not swinging, else 0..1 progress */
	float relax;     /* s left of easing back to rest after a swing */
} Pose;

void pose_init(Pose *p);
void pose_update(Pose *p, const Player *pl, float dt);
void pose_start_swing(Pose *p);

#endif
