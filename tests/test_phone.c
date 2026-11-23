#include <string.h>

#include "phone.h"
#include "stroke.h"
#include "test.h"

/* Feed a 60 Hz stream: still, a 0.25 s turn about the up axis at `rate` rad/s, still. */
static int run_stream(PhoneInput *p, float rate, bool inject_backwards, float *peak_out)
{
	int swings = 0;
	Quat q = quat_identity();
	for (int i = 0; i < 75; i++) {
		float t = i / 60.0f;
		float r = (t >= 0.5f && t < 0.75f) ? rate : 0.0f;
		SwingEvent ev;
		if (inject_backwards && i == 36) {
			SwingEvent junk;
			phone_feed(p, 0.1f, q, v3(0, 0, 20), v3(0, 0, 1), &junk);
		}
		if (phone_feed(p, t, q, v3(0, 0, r), v3(0, 0, 1), &ev)) {
			swings++;
			if (peak_out)
				*peak_out = ev.peak;
		}
	}
	return swings;
}

void test_phone_synthetic_forehand_one_swing(void)
{
	PhoneInput p;
	phone_init(&p);
	float peak = 0;
	CHECK(run_stream(&p, 8.0f, false, &peak) == 1);
	CHECK(peak > 6.0f && peak < 8.0f); /* soft cap: slightly below the raw rate */
}

void test_phone_hard_swings_are_soft_capped(void)
{
	float prev = 0;
	const float rates[] = {6, 10, 16, 25, 40};
	for (int i = 0; i < 5; i++) {
		PhoneInput p;
		phone_init(&p);
		float peak = 0;
		CHECK(run_stream(&p, rates[i], false, &peak) == 1);
		CHECK(peak > prev);              /* harder still means more power */
		CHECK(peak <= PHONE_PEAK_CAP);   /* but never past the cap */
		prev = peak;
	}
	CHECK(prev > 0.9f * PHONE_PEAK_CAP); /* a 40 rad/s swing reaches almost the cap */
}

void test_phone_backwards_timestamp_ignored(void)
{
	PhoneInput p;
	phone_init(&p);
	CHECK(run_stream(&p, 8.0f, true, NULL) == 1);
	Quat q = phone_racket_quat(&p);
	CHECK(isfinite(q.w) && isfinite(q.x) && isfinite(q.y) && isfinite(q.z));
}

void test_phone_idle_no_swing(void)
{
	PhoneInput p;
	phone_init(&p);
	Quat q = quat_identity();
	int swings = 0;
	for (int i = 0; i < 180; i++) {
		SwingEvent ev;
		float n = (i % 2 ? 0.02f : -0.02f);
		if (phone_feed(&p, i / 60.0f, q, v3(n, n, n), v3(0, n, 1), &ev))
			swings++;
	}
	CHECK(swings == 0);
}

/* The swing direction follows how the orientation really turned, not the gyro's own axes. */
void test_phone_swing_axis_follows_orientation_not_gyro_axes(void)
{
	PhoneInput p;
	phone_init(&p);
	int swings = 0;
	SwingEvent ev, got;
	for (int i = 0; i < 75; i++) {
		float t = i / 60.0f;
		bool moving = t >= 0.5f && t < 0.75f;
		float a = moving ? (t - 0.5f) * 8.0f : (t >= 0.75f ? 2.0f : 0.0f); /* turn left about up at 8 rad/s */
		Quat q = {cosf(a / 2), 0, 0, sinf(a / 2)};
		/* a gyro that reports its motion on the wrong axis */
		if (phone_feed(&p, t, q, v3(moving ? 8.0f + 4.0f * (t - 0.5f) : 0.0f, 0, 0), v3(0, 0, 1), &ev)) {
			swings++;
			got = ev;
		}
	}
	CHECK(swings == 1);
	CHECK(got.phone);
	CHECK(got.axis.z > 0.9f);
}

/* A phone's racket face is its screen: screen forward = upright face, screen up = open face. */
void test_phone_face_is_the_screen(void)
{
	SwingEvent s;
	memset(&s, 0, sizeof s);
	s.used_gyro = true;
	s.phone = true;
	s.peak = 8.0f;
	s.axis = v3(0, 0, 1);
	float h = -0.70710678f; /* -90 deg about x: device z -> forward */
	s.q_peak = (Quat){0.70710678f, h, 0, 0};
	StrokeParams fore = stroke_params(&s, 0, REACH_FOREHAND, true);
	CHECK(fabsf(fore.face) < 0.05f);
	s.q_peak = quat_identity(); /* screen up */
	CHECK(stroke_params(&s, 0, REACH_FOREHAND, true).face > 0.4f);
	CHECK(stroke_params(&s, 0, REACH_BACKHAND, true).face < -0.4f); /* back of the phone faces down */
}

/* The return is not held back until the follow-through dies away: the swing is reported once the rate
 * has halved from its peak. */
void test_phone_swing_reported_once_rate_halves(void)
{
	PhoneInput p;
	phone_init(&p);
	SwingEvent ev;
	float reported_at = -1, rate_at_report = 0;
	for (int i = 0; i < 90; i++) {
		float t = i / 100.0f;
		/* ramp up 0.2 s to 10 rad/s, then fall away over 0.5 s */
		float r = t < 0.2f ? 10.0f * t / 0.2f : fmaxf(0.0f, 10.0f * (1.0f - (t - 0.2f) / 0.5f));
		if (phone_feed(&p, t + 0.01f, quat_identity(), v3(0, 0, r), v3(0, 0, 1), &ev)) {
			reported_at = t;
			rate_at_report = r;
		}
	}
	CHECK(reported_at > 0);
	CHECK(rate_at_report <= 0.5f * 10.0f + 0.5f);
	CHECK(rate_at_report > 2.0f); /* well before it falls under the 1.5 rad/s end threshold */
}
