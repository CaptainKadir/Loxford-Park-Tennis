/* Tennis scoring for the rally game: points within a game (with deuce and advantage), games
 * within a set, a short set, and the server, who changes every game. */
#ifndef LOXFORD_SCORE_H
#define LOXFORD_SCORE_H

#include <stdbool.h>

#define SCORE_GAMES_TO_WIN 4 /* first to this many games takes the set... */
#define SCORE_SET_CAP 3      /* ...and at 3-3 the next game decides it */

typedef struct {
	int points[2]; /* raw points won in the current game: [0] human, [1] CPU */
	int games[2];
	int server;    /* 0 human, 1 CPU */
	bool over;
	int winner;    /* 0 human, 1 CPU, valid when over */
	bool game_just_won; /* the last point finished a game (for a banner) */
} Score;

/* Games needed to take the set (default SCORE_GAMES_TO_WIN); story mode plays shorter matches. */
void score_set_games_to_win(int n);

/* first_server: 0 human, 1 CPU. */
void score_init(Score *s, int first_server);

/* Point to player w (0 human, 1 CPU). Ignored once the match is over. */
void score_point(Score *s, int w);

/* Tennis call for one side of a game score: 0, 15, 30, 40, or "Ad". "Deuce" is when both are 40.
 * Returns the display index 0..4 (0, 15, 30, 40, Ad) for side p. */
int score_display(const Score *s, int p);

#endif
