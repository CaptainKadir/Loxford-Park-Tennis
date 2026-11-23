/* Racket-ball impact at the moment of contact. Design spec section 7.1. */
#ifndef LOXFORD_RACKET_H
#define LOXFORD_RACKET_H

#include "physics.h"

#define RACKET_EA 0.40f      /* apparent coefficient of restitution, sweet spot */
#define RACKET_SWEET_R 0.12f /* m; e_A falls to the floor at this offset */
#define STRING_MU 0.45f      /* string-ball friction */

typedef struct {
	Vec3 normal; /* unit face normal, toward the side the ball should leave */
	Vec3 vel;    /* racket velocity at the contact point, m/s */
	float offset; /* distance of contact from the sweet spot, m */
} RacketContact;

/* Apparent COR for a contact offset from the sweet spot, in [0.10, RACKET_EA]. */
float racket_ea(float offset);

/* Strike the ball. The racket's own velocity is unchanged. */
void racket_hit(Ball *b, const RacketContact *c);

#endif
