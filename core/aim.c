#include "aim.h"
#include "court.h"

#define DEG (3.14159265f / 180.0f)
#define MAX_TIME 4.0f
#define AIM_DT (1.0f / 120.0f) /* coarser than the game: only decisions are made here */
#define BISECT 6               /* 20 degrees / 2^6 = 0.3 degree resolution */
#define Z_MAX (COURT_HALF_LEN - AIM_LINE_SAFETY)

static float g_strength = 1.0f;
void aim_set_strength(float k) { g_strength = k < 1.0f ? 1.0f : k; }

bool aim_shot_ok(const Trace *t)
{
	return t->crossed_net && !t->hit_net && t->net_margin >= AIM_NET_CLEAR &&
	       fabsf(t->first_bounce.x) <= COURT_SINGLES_HALF_W - AIM_LINE_SAFETY &&
	       t->first_bounce.z >= 1.0f && t->first_bounce.z <= Z_MAX;
}

/* A cheap look at a shot: net crossing and first bounce, with the real
 * flight forces but a coarse step and no net/ground contact physics. */
typedef struct {
	bool crossed;
	float margin; /* ball bottom over the net tape at the crossing, m */
	Vec3 bounce;  /* where it first reaches the ground */
	bool landed;
} Look;

static Look look(Ball b, const World *w)
{
	Look l = {false, -1000.0f, b.pos, false};
	for (float t = 0; t < MAX_TIME; t += AIM_DT) {
		Vec3 prev = b.pos;
		ball_fly(&b, &w->air, AIM_DT);
		if (!l.crossed && prev.z < 0 && b.pos.z >= 0) {
			float f = -prev.z / (b.pos.z - prev.z);
			float x = prev.x + (b.pos.x - prev.x) * f;
			float y = prev.y + (b.pos.y - prev.y) * f;
			l.crossed = true;
			l.margin = y - BALL_RADIUS - net_height_at(x);
		}
		if (b.pos.y <= BALL_RADIUS && b.vel.y < 0) {
			float f = (prev.y - BALL_RADIUS) / (prev.y - b.pos.y);
			l.bounce = v3_add(prev, v3_scale(v3_sub(b.pos, prev), f));
			l.landed = true;
			break;
		}
	}
	return l;
}

static void rotate_y(Vec3 *v, float d)
{
	float c = cosf(d), s = sinf(d);
	float x = v->x * c + v->z * s, z = v->z * c - v->x * s;
	v->x = x;
	v->z = z;
}

/* Change the elevation of v by d, keeping its length and heading. */
static Vec3 with_elev(Vec3 v, float d)
{
	float sp = v3_len(v);
	float hs = sqrtf(v.x * v.x + v.z * v.z);
	if (hs < 1e-6f)
		return v;
	float e = atan2f(v.y, hs) + d;
	float k = sp * cosf(e) / hs;
	return v3(v.x * k, sp * sinf(e), v.z * k);
}

static bool look_ok(const Look *l)
{
	return l->crossed && l->margin >= AIM_NET_CLEAR && l->landed && l->bounce.z >= 1.0f &&
	       l->bounce.z <= Z_MAX && fabsf(l->bounce.x) <= COURT_SINGLES_HALF_W - AIM_LINE_SAFETY;
}

/* Net clearance as a number that grows with elevation (a shot that never
 * reaches the net counts as very low). */
static float net_score(const Look *l)
{
	return l->crossed ? l->margin : -10.0f + (l->landed ? l->bounce.z * 0.01f : 0);
}

/* Landing depth as a number that grows with elevation. */
static float depth_score(const Look *l)
{
	return l->landed ? l->bounce.z : 100.0f;
}

