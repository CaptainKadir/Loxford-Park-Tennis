/* Player movement on the D-pad and hitting reach. Spec section 8. */
#ifndef LOXFORD_PLAYER_H
#define LOXFORD_PLAYER_H

#include <stdbool.h>

#include "vec.h"

#define PLAYER_MAX_SPEED 6.0f    /* m/s */
#define PLAYER_ACCEL 20.0f       /* m/s^2: top speed in 0.3 s */
#define PLAYER_DECEL 30.0f       /* m/s^2: stop in 0.2 s */
#define PLAYER_PLANT_TIME 0.3f   /* s slowed after a swing starts */
#define PLAYER_PLANT_FACTOR 0.4f
#define REACH_LAT_MIN 0.3f       /* m sideways from the body centre */
#define REACH_LAT_MAX 2.1f       /* reach x1.4 to match the 1.4x bigger racket */
#define REACH_FWD_MIN -1.4f      /* m in front of the body (negative: just behind) */
#define REACH_FWD_MAX 3.1f
#define REACH_Y_MIN 0.2f         /* m above the court */
#define REACH_Y_MAX 3.0f
#define PLAYER_HIT_AHEAD 0.5f    /* contact plane distance in front, m */

typedef struct {
	Vec3 pos;
	Vec3 vel;
	int facing;        /* +1 looks toward +z (near side), -1 toward -z */
	bool right_handed;
	float plant;       /* s of planting left */
} Player;

typedef enum { REACH_NONE, REACH_FOREHAND, REACH_BACKHAND } Reach;

void player_init(Player *p, int facing, bool right_handed);
Vec3 player_fwd(const Player *p);
Vec3 player_right(const Player *p);

/* D-pad input relative to the player's own view: in_right/in_fwd in {-1,0,1}. */
void player_move(Player *p, float in_right, float in_fwd, float dt);
/* Assist: run toward world x = target_x with the same acceleration limits,
 * easing off so the player stops on the spot instead of overshooting. */
void player_steer_x(Player *p, float target_x, float dt);
/* Same, to a spot (x, z) with an explicit top speed (CPU skill, recovery). */
void player_steer_to(Player *p, float x, float z, float dt, float max_speed);
void player_plant(Player *p);
Reach player_reach(const Player *p, Vec3 ball);
Reach player_reach_scaled(const Player *p, Vec3 ball, float k);

#endif
