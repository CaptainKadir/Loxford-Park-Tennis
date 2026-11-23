#include <string.h>

#include "test.h"
#include "samplecsv.h"

void test_sample_roundtrip(void)
{
	MotionSample s = {12.3456f, v3(0.25f, -1.5f, 0.98f), v3(8100, 7990, 8030), 5, true}, r;
	char buf[160];
	CHECK(samplecsv_format(buf, sizeof buf, &s) > 0);
	CHECK(samplecsv_parse(buf, &r));
	CHECK_NEAR(r.t, s.t, 1e-4f);
	CHECK_NEAR(r.accel_g.y, -1.5f, 1e-4f);
	CHECK(r.gyro_raw.z == 8030 && r.slow == 5 && r.has_gyro);
}

void test_parse_rejects_noise(void)
{
	MotionSample r;
	CHECK(!samplecsv_parse("# loxford swing log v1, mode=MP, frame_hz=50", &r));
	CHECK(!samplecsv_parse("H,1.0,-12,20.1,95.0,1800,0.40,1,1,1", &r));
	CHECK(!samplecsv_parse("S,1.0,0.1", &r));
	CHECK(!samplecsv_parse("", &r));
}

void test_hit_line_format(void)
{
	LabHit h;
	memset(&h, 0, sizeof h);
	h.t_peak = 1.25f;
	h.timing_err = -0.012f;
	h.racket_speed = 17.6f;
	h.ball_speed = 31.0f;
	h.spin_rpm = 1800.0f;
	h.net_margin = 0.40f;
	h.side = REACH_FOREHAND;
	h.hit = true;
	h.face = 0.1f;
	char buf[160];
	CHECK(samplecsv_format_hit(buf, sizeof buf, &h, RES_IN) > 0);
	CHECK(buf[0] == 'H' && buf[1] == ',');
	int commas = 0;
	for (const char *c = buf; *c; c++)
		commas += *c == ',';
	CHECK(commas == 20); /* H + 20 fields incl. face, path, azim, contact pos/vel, aim nudge */
	MotionSample r;
	CHECK(!samplecsv_parse(buf, &r));
}

void test_phone_sample_roundtrip(void)
{
	PhoneSample s = {1.5f, {0.9f, 0.1f, -0.3f, 0.3f}, v3(0.2f, -3.5f, 8.0f), v3(0.0f, 0.1f, 1.02f)}, r;
	char buf[200];
	CHECK(samplecsv_format_phone(buf, sizeof buf, &s) > 0);
	CHECK(buf[0] == 'P');
	CHECK(samplecsv_parse_phone(buf, &r));
	CHECK_NEAR(r.t, 1.5f, 1e-4f);
	CHECK_NEAR(r.q.w, 0.9f, 1e-4f);
	CHECK_NEAR(r.q.z, 0.3f, 1e-4f);
	CHECK_NEAR(r.rate.z, 8.0f, 1e-4f);
	CHECK_NEAR(r.acc.z, 1.02f, 1e-4f);
}

void test_phone_parse_rejects_other_formats_and_noise(void)
{
	PhoneSample r;
	CHECK(!samplecsv_parse_phone("S,1.0,0.1,0.2,0.3,1,2,3,0,1", &r));
	CHECK(!samplecsv_parse_phone("P,1.0,0.1", &r));
	CHECK(!samplecsv_parse_phone("", &r));
}
