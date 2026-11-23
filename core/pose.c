#include <math.h>

#include "pose.h"

#define TWO_PI 6.2831853f
#define RELAX_TIME 0.25f

void pose_init(Pose *p)
{
	p->run_phase = 0;
	p->lean = 0;
	p->bob = 0;
	p->arm_angle = POSE_ARM_REST;
	p->arm_side = 1;
	p->swing_t = 0;
	p->relax = 0;
}

static float smooth(float t)
{
	t = fminf(fmaxf(t, 0.0f), 1.0f);
	return t * t * (3.0f - 2.0f * t);
}

void pose_start_swing(Pose *p)
{
	p->swing_t = 1e-4f;
	p->relax = 0;
}

void pose_update(Pose *p, const Player *pl, float dt)
{
	float speed = sqrtf(pl->vel.x * pl->vel.x + pl->vel.z * pl->vel.z);
	p->arm_side = pl->right_handed ? 1.0f : -1.0f;

	if (speed > 0.3f) {
		p->run_phase = fmodf(p->run_phase + speed * 2.2f * dt, TWO_PI);
	} else {
		/* stopped: settle to the neutral stance */
		p->run_phase = 0;
	}
	float k = 1.0f - expf(-12.0f * dt);
	float want_lean = fminf(0.35f, speed * 0.06f);
	p->lean += (want_lean - p->lean) * k;
	if (p->lean < 0)
		p->lean = 0;
	if (p->lean > 0.35f)
		p->lean = 0.35f;
	p->bob = 0.04f * sinf(2.0f * p->run_phase) * fminf(1.0f, speed / 3.0f);

	if (p->swing_t > 0) {
		p->swing_t += dt / POSE_SWING_TIME;
		if (p->swing_t >= 1.0f) {
			p->swing_t = 0;
			p->relax = RELAX_TIME;
			p->arm_angle = POSE_ARM_FORWARD;
		} else {
			p->arm_angle = POSE_ARM_BACK + (POSE_ARM_FORWARD - POSE_ARM_BACK) * smooth(p->swing_t);
		}
	} else if (p->relax > 0) {
		p->relax -= dt;
		float u = 1.0f - fmaxf(p->relax, 0.0f) / RELAX_TIME;
		p->arm_angle = POSE_ARM_FORWARD + (POSE_ARM_REST - POSE_ARM_FORWARD) * smooth(u);
		if (p->relax <= 0) {
			p->relax = 0;
			p->arm_angle = POSE_ARM_REST;
		}
	} else {
		p->arm_angle = POSE_ARM_REST;
	}
}
