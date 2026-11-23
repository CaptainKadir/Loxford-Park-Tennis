/* Minimal host test harness. Checks report and continue; main() returns
 * non-zero if any check failed. */
#ifndef LOXFORD_TEST_H
#define LOXFORD_TEST_H

#include <math.h>
#include <stdio.h>
#include <stdlib.h>

#include "vec.h"

extern int test_passed;
extern int test_failed;

#define CHECK(cond)                                                       \
	do {                                                              \
		if (cond) {                                               \
			test_passed++;                                    \
		} else {                                                  \
			test_failed++;                                    \
			printf("%s:%d: CHECK(%s)\n", __FILE__, __LINE__,  \
			       #cond);                                    \
		}                                                         \
	} while (0)

#define CHECK_NEAR(a, b, tol)                                             \
	do {                                                              \
		double a_ = (double)(a), b_ = (double)(b);                \
		if (fabs(a_ - b_) <= (double)(tol)) {                     \
			test_passed++;                                    \
		} else {                                                  \
			test_failed++;                                    \
			printf("%s:%d: CHECK_NEAR(%s, %s, %s): %g vs %g\n", \
			       __FILE__, __LINE__, #a, #b, #tol, a_, b_); \
		}                                                         \
	} while (0)

#define RUN(fn)                                                           \
	do {                                                              \
		void fn(void);                                            \
		int before_ = test_failed;                                \
		if (getenv("OC_VERBOSE"))                                 \
			fprintf(stderr, "run %s\n", #fn);                 \
		fn();                                                     \
		if (test_failed != before_)                               \
			printf("  FAILED: %s\n", #fn);                    \
	} while (0)

#endif
