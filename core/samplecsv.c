#include <stdio.h>

#include "samplecsv.h"

int samplecsv_format(char *buf, size_t n, const MotionSample *s)
{
	return snprintf(buf, n, "S,%.4f,%.4f,%.4f,%.4f,%d,%d,%d,%u,%d\n", s->t, s->accel_g.x,
			s->accel_g.y, s->accel_g.z, (int)s->gyro_raw.x, (int)s->gyro_raw.y,
			(int)s->gyro_raw.z, s->slow, s->has_gyro ? 1 : 0);
}

int samplecsv_format_hit(char *buf, size_t n, const LabHit *h, LabResult r)
{
	return snprintf(buf, n,
			"H,%.4f,%.1f,%.2f,%.1f,%.0f,%.3f,%d,%d,%d,%.3f,%.3f,%.3f,"
			"%.3f,%.3f,%.3f,%.2f,%.2f,%.2f,%.2f,%.2f\n",
			h->t_peak, h->timing_err * 1000.0f, h->racket_speed, h->ball_speed * 3.6f,
			h->spin_rpm, h->net_margin, (int)h->side, h->hit ? 1 : 0, (int)r, h->face,
			h->path, h->azim, h->contact_pos.x, h->contact_pos.y, h->contact_pos.z,
			h->contact_vel.x, h->contact_vel.y, h->contact_vel.z, h->aim_elev * 57.29578f,
			h->aim_azim * 57.29578f);
}

int samplecsv_format_header(char *buf, size_t n, bool gyro, int frame_hz)
{
	return snprintf(buf, n, "# loxford swing log v1, mode=%s, frame_hz=%d\n",
			gyro ? "MP" : "STD", frame_hz);
}

bool samplecsv_parse(const char *line, MotionSample *out)
{
	if (!line || line[0] != 'S' || line[1] != ',')
		return false;
	float t, ax, ay, az;
	int rx, ry, rz, has;
	unsigned slow;
	if (sscanf(line, "S,%f,%f,%f,%f,%d,%d,%d,%u,%d", &t, &ax, &ay, &az, &rx, &ry, &rz, &slow,
		   &has) != 9)
		return false;
	out->t = t;
	out->accel_g = v3(ax, ay, az);
	out->gyro_raw = v3((float)rx, (float)ry, (float)rz);
	out->slow = slow;
	out->has_gyro = has != 0;
	return true;
}

int samplecsv_format_phone(char *buf, size_t n, const PhoneSample *s)
{
	return snprintf(buf, n, "P,%.4f,%.5f,%.5f,%.5f,%.5f,%.4f,%.4f,%.4f,%.4f,%.4f,%.4f\n", s->t,
			s->q.w, s->q.x, s->q.y, s->q.z, s->rate.x, s->rate.y, s->rate.z, s->acc.x,
			s->acc.y, s->acc.z);
}

bool samplecsv_parse_phone(const char *line, PhoneSample *out)
{
	if (!line || line[0] != 'P' || line[1] != ',')
		return false;
	float t, qw, qx, qy, qz, rx, ry, rz, ax, ay, az;
	if (sscanf(line, "P,%f,%f,%f,%f,%f,%f,%f,%f,%f,%f,%f", &t, &qw, &qx, &qy, &qz, &rx, &ry,
		   &rz, &ax, &ay, &az) != 11)
		return false;
	out->t = t;
	out->q.w = qw;
	out->q.x = qx;
	out->q.y = qy;
	out->q.z = qz;
	out->rate = v3(rx, ry, rz);
	out->acc = v3(ax, ay, az);
	return true;
}
