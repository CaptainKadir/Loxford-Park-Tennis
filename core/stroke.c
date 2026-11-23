#include "stroke.h"

static float clampf(float v, float lo, float hi)
{
	return fminf(fmaxf(v, lo), hi);
}

/* Racket face normal in the remote frame: held like a racket handle, the
 * strings face sideways from the remote. Right-hander forehand: +x. */
static Vec3 face_normal_remote(Reach side, bool right_handed)
{
	bool forehand = side != REACH_BACKHAND;
	return v3(forehand == right_handed ? 1.0f : -1.0f, 0, 0);
}

StrokeParams stroke_params(const SwingEvent *s, float timing_err, Reach side, bool right_handed)
{
	StrokeParams sp;
	bool forehand = side != REACH_BACKHAND;
	/* Early contact pulls the ball across the body: to the player's left
	 * for a right-hander's forehand, to the right on the backhand. */
	float pull = forehand == right_handed ? -1.0f : 1.0f;
	sp.azim = -timing_err * STROKE_TIMING_GAIN * pull;

	if (s->used_gyro) {
		sp.speed = s->peak * STROKE_RADIUS;

		/* Heading at the peak (CCW from above = toward the left). */
		sp.azim += -quat_heading(s->q_peak) * (s->phone ? STROKE_PHONE_HEADING_GAIN : 0.5f);

		/* A handheld remote is held like a racket handle, strings facing out of its side. A phone's
		 * racket face is its screen (as drawn): forehand uses it, backhand the back of the phone. */
		Vec3 fn = face_normal_remote(side, right_handed);
		if (s->phone)
			fn = v3(0, 0, fn.x);
		Vec3 n = quat_rotate(s->q_peak, fn);
		sp.face = asinf(clampf(n.z, -1, 1));
		if (s->phone)
			sp.face *= STROKE_PHONE_FACE_SCALE;

		/* Racket head points along remote +y; it moves along axis x head. */
		Vec3 v = quat_rotate(s->q_peak, v3_cross(s->axis, v3(0, 1, 0)));
		float lv = v3_len(v);
		sp.path = lv > 1e-6f ? v.z / lv : 0;
	} else {
		sp.speed = fminf(STROKE_ACC_BASE + STROKE_ACC_GAIN * (s->peak - 1.0f), STROKE_ACC_MAX_SPEED);
		sp.face = 0.5f * atan2f(s->acc_start.x, s->acc_start.z);
		float la = v3_len(s->acc_peak);
		/* The accelerometer says little about the swing path, so brush up
		 * by an amount that grows with speed: a hard swing needs more
		 * topspin to stay in. The wrist adds a little either way. */
		float wrist = la > 1e-6f ? s->acc_peak.z / la : 0;
		sp.path = 0.35f + 0.025f * (sp.speed - 10.0f) + 0.15f * wrist;
	}

	sp.speed = clampf(sp.speed, STROKE_MIN_SPEED, STROKE_MAX_SPEED);
	sp.azim = clampf(sp.azim, -STROKE_MAX_AZIM, STROKE_MAX_AZIM);
	sp.face = clampf(sp.face, -STROKE_MAX_FACE, STROKE_MAX_FACE);
	sp.path = s->used_gyro ? clampf(sp.path, -STROKE_MAX_PATH, STROKE_MAX_PATH)
				: clampf(sp.path, 0.3f, STROKE_ACC_MAX_PATH);
	return sp;
}

void stroke_adapt_height(StrokeParams *sp, float contact_y)
{
	float k = clampf((contact_y - 0.25f) / 0.85f, 0.0f, 1.0f); /* 0 low, 1 normal */
	sp->speed *= 0.40f + 0.60f * k;
	sp->path = fminf(sp->path + 0.60f * (1.0f - k), STROKE_ACC_MAX_PATH);
}

RacketContact stroke_contact(const Player *p, const StrokeParams *sp, float timing_err)
{
	Vec3 up = v3(0, 1, 0);
	Vec3 dir = v3_add(v3_scale(player_fwd(p), cosf(sp->azim)),
			  v3_scale(player_right(p), sinf(sp->azim)));
	RacketContact c;
	c.vel = v3_add(v3_scale(dir, sp->speed), v3_scale(up, sp->speed * sp->path));
	c.normal = v3_norm(v3_add(v3_scale(dir, cosf(sp->face)), v3_scale(up, sinf(sp->face))));
	c.offset = fminf(RACKET_SWEET_R * 0.8f * fabsf(timing_err) / STROKE_WINDOW, RACKET_SWEET_R);
	return c;
}
