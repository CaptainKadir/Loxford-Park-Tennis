#include "test.h"
#include "orient.h"

static MotionSample still_sample(float t, float raw_zero)
{
	MotionSample s = {t, v3(0, 0, 1), v3(raw_zero, raw_zero, raw_zero), 7, true};
	return s;
}

void test_rates_scale_slow_and_fast(void)
{
	Orient o;
	orient_init(&o);
	MotionSample s = still_sample(0, MP_ZERO_DEFAULT);
	s.gyro_raw.z = MP_ZERO_DEFAULT + 13.768f * 90; /* 90 deg/s yaw, slow */
	CHECK_NEAR(orient_rates(&o, &s).z, 90 * 3.14159265f / 180, 1e-3f);
	s.slow = 7 & ~2u; /* yaw fast */
	CHECK_NEAR(orient_rates(&o, &s).z, 90 * 3.14159265f / 180 * 2000 / 440, 1e-2f);
}

/* Review Focus 3 */
void test_gyro_saturation_finite(void)
{
	Orient o;
	orient_init(&o);
	MotionSample s = {0, v3(0, 0, 1), v3(16383, 0, 99999), 0, true};
	Vec3 r = orient_rates(&o, &s);
	CHECK(isfinite(r.x) && isfinite(r.y) && isfinite(r.z));
	CHECK(fabsf(r.z) < 60 && fabsf(r.y) < 60); /* clamped to the sensor range */
}

void test_calibrates_zero_when_still(void)
{
	Orient o;
	orient_init(&o);
	for (int i = 0; i < 150; i++) {
		MotionSample s = {i * 0.01f, v3(0, 0, 1), v3(8100, 7990, 8030), 7, true};
		orient_update(&o, &s, 0.01f);
	}
	CHECK(o.calibrated);
	CHECK_NEAR(o.zero.x, 8100, 0.5f);
	CHECK_NEAR(o.zero.y, 7990, 0.5f);
	CHECK_NEAR(o.zero.z, 8030, 0.5f);
}

void test_integrates_quarter_turn(void)
{
	Orient o;
	orient_init(&o);
	o.zero = v3(8063, 8063, 8063);
	o.calibrated = true;
	float rate_units = 13.768f * 90; /* 90 deg/s yaw for 1 s */
	for (int i = 0; i < 100; i++) {
		MotionSample s = {i * 0.01f, v3(0, 0, 1), v3(8063, 8063, 8063 + rate_units), 7, true};
		orient_update(&o, &s, 0.01f);
	}
	CHECK_NEAR(fabsf(orient_heading(&o)), 3.14159265f / 2, 0.03f);
}

void test_tilt_corrects_toward_gravity(void)
{
	Orient o;
	orient_init(&o);
	o.calibrated = true;
	o.q = quat_normalize((Quat){0.996f, 0.087f, 0, 0}); /* ~10 deg pitch error */
	for (int i = 0; i < 500; i++) {
		MotionSample s = {i * 0.01f, v3(0, 0, 1), v3(8063, 8063, 8063), 7, true};
		orient_update(&o, &s, 0.01f);
	}
	Vec3 up = quat_rotate(o.q, v3(0, 0, 1));
	CHECK(up.z > 0.999f);
}

void test_reset_heading_keeps_tilt(void)
{
	Orient o;
	orient_init(&o);
	Quat yaw = {cosf(0.5f), 0, 0, sinf(0.5f)}, pitch = {cosf(0.2f), sinf(0.2f), 0, 0};
	o.q = quat_mul(yaw, pitch);
	float tilt_before = quat_rotate(o.q, v3(0, 0, 1)).z;
	orient_reset_heading(&o);
	CHECK_NEAR(orient_heading(&o), 0, 1e-3f);
	CHECK_NEAR(quat_rotate(o.q, v3(0, 0, 1)).z, tilt_before, 1e-3f);
}

void test_orient_to_court_axes(void)
{
	Vec3 c = orient_to_court(v3(1, 2, 3)); /* R.x right, R.y to TV, R.z up */
	CHECK_NEAR(c.x, -1, 1e-6f);
	CHECK_NEAR(c.y, 3, 1e-6f);
	CHECK_NEAR(c.z, 2, 1e-6f);
}

