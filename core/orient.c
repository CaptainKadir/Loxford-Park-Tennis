#include "orient.h"

#define DEG2RAD (3.14159265f / 180.0f)
#define STILL_RANGE 30.0f  /* raw units: max spread per axis while still */
#define STILL_ACCEL 0.05f  /* g away from 1 */
#define STILL_TIME 1.0f    /* s */
#define TILT_ACCEL 0.1f    /* g away from 1 for tilt correction */
#define TILT_GAIN 0.02f    /* fraction of the tilt error corrected per sample */
#define CHECK_TIME 0.5f    /* s per gyro health window */
#define DEAD_GYRO_RANGE 2.0f  /* raw units: a gyro moving less than this ... */
#define DEAD_ACCEL_RANGE 0.3f /* ... while |accel| changes more than this is dead */
#define LIVE_GYRO_RANGE 10.0f

Quat quat_identity(void)
{
	Quat q = {1, 0, 0, 0};
	return q;
}

Quat quat_mul(Quat a, Quat b)
{
	Quat q = {
		a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
		a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
		a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
		a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
	};
	return q;
}

Quat quat_normalize(Quat q)
{
	float n = sqrtf(q.w * q.w + q.x * q.x + q.y * q.y + q.z * q.z);
	if (n < 1e-9f)
		return quat_identity();
	Quat r = {q.w / n, q.x / n, q.y / n, q.z / n};
	return r;
}

Vec3 quat_rotate(Quat q, Vec3 v)
{
	Vec3 u = v3(q.x, q.y, q.z);
	Vec3 t = v3_scale(v3_cross(u, v), 2.0f);
	return v3_add(v3_add(v, v3_scale(t, q.w)), v3_cross(u, t));
}

/* Rotation of angle |axis_angle| about its direction. */
static Quat quat_from_rotvec(Vec3 r)
{
	float a = v3_len(r);
	if (a < 1e-9f)
		return quat_identity();
	float s = sinf(a * 0.5f) / a;
	Quat q = {cosf(a * 0.5f), r.x * s, r.y * s, r.z * s};
	return q;
}

void orient_init(Orient *o)
{
	o->q = quat_identity();
	o->zero = v3(MP_ZERO_DEFAULT, MP_ZERO_DEFAULT, MP_ZERO_DEFAULT);
	o->calibrated = false;
	o->still_time = 0;
	o->still_sum = v3(0, 0, 0);
	o->still_min = v3(0, 0, 0);
	o->still_max = v3(0, 0, 0);
	o->still_n = 0;
	o->gyro_dead = false;
	o->check_t = 0;
	o->chk_min = o->chk_max = v3(0, 0, 0);
	o->acc_min = o->acc_max = 0;
}

static float axis_rate(float raw, float zero, bool slow)
{
	raw = fminf(fmaxf(raw, 0.0f), MP_RAW_MAX);
	float deg = (raw - zero) / MP_UNITS_PER_DEG;
	if (!slow)
		deg *= MP_FAST_FACTOR;
	return deg * DEG2RAD;
}

Vec3 orient_rates(const Orient *o, const MotionSample *s)
{
	if (!s->has_gyro)
		return v3(0, 0, 0);
	if (s->slow & MOTION_RATES_RADS)
		return s->gyro_raw;
	/* "slow" status bits: 1 = pitch (rx) slow, 2 = yaw (rz) slow,
	 * 4 = roll (ry) slow. */
	return v3(axis_rate(s->gyro_raw.x, o->zero.x, (s->slow & 1u) != 0),
		  axis_rate(s->gyro_raw.y, o->zero.y, (s->slow & 4u) != 0),
		  axis_rate(s->gyro_raw.z, o->zero.z, (s->slow & 2u) != 0));
}

/* Stillness is judged by how steady the raw readings are, not by the rate
 * computed from the current zero, so calibration also starts when the real
 * zero is far from the default. */
static void start_still_window(Orient *o, const MotionSample *s)
{
	o->still_time = 0;
	o->still_sum = s->gyro_raw;
	o->still_min = s->gyro_raw;
	o->still_max = s->gyro_raw;
	o->still_n = 1;
}

