/* Ball-court impact: speed-dependent restitution plus slide/grip friction
 * that couples spin and horizontal velocity. Design spec section 6.3. */
#ifndef LOXFORD_BOUNCE_H
#define LOXFORD_BOUNCE_H

#include "physics.h"

#define BALL_INERTIA_K 0.55f /* I = k m r^2 (hollow pressurised ball) */
#define COURT_MU 0.6f        /* hard court sliding friction */

/* Vertical coefficient of restitution for impact normal speed vn >= 0. */
float bounce_ey(float vn);

/* Friction impulse at a contact with outward normal n (from the surface
 * toward the ball): normal impulse jn, friction mu, surface moving at
 * surface_vel. Slides, or grips once the contact point stops slipping. */
void contact_friction(Ball *b, Vec3 n, float jn, float mu, Vec3 surface_vel);

/* Apply one ground impact to a ball with vel.y < 0. */
void ball_bounce(Ball *b, float mu);

#endif
