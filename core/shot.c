#include "shot.h"

static ShotTuning tune = {SHOT_SLOW_SPEED, SHOT_FAST_SPEED, SHOT_OPEN_FACE, SHOT_CLOSED_FACE,
			  SHOT_LOB_PATH};

ShotTuning shot_tuning_default(void)
{
	ShotTuning d = {SHOT_SLOW_SPEED, SHOT_FAST_SPEED, SHOT_OPEN_FACE, SHOT_CLOSED_FACE,
			SHOT_LOB_PATH};
	return d;
}

void shot_set_tuning(const ShotTuning *t)
{
	tune = *t;
}

ShotType shot_classify_values(float speed, float face, float path)
{
	bool open = face >= tune.open_face;
	if (speed < tune.slow_speed && open)
		return path >= tune.lob_path ? SHOT_LOB : SHOT_DROP;
	if (open)
		return SHOT_SLICE;
	if (speed >= tune.fast_speed && face <= tune.closed_face)
		return SHOT_TOPSPIN;
	return SHOT_DRIVE;
}

static bool basic_only;

void shot_set_basic(bool basic)
{
	basic_only = basic;
}

ShotType shot_classify(const LabHit *h)
{
	if (!h->hit)
		return SHOT_NONE;
	if (basic_only)
		return SHOT_DRIVE;
	return shot_classify_values(h->racket_speed, h->face, h->path);
}

const char *shot_name(ShotType t, Reach side)
{
	bool bh = side == REACH_BACKHAND;
	switch (t) {
	case SHOT_DRIVE:
		return bh ? "backhand" : "forehand";
	case SHOT_TOPSPIN:
		return bh ? "topspin backhand" : "topspin forehand";
	case SHOT_SLICE:
		return bh ? "slice backhand" : "slice forehand";
	case SHOT_DROP:
		return "drop shot";
	case SHOT_LOB:
		return "lob";
	default:
		return "";
	}
}
