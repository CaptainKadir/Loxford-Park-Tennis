/* Court and net geometry, line calls. Dimensions are to the outer edges of
 * the lines. Origin: centre of the net on the ground; z along the court. */
#ifndef LOXFORD_COURT_H
#define LOXFORD_COURT_H

#include <stdbool.h>

#include "vec.h"

#define COURT_HALF_LEN 11.885f       /* 23.77 / 2 */
#define COURT_SINGLES_HALF_W 4.115f  /* 8.23 / 2 */
#define COURT_DOUBLES_HALF_W 5.485f  /* 10.97 / 2 */
#define COURT_SERVICE_Z 6.40f        /* service line distance from net */
#define NET_H_CENTRE 0.914f
#define NET_H_POST 1.07f
#define NET_STICK_X 5.029f           /* singles sticks: singles half-width + 0.914 */
#define NET_POST_X 6.399f            /* posts: doubles half-width + 0.914 */
#define LINE_W 0.05f

/* Height of the top of the net at x; 0 outside the posts (no net). */
float net_height_at(float x);

/* Bounce point p lands in the singles court half on side z_sign
 * (+1 far, -1 near). Touching the line counts as in. */
bool court_in_singles(Vec3 p, int z_sign);

/* The same for a doubles court (the alleys count). */
bool court_in_doubles(Vec3 p, int z_sign);

/* Bounce point p lands in the service box on side z_sign, half x_sign
 * (sign of x). Touching the line counts as in. */
bool court_in_service_box(Vec3 p, int z_sign, int x_sign);

#endif