static void track_stillness(Orient *o, const MotionSample *s, float dt)
{
	if (fabsf(v3_len(s->accel_g) - 1.0f) >= STILL_ACCEL) {
		o->still_n = 0;
		return;
	}
	if (o->still_n == 0) {
		start_still_window(o, s);
		return;
	}
	Vec3 r = s->gyro_raw;
	Vec3 lo = v3(fminf(o->still_min.x, r.x), fminf(o->still_min.y, r.y), fminf(o->still_min.z, r.z));
	Vec3 hi = v3(fmaxf(o->still_max.x, r.x), fmaxf(o->still_max.y, r.y), fmaxf(o->still_max.z, r.z));
	if (hi.x - lo.x > STILL_RANGE || hi.y - lo.y > STILL_RANGE || hi.z - lo.z > STILL_RANGE) {
		start_still_window(o, s);
		return;
	}
	o->still_min = lo;
	o->still_max = hi;
	o->still_sum = v3_add(o->still_sum, r);
	o->still_n++;
	o->still_time += dt;
	if (o->still_time >= STILL_TIME) {
		o->zero = v3_scale(o->still_sum, 1.0f / (float)o->still_n);
		o->calibrated = true;
		o->still_n = 0;
	}
}

static void correct_tilt(Orient *o, Vec3 accel_g)
{
	float g = v3_len(accel_g);
	if (fabsf(g - 1.0f) >= TILT_ACCEL)
		return;
	Vec3 up_est = v3_norm(quat_rotate(o->q, accel_g));
	Vec3 axis = v3_cross(up_est, v3(0, 0, 1));
	float s = v3_len(axis);
	if (s < 1e-7f)
		return;
	float angle = atan2f(s, v3_dot(up_est, v3(0, 0, 1)));
	Quat dq = quat_from_rotvec(v3_scale(axis, TILT_GAIN * angle / s));
	o->q = quat_normalize(quat_mul(dq, o->q));
}

/* Hardware finding: a gyro can be reported present while its readings never
 * change. Flag it when the accelerometer clearly moves and the gyro does
 * not; clear the flag as soon as the gyro moves again. */
static void check_gyro_health(Orient *o, const MotionSample *s, float dt)
{
	float a = v3_len(s->accel_g);
	Vec3 r = s->gyro_raw;
	if (o->check_t <= 0) {
		o->chk_min = o->chk_max = r;
		o->acc_min = o->acc_max = a;
	} else {
		o->chk_min = v3(fminf(o->chk_min.x, r.x), fminf(o->chk_min.y, r.y), fminf(o->chk_min.z, r.z));
		o->chk_max = v3(fmaxf(o->chk_max.x, r.x), fmaxf(o->chk_max.y, r.y), fmaxf(o->chk_max.z, r.z));
		o->acc_min = fminf(o->acc_min, a);
		o->acc_max = fmaxf(o->acc_max, a);
	}
	o->check_t += dt;
	if (o->check_t < CHECK_TIME)
		return;
	Vec3 range = v3_sub(o->chk_max, o->chk_min);
	float gr = fmaxf(range.x, fmaxf(range.y, range.z));
	if (gr < DEAD_GYRO_RANGE && o->acc_max - o->acc_min > DEAD_ACCEL_RANGE)
		o->gyro_dead = true;
	else if (gr > LIVE_GYRO_RANGE)
		o->gyro_dead = false;
	o->check_t = 0;
}

void orient_update(Orient *o, const MotionSample *s, float dt)
{
	if (s->has_gyro)
		check_gyro_health(o, s, dt);
	if (s->has_gyro && !o->gyro_dead) {
		track_stillness(o, s, dt);
		Vec3 rates = orient_rates(o, s);
		o->q = quat_normalize(quat_mul(o->q, quat_from_rotvec(v3_scale(rates, dt))));
	}
	correct_tilt(o, s->accel_g);
}

/* Twist of q about R.z. */
static Quat heading_twist(Quat q)
{
	Quat t = {q.w, 0, 0, q.z};
	return quat_normalize(t);
}

void orient_reset_heading(Orient *o)
{
	Quat t = heading_twist(o->q);
	Quat inv = {t.w, 0, 0, -t.z};
	o->q = quat_normalize(quat_mul(inv, o->q));
}

float quat_heading(Quat q)
{
	/* Canonical sign (w >= 0) keeps 2*atan2 inside (-pi, pi]. */
	float w = q.w, z = q.z;
	if (w < 0) {
		w = -w;
		z = -z;
	}
	return 2.0f * atan2f(z, w);
}

float orient_heading(const Orient *o)
{
	return quat_heading(o->q);
}

Vec3 orient_to_court(Vec3 r)
{
	return v3(-r.x, r.z, r.y);
}
