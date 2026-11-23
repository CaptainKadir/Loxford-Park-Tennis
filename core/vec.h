/* 3D vector math. World axes: x across the court, y up, z along the court. */
#ifndef LOXFORD_VEC_H
#define LOXFORD_VEC_H

#include <math.h>

typedef struct {
	float x, y, z;
} Vec3;

static inline Vec3 v3(float x, float y, float z)
{
	Vec3 v = {x, y, z};
	return v;
}

static inline Vec3 v3_add(Vec3 a, Vec3 b) { return v3(a.x + b.x, a.y + b.y, a.z + b.z); }
static inline Vec3 v3_sub(Vec3 a, Vec3 b) { return v3(a.x - b.x, a.y - b.y, a.z - b.z); }
static inline Vec3 v3_scale(Vec3 a, float s) { return v3(a.x * s, a.y * s, a.z * s); }
static inline float v3_dot(Vec3 a, Vec3 b) { return a.x * b.x + a.y * b.y + a.z * b.z; }

static inline Vec3 v3_cross(Vec3 a, Vec3 b)
{
	return v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
}

static inline float v3_len(Vec3 a) { return sqrtf(v3_dot(a, a)); }

/* Unit vector, or the zero vector when a is (almost) zero. */
static inline Vec3 v3_norm(Vec3 a)
{
	float l = v3_len(a);
	return l < 1e-9f ? v3(0, 0, 0) : v3_scale(a, 1.0f / l);
}

#endif