AimInfo aim_assist(Ball *b, const World *w)
{
	AimInfo info = {false, 0, 0};
	if (b->vel.z <= 1.0f)
		return info;

	Look l0 = look(*b, w);
	if (look_ok(&l0))
		return info;

	/* 1. Sideways: aim the first bounce back inside, by at most AIM_MAX_AZIM. */
	Ball cur = *b;
	float d_az = 0;
	if (l0.landed) {
		float xl = l0.bounce.x, reach = fmaxf(l0.bounce.z - b->pos.z, 2.0f);
		float lim = COURT_SINGLES_HALF_W - 0.4f;
		if (fabsf(xl) > lim) {
			float want = ((xl > 0 ? lim : -lim) - xl) / reach; /* small-angle shift */
			d_az = fminf(fmaxf(want, -AIM_MAX_AZIM * g_strength), AIM_MAX_AZIM * g_strength);
			rotate_y(&cur.vel, d_az);
			rotate_y(&cur.spin, d_az);
		}
	}

	/* Strong assist only: a shot that lands long even at the flattest allowed angle is slowed a little
	 * (down to 55% of its pace) until it can land in. */
	if (g_strength > 1.0f) {
		Ball flat = cur;
		flat.vel = with_elev(cur.vel, -AIM_MAX_ELEV * g_strength);
		for (int i = 0; i < 8; i++) {
			Look lf = look(flat, w);
			if (depth_score(&lf) <= Z_MAX)
				break;
			cur.vel = v3_scale(cur.vel, 0.93f);
			flat.vel = with_elev(cur.vel, -AIM_MAX_ELEV * g_strength);
		}
	}

	/* 2. Vertically. Net clearance and landing depth both grow with
	 * elevation, so the elevations that work form one window
	 * [d_net, d_depth]; find its two ends by bisection. */
	float lo = -AIM_MAX_ELEV * g_strength, hi = AIM_MAX_ELEV * g_strength;
	Ball at_lo = cur, at_hi = cur;
	at_lo.vel = with_elev(cur.vel, lo);
	at_hi.vel = with_elev(cur.vel, hi);
	Look l_lo = look(at_lo, w), l_hi = look(at_hi, w);

	float d_net, d_depth; /* smallest clearing the net, largest not landing long */
	if (net_score(&l_lo) >= AIM_NET_CLEAR) {
		d_net = lo;
	} else if (net_score(&l_hi) < AIM_NET_CLEAR) {
		d_net = hi + 1.0f; /* even the steepest nudge does not clear the net */
	} else {
		float a = lo, c = hi;
		for (int i = 0; i < BISECT; i++) {
			float m = 0.5f * (a + c);
			Ball t = cur;
			t.vel = with_elev(cur.vel, m);
			Look lm = look(t, w);
			if (net_score(&lm) >= AIM_NET_CLEAR)
				c = m;
			else
				a = m;
		}
		d_net = c;
	}
	if (depth_score(&l_hi) <= Z_MAX) {
		d_depth = hi;
	} else if (depth_score(&l_lo) > Z_MAX) {
		d_depth = lo - 1.0f; /* even the flattest nudge lands long */
	} else {
		float a = lo, c = hi;
		for (int i = 0; i < BISECT; i++) {
			float m = 0.5f * (a + c);
			Ball t = cur;
			t.vel = with_elev(cur.vel, m);
			Look lm = look(t, w);
			if (depth_score(&lm) <= Z_MAX)
				a = m;
			else
				c = m;
		}
		d_depth = a;
	}

	float d_el;
	if (d_net <= d_depth) {
		/* A window exists: stay as close to the original aim as possible,
		 * but a little inside the edge. */
		float margin = fminf(0.3f * DEG, 0.5f * (d_depth - d_net));
		d_el = fminf(fmaxf(0.0f, d_net + margin), d_depth - margin);
	} else {
		/* No window within the limits: take the best compromise. */
		d_el = fminf(fmaxf(0.5f * (d_net + d_depth), lo), hi);
		if (d_net > hi) /* net is the problem: all the way up */
			d_el = hi;
		else if (d_depth < lo) /* depth is the problem: all the way down */
			d_el = lo;
	}

	cur.vel = with_elev(cur.vel, d_el);

	/* Strong assist only: the up-and-down change moved where the ball lands sideways too, so look again
	 * and turn it back inside the lines (a few passes, within the wider limit). */
	if (g_strength > 1.0f) {
		const float lim = COURT_SINGLES_HALF_W - 0.4f;
		for (int i = 0; i < 4; i++) {
			Look lf = look(cur, w);
			if (!lf.landed || fabsf(lf.bounce.x) <= lim)
				break;
			float reach = fmaxf(lf.bounce.z - cur.pos.z, 2.0f);
			float want = ((lf.bounce.x > 0 ? lim : -lim) - lf.bounce.x) / reach;
			float room = AIM_MAX_AZIM * g_strength;
			float next = fminf(fmaxf(d_az + want, -room), room);
			if (next == d_az)
				break;
			rotate_y(&cur.vel, next - d_az);
			rotate_y(&cur.spin, next - d_az);
			d_az = next;
		}
	}
	*b = cur;
	info.changed = d_az != 0 || d_el != 0;
	info.d_azim = d_az;
	info.d_elev = d_el;
	return info;
}
