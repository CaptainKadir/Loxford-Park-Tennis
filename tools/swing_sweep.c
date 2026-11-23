/* How often does a well-timed swing of a given raw phone peak rate land in the court?
 * (the phone soft cap is applied first, as phone_feed does)
 *   build/host/swing_sweep [--arcade]
 * Uses the ball machine, real or arcade physics, aim assist on, forehand drive. */
#include <stdio.h>
#include <string.h>

#include <math.h>

#include "lab.h"
#include "phone.h"

int main(int argc, char **argv)
{
	bool arcade = argc > 1 && strcmp(argv[1], "--arcade") == 0;
	const float peaks[] = {6, 8, 10, 12, 14, 16, 20, 25, 30, 40};
	printf("physics: %s\n peak rad/s  hits  in-court\n", arcade ? "arcade" : "real");
	for (unsigned i = 0; i < sizeof peaks / sizeof *peaks; i++) {
		int hits = 0, ins = 0, tried = 0;
		for (uint32_t seed = 1; seed <= 150; seed++) {
			Lab lab;
			lab_init(&lab, seed, true);
			lab_set_arcade(&lab, arcade);
			lab_feed(&lab);
			lab.assist_move = false;
			lab.player.pos.x = lab.arrival_stand.x;
			lab.player.pos.z = lab.arrival_stand.z;
			if (lab.arrival_pos.y < REACH_Y_MIN || lab.arrival_pos.y > REACH_Y_MAX)
				continue;
			tried++;
			while (lab.t < lab.arrival_t + 0.06f)
				lab_step(&lab, 0, 0, 1.0f / 60);
			lab.player.pos.x = lab.arrival_stand.x;
			lab.player.pos.z = lab.arrival_stand.z;
			SwingEvent s;
			memset(&s, 0, sizeof s);
			s.used_gyro = true;
			s.peak = PHONE_PEAK_CAP * tanhf(peaks[i] / PHONE_PEAK_CAP); /* as phone_feed does */
			s.t_peak = lab.arrival_t;
			s.t_start = lab.arrival_t - 0.1f;
			s.t_end = lab.arrival_t + 0.1f;
			s.axis = v3(1, 0, 0);
			s.q_peak = quat_identity();
			int ins0 = lab.ins;
			if (!lab_swing(&lab, &s))
				continue;
			hits++;
			for (int k = 0; k < 600 && lab.state == LAB_OUTGOING; k++)
				lab_step(&lab, 0, 0, 1.0f / 60);
			if (lab.ins > ins0)
				ins++;
		}
		printf("  %9.0f  %4d  %3d%%  (of %d feeds)\n", peaks[i], hits,
		       hits ? 100 * ins / hits : 0, tried);
	}
	return 0;
}
