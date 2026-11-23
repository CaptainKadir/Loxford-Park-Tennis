/* Tennis ball flight: gravity, aerodynamic drag, Magnus lift, spin decay.
 * SI units. See design spec section 6.2. */
#ifndef LOXFORD_PHYSICS_H
#define LOXFORD_PHYSICS_H

#include "vec.h"

#define BALL_MASS 0.0577f   /* kg, ITF 56.0-59.4 g */
#define BALL_RADIUS 0.0335f /* m, ITF diameter 6.54-6.86 cm */
#define GRAVITY 9.81f       /* m/s^2 */
#define SIM_DT (1.0f / 240.0f)

typedef struct {
	Vec3 pos;  /* centre, m */
	Vec3 vel;  /* m/s */
	Vec3 spin; /* angular velocity vector, rad/s */
} Ball;

typedef struct {
	float rho;      /* air density, kg/m^3; 0 = vacuum (no drag, no lift) */
	float cd;       /* drag coefficient */
	float spin_tau; /* spin decay time constant, s */
	float gravity;  /* m/s^2 */
	float lin_drag; /* extra linear drag, 1/s (arcade feel); 0 = none */
} Air;

extern const Air AIR_STD;
/* Arcade feel: heavy gravity and exponential drag like the console tennis
 * games this one is judged against, no quadratic drag, spin lift kept. */
extern const Air AIR_ARCADE;

/* Acceleration from gravity + drag + Magnus, m/s^2. */
Vec3 ball_accel(const Ball *b, const Air *air);

/* One RK4 step of position and velocity (spin held constant within the
 * step), then exponential spin decay. No ground, no net. */
void ball_fly(Ball *b, const Air *air, float dt);

/* Translational kinetic + potential energy, J. */
float ball_energy(const Ball *b);

/* Spin vector for a ball travelling along dir (y ignored).
 * Positive topspin dips the ball; positive sidespin curves it toward
 * cross(up, dir) (toward +x when travelling +z). rad/s. */
Vec3 spin_vector(Vec3 dir, float topspin, float sidespin);

#endif
