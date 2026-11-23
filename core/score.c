#include "score.h"

static int g_games_to_win = SCORE_GAMES_TO_WIN;
void score_set_games_to_win(int n) { g_games_to_win = n >= 1 ? n : SCORE_GAMES_TO_WIN; }

void score_init(Score *s, int first_server)
{
	s->points[0] = s->points[1] = 0;
	s->games[0] = s->games[1] = 0;
	s->server = first_server ? 1 : 0;
	s->over = false;
	s->winner = 0;
	s->game_just_won = false;
}

void score_point(Score *s, int w)
{
	if (s->over)
		return;
	w = w ? 1 : 0;
	s->game_just_won = false;
	s->points[w]++;
	int a = s->points[w], b = s->points[1 - w];
	if (a >= 4 && a - b >= 2) {
		s->points[0] = s->points[1] = 0;
		s->games[w]++;
		s->game_just_won = true;
		s->server = 1 - s->server;
		int g = s->games[w], o = s->games[1 - w];
		int cap = g_games_to_win - 1; /* at cap-all the next game decides it */
		bool set_won = (g >= g_games_to_win && g - o >= 2) || (g > cap && g > o && o >= cap);
		if (set_won || g > g_games_to_win) {
			s->over = true;
			s->winner = w;
		}
	}
}

int score_display(const Score *s, int p)
{
	int a = s->points[p], b = s->points[1 - p];
	if (a >= 3 && b >= 3) {
		if (a == b)
			return 3; /* deuce: both read 40 */
		return a > b ? 4 : 3; /* advantage, or 40 against the advantage */
	}
	return a > 3 ? 3 : a;
}
