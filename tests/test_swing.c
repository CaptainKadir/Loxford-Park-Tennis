#include "test.h"
#include "swing.h"

/* Synthetic gyro swing: rate is a half-sine up to peak_rad over 0.4 s about
 * the remote x axis, sampled at 100 Hz, fast mode. */
static int feed_gyro_swing(SwingDetector *d, Orient *o, float t0, float peak_rad, SwingEvent *ev)
{
	int events = 0;
	for (int i = 0; i <= 40; i++) {
		float t = t0 + i * 0.01f, ph = (float)i / 40;
		float rate = sinf(ph * 3.14159265f) * peak_rad;
		float units = rate * 180 / 3.14159265f * MP_UNITS_PER_DEG / MP_FAST_FACTOR;
		MotionSample s = {t, v3(0, 0, 1), v3(o->zero.x + units, o->zero.y, o->zero.z), 0, true};
		orient_update(o, &s, 0.01f);
		if (swing_feed(d, o, &s, true, ev))
			events++;
	}
	return events;
}

void test_gyro_swing_detected_with_peak(void)
{
	SwingDetector d;
	Orient o;
	SwingEvent ev;
	swing_init(&d);
	orient_init(&o);
	CHECK(feed_gyro_swing(&d, &o, 1.0f, 15, &ev) == 1);
	CHECK(ev.used_gyro);
	CHECK_NEAR(ev.peak, 15, 0.5f);
	CHECK_NEAR(ev.t_peak, 1.20f, 0.011f);
	CHECK(fabsf(ev.axis.x) > 0.99f);
}

void test_small_motion_is_not_a_swing(void)
{
	SwingDetector d;
	Orient o;
	SwingEvent ev;
	swing_init(&d);
	orient_init(&o);
	CHECK(feed_gyro_swing(&d, &o, 1.0f, 2.0f, &ev) == 0);
}

void test_refractory_blocks_double_swing(void)
{
	SwingDetector d;
	Orient o;
	SwingEvent ev;
	swing_init(&d);
	orient_init(&o);
	CHECK(feed_gyro_swing(&d, &o, 1.0f, 15, &ev) == 1);
	CHECK(feed_gyro_swing(&d, &o, 1.41f, 15, &ev) == 0); /* starts right after the end */
	CHECK(feed_gyro_swing(&d, &o, 2.0f, 15, &ev) == 1);
}

void test_accel_swing_detected(void)
{
	SwingDetector d;
	Orient o;
	SwingEvent ev;
	swing_init(&d);
	orient_init(&o);
	int events = 0;
	for (int i = 0; i <= 40; i++) {
		float g = 1 + 3.5f * sinf((float)i / 40 * 3.14159265f);
		MotionSample s = {1 + i * 0.01f, v3(0, g, 0.3f), v3(0, 0, 0), 0, false};
		if (swing_feed(&d, &o, &s, false, &ev))
			events++;
	}
	CHECK(events == 1 && !ev.used_gyro);
	CHECK_NEAR(ev.peak, 4.5f, 0.1f);
}

/* Review Focus 1 */
void test_gyro_dropout_no_false_swing(void)
{
	SwingDetector d;
	Orient o;
	SwingEvent ev;
	swing_init(&d);
	orient_init(&o);
	int events = 0, nonfinite = 0;
	for (int i = 0; i <= 40; i++) {
		bool gyro = i < 15; /* gyro drops out mid-swing */
		float units = 15 * 180 / 3.14159265f * MP_UNITS_PER_DEG / MP_FAST_FACTOR *
			      sinf((float)i / 40 * 3.14159265f);
		MotionSample s = {1 + i * 0.01f, v3(0, 0, 1), v3(o.zero.x + units, o.zero.y, o.zero.z), 0, gyro};
		orient_update(&o, &s, 0.01f);
		if (swing_feed(&d, &o, &s, true, &ev))
			events++;
		if (!isfinite(o.q.w))
			nonfinite++;
	}
	CHECK(events == 0);
	CHECK(nonfinite == 0);
}

/* Review Focus 4 */
void test_sample_gap_no_false_swing(void)
{
	SwingDetector d;
	Orient o;
	SwingEvent ev;
	swing_init(&d);
	orient_init(&o);
	int events = 0;
	float ts[4] = {1.00f, 1.01f, 1.12f, 1.13f}; /* 110 ms stall between samples 2 and 3 */
	float units = 10 * 180 / 3.14159265f * MP_UNITS_PER_DEG / MP_FAST_FACTOR;
	for (int i = 0; i < 4; i++) {
		float u = (i == 1 || i == 2) ? units : 0;
		MotionSample s = {ts[i], v3(0, 0, 1), v3(o.zero.x + u, o.zero.y, o.zero.z), 0, true};
		if (swing_feed(&d, &o, &s, true, &ev))
			events++;
	}
	CHECK(events == 0);
}

/* Review fix 9: in Auto mode the sensor choice can change mid-swing when
 * gyro drops out; the swing in progress must be abandoned. */
void test_sensor_switch_abandons_swing(void)
{
	SwingDetector d;
	Orient o;
	SwingEvent ev;
	swing_init(&d);
	orient_init(&o);
	int events = 0;
	for (int i = 0; i <= 40; i++) {
		bool gyro = i < 12;
		float rate = 15 * sinf((float)i / 40 * 3.14159265f);
		float units = rate * 180 / 3.14159265f * MP_UNITS_PER_DEG / MP_FAST_FACTOR;
		float g = 1 + 3.5f * sinf((float)i / 40 * 3.14159265f);
		MotionSample s = {1 + i * 0.01f, v3(0, g, 0.3f),
				  v3(o.zero.x + units, o.zero.y, o.zero.z), 0, gyro};
		if (swing_feed(&d, &o, &s, gyro, &ev))
			events++;
	}
	CHECK(events == 0);
}
