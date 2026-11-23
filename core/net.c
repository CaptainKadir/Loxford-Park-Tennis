#include "net.h"
#include "court.h"
#include "sim.h"

#define CORD_E 0.3f        /* restitution off the cord */
#define CORD_KEEP_T 0.8f   /* tangential speed kept on a cord hit */
#define CORD_KEEP_SPIN 0.5f
#define MESH_E 0.1f        /* z speed kept (reversed) off the mesh */
#define MESH_KEEP 0.3f     /* x/y speed and spin kept off the mesh */

/* Cord contact: the ball's centre path (in the y-z plane) comes within
 * r + cord radius of the cord line while moving toward it. */
static int hit_cord(Ball *b, Vec3 p0)
{
	Vec3 p1 = b->pos;
	float dy = p1.y - p0.y, dz = p1.z - p0.z;
	float len2 = dy * dy + dz * dz;

	/* Closest point of the segment to the cord, using the net height at
	 * the segment's x (the cord sags slowly, so x varies negligibly). */
	float t = 0;
	float h = 0;
	for (int pass = 0; pass < 2; pass++) {
		float x = p0.x + (p1.x - p0.x) * t;
		h = net_height_at(x);
		t = len2 > 1e-12f ? -((p0.y - h) * dy + p0.z * dz) / len2 : 0;
		t = fminf(fmaxf(t, 0), 1);
	}
	float x = p0.x + (p1.x - p0.x) * t;
	h = net_height_at(x);
	if (h <= 0)
		return 0;

	Vec3 rel = v3(0, p0.y + dy * t - h, p0.z + dz * t);
	float reach = BALL_RADIUS + NET_CORD_R;
	float d = v3_len(rel);
	if (d >= reach || v3_dot(b->vel, rel) >= 0)
		return 0;

	Vec3 n = d > 1e-6f ? v3_scale(rel, 1.0f / d)
			   : v3(0, 0, p0.z < 0 ? -1.0f : 1.0f);
	b->pos = v3(x, h + n.y * reach, n.z * reach);
	float vn = v3_dot(b->vel, n);
	Vec3 vt = v3_sub(b->vel, v3_scale(n, vn));
	b->vel = v3_add(v3_scale(vt, CORD_KEEP_T), v3_scale(n, -CORD_E * vn));
	b->spin = v3_scale(b->spin, CORD_KEEP_SPIN);
	return 1;
}

/* Mesh contact: the ball reaches the net plane (|z| < r) below the cord,
 * moving toward it. Swept, so fast balls cannot pass through. */
static int hit_mesh(Ball *b, Vec3 p0)
{
	Vec3 p1 = b->pos;
	float s = p0.z < 0 ? -1.0f : 1.0f; /* side the ball came from */
	float d0 = p0.z * s, d1 = p1.z * s;
	if (d1 >= BALL_RADIUS || b->vel.z * s >= 0 || d0 < 0)
		return 0;

	float t = d0 - d1 > 1e-9f ? d0 / (d0 - d1) : 1.0f; /* reach z = 0 */
	t = fminf(fmaxf(t, 0), 1);
	float x = p0.x + (p1.x - p0.x) * t;
	float y = p0.y + (p1.y - p0.y) * t;
	float h = net_height_at(x);
	if (h <= 0 || y >= h)
		return 0;

	b->pos = v3(x, y, s * BALL_RADIUS);
	b->vel = v3(b->vel.x * MESH_KEEP, b->vel.y * MESH_KEEP, -b->vel.z * MESH_E);
	b->spin = v3_scale(b->spin, MESH_KEEP);
	return 1;
}

int net_collide(Ball *b, Vec3 prev_pos)
{
	if (fabsf(prev_pos.x) > NET_POST_X && fabsf(b->pos.x) > NET_POST_X)
		return SIM_NONE;
	/* Mesh first: a ball whose centre reaches the net plane below the cord
	 * is stopped by the net even if its top also grazes the tape. Checking
	 * the cord first let rising balls just under it be placed past the net. */
	if (hit_mesh(b, prev_pos))
		return SIM_NET_MESH;
	if (hit_cord(b, prev_pos))
		return SIM_NET_CORD;
	return SIM_NONE;
}