/* The slow flags are packed as status bit 0 = pitch, bit 1 = yaw, bit 2 = roll. */
void test_slow_bits_map_to_the_right_axes(void)
{
	Orient o;
	orient_init(&o);
	float u90 = 13.768f * 90; /* 90 deg/s in slow-mode units */
	float r90 = 90 * 3.14159265f / 180;
	MotionSample s = {0, v3(0, 0, 1),
			  v3(MP_ZERO_DEFAULT + u90, MP_ZERO_DEFAULT + u90, MP_ZERO_DEFAULT + u90), 1, true};
	Vec3 r = orient_rates(&o, &s); /* only pitch (rx) slow */
	CHECK_NEAR(r.x, r90, 1e-3f);
	CHECK_NEAR(r.z, r90 * MP_FAST_FACTOR, 1e-2f);
	s.slow = 2; /* only yaw (rz) slow */
	r = orient_rates(&o, &s);
	CHECK_NEAR(r.z, r90, 1e-3f);
	CHECK_NEAR(r.x, r90 * MP_FAST_FACTOR, 1e-2f);
	s.slow = 4; /* only roll (ry) slow */
	r = orient_rates(&o, &s);
	CHECK_NEAR(r.y, r90, 1e-3f);
}

/* Review fix 3: calibration must start even when the real zero is far from
 * the 8063 default (judge stillness by steadiness, not by rate). */
void test_calibrates_far_from_default_zero(void)
{
	float zeros[2] = {8150, 8192};
	for (int k = 0; k < 2; k++) {
		Orient o;
		orient_init(&o);
		for (int i = 0; i < 300; i++) {
			float n = (float)((i * 7) % 5) - 2; /* +-2 units of sensor noise */
			MotionSample s = {i * 0.01f, v3(0, 0, 1),
					  v3(zeros[k] + n, zeros[k] - n, zeros[k] + n), 7, true};
			orient_update(&o, &s, 0.01f);
		}
		CHECK(o.calibrated);
		CHECK_NEAR(o.zero.x, zeros[k], 1.0f);
	}
}

void test_moving_remote_does_not_calibrate(void)
{
	Orient o;
	orient_init(&o);
	for (int i = 0; i < 300; i++) {
		float u = 400 * sinf(i * 0.2f); /* waving */
		MotionSample s = {i * 0.01f, v3(0, 0, 1), v3(8063 + u, 8063, 8063), 7, true};
		orient_update(&o, &s, 0.01f);
	}
	CHECK(!o.calibrated);
}

/* Hardware finding (first session): a gyro was reported present but every
 * gyro reading was 0,0,64 while the remote swung at 4 g. A gyro that does
 * not move while the accelerometer clearly does must be flagged dead. */
void test_frozen_gyro_is_flagged_dead(void)
{
	Orient o;
	orient_init(&o);
	CHECK(!o.gyro_dead);
	for (int i = 0; i < 300; i++) {
		float g = 1 + 1.5f * fabsf(sinf(i * 0.1f));
		MotionSample s = {i * 0.006f, v3(0, g, 0.3f), v3(0, 0, 64), 0, true};
		orient_update(&o, &s, 0.006f);
	}
	CHECK(o.gyro_dead);
}

void test_live_gyro_is_not_dead(void)
{
	Orient o;
	orient_init(&o);
	for (int i = 0; i < 300; i++) {
		float g = 1 + 1.5f * fabsf(sinf(i * 0.1f));
		float u = 600 * sinf(i * 0.1f);
		MotionSample s = {i * 0.006f, v3(0, g, 0.3f), v3(8063 + u, 8063, 8063 - u), 0, true};
		orient_update(&o, &s, 0.006f);
	}
	CHECK(!o.gyro_dead);
	/* still remote: gyro steady but accelerometer steady too -> not dead */
	Orient q;
	orient_init(&q);
	for (int i = 0; i < 300; i++) {
		MotionSample s = {i * 0.006f, v3(0, 0, 1), v3(8063, 8063, 8063), 7, true};
		orient_update(&q, &s, 0.006f);
	}
	CHECK(!q.gyro_dead);
}
