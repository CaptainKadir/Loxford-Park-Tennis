/* Name the shot a recorded hit amounted to, from the racket's speed, face
 * angle and vertical path. Thresholds are tuned from phone swings. */
#ifndef LOXFORD_SHOT_H
#define LOXFORD_SHOT_H

#include "lab.h"

#define SHOT_SLOW_SPEED 7.0f   /* m/s: below this a swing is a touch shot (lob or drop) */
#define SHOT_FAST_SPEED 10.5f  /* m/s: at or above this a closed face is topspin */
#define SHOT_OPEN_FACE 0.20f   /* rad: face this open (screen tilted up) counts as open */
#define SHOT_CLOSED_FACE (-0.20f) /* rad: face this closed counts as closed */
#define SHOT_LOB_PATH 0.0f     /* touch shots: this much low-to-high is a lob, below it a drop shot */

typedef enum { SHOT_NONE, SHOT_DRIVE, SHOT_TOPSPIN, SHOT_SLICE, SHOT_DROP, SHOT_LOB } ShotType;

/* The thresholds can be replaced at run time with values fitted from the player's own
 * recorded swings (web trainer). The macros above are the defaults. */
typedef struct {
	float slow_speed, fast_speed, open_face, closed_face, lob_path;
} ShotTuning;

ShotTuning shot_tuning_default(void);
void shot_set_tuning(const ShotTuning *t);
ShotType shot_classify_values(float speed, float face, float path);
/* Basic mode (the default for the web game): every hit is a plain forehand or backhand drive.
 * shot_classify_values() is unaffected, so the thresholds stay testable. */
void shot_set_basic(bool basic);
ShotType shot_classify(const LabHit *h);

/* "forehand", "topspin backhand", "slice forehand", "drop shot", "lob", or "". */
const char *shot_name(ShotType t, Reach side);

#endif
