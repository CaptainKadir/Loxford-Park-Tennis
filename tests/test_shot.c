#include <string.h>

#include "shot.h"
#include "test.h"

static LabHit hit(float speed, float path, float face, Reach side)
{
	LabHit h = {0};
	h.hit = true;
	h.racket_speed = speed;
	h.path = path;
	h.face = face;
	h.side = side;
	return h;
}

void test_shot_topspin(void)
{
	LabHit h = hit(24.0f, 0.4f, -0.3f, REACH_FOREHAND); /* fast, face closed */
	CHECK(shot_classify(&h) == SHOT_TOPSPIN);
}

void test_shot_slice(void)
{
	LabHit h = hit(15.0f, -0.3f, 0.3f, REACH_BACKHAND);
	CHECK(shot_classify(&h) == SHOT_SLICE);
}

void test_shot_drop(void)
{
	LabHit h = hit(5.0f, -0.3f, 0.35f, REACH_FOREHAND);
	CHECK(shot_classify(&h) == SHOT_DROP);
}

void test_shot_lob(void)
{
	LabHit h = hit(5.0f, 0.6f, 0.35f, REACH_FOREHAND);
	CHECK(shot_classify(&h) == SHOT_LOB);
}

void test_shot_flat_drive(void)
{
	LabHit h = hit(26.0f, 0.05f, 0.0f, REACH_FOREHAND);
	CHECK(shot_classify(&h) == SHOT_DRIVE);
}

void test_shot_miss_is_none(void)
{
	LabHit h = hit(26.0f, 0.4f, 0.0f, REACH_FOREHAND);
	h.hit = false;
	CHECK(shot_classify(&h) == SHOT_NONE);
}

void test_shot_names_follow_side(void)
{
	CHECK(strcmp(shot_name(SHOT_DRIVE, REACH_FOREHAND), "forehand") == 0);
	CHECK(strcmp(shot_name(SHOT_DRIVE, REACH_BACKHAND), "backhand") == 0);
	CHECK(strcmp(shot_name(SHOT_TOPSPIN, REACH_BACKHAND), "topspin backhand") == 0);
	CHECK(strcmp(shot_name(SHOT_SLICE, REACH_FOREHAND), "slice forehand") == 0);
	CHECK(strcmp(shot_name(SHOT_DROP, REACH_FOREHAND), "drop shot") == 0);
	CHECK(strcmp(shot_name(SHOT_LOB, REACH_BACKHAND), "lob") == 0);
	CHECK(strcmp(shot_name(SHOT_NONE, REACH_NONE), "") == 0);
}

void test_shot_basic_mode_names_everything_a_drive(void)
{
	LabHit h = hit(5.0f, -0.3f, 0.35f, REACH_FOREHAND);
	CHECK(shot_classify(&h) == SHOT_DROP);
	shot_set_basic(true);
	CHECK(shot_classify(&h) == SHOT_DRIVE);
	CHECK(shot_classify_values(5.0f, 0.35f, -0.3f) == SHOT_DROP);
	shot_set_basic(false);
}
