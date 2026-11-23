/* Turning a detected swing into a racket contact. Spec 7.2. */
#ifndef LOXFORD_STROKE_H
#define LOXFORD_STROKE_H

#include <stdbool.h>

#include "player.h"
#include "racket.h"
#include "swing.h"

#define STROKE_WINDOW 0.16f       /* s, +/- around ball arrival (the ball is in
				   * reach only ~+-65 ms after the bounce) */
#define STROKE_RADIUS 1.1f        /* m, effective arm + racket (tuned from 1.4: see M2 ledger) */
#define STROKE_TIMING_GAIN 5.5f   /* rad of azimuth per s of timing error */
#define STROKE_MAX_AZIM 0.45f     /* rad */
#define STROKE_PHONE_FACE_SCALE 0.5f /* a phone's racket-face angle is a rough guess: halve its effect */
#define STROKE_PHONE_HEADING_GAIN 0.2f /* phone swings point sideways mid-swing: follow the heading less */
#define STROKE_MAX_FACE 0.52f     /* rad, 30 degrees */
#define STROKE_MIN_SPEED 5.0f     /* m/s racket head */
#define STROKE_MAX_SPEED 45.0f
#define STROKE_ACC_BASE 7.0f      /* m/s at 1 g (Standard mode) */
#define STROKE_ACC_GAIN 4.5f      /* m/s per g above 1 */
#define STROKE_MAX_PATH 0.6f
#define STROKE_ACC_MAX_SPEED 18.0f /* m/s (65 km/h): a full-arm accelerometer swing */
#define STROKE_ACC_MAX_PATH 0.9f

typedef struct {
	float speed; /* racket head speed, m/s */
	float azim;  /* rad from straight down-court, + = toward the player's right */
	float face;  /* rad, + = open (facing up) */
	float path;  /* vertical racket speed / speed, + = low to high */
} StrokeParams;

/* timing_err = swing peak time - ball arrival time (negative = early). */
StrokeParams stroke_params(const SwingEvent *s, float timing_err, Reach side, bool right_handed);

/* A low ball is lifted, not driven: less pace and a steeper brush the closer
 * to the ground it is struck (full effect at 0.25 m, none from 1.1 m up). */
void stroke_adapt_height(StrokeParams *sp, float contact_y);

RacketContact stroke_contact(const Player *p, const StrokeParams *sp, float timing_err);

#endif
