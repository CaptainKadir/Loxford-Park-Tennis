#include "score.h"
#include "test.h"

static void win_game(Score *s, int w)
{
	for (int i = 0; i < 4; i++)
		score_point(s, w);
}

void test_score_love_game_and_server_swaps(void)
{
	Score s;
	score_init(&s, 0);
	win_game(&s, 0);
	CHECK(s.games[0] == 1 && s.games[1] == 0);
	CHECK(s.points[0] == 0 && s.points[1] == 0);
	CHECK(s.server == 1);
	CHECK(s.game_just_won);
}

void test_score_display_calls(void)
{
	Score s;
	score_init(&s, 0);
	score_point(&s, 0);
	CHECK(score_display(&s, 0) == 1 && score_display(&s, 1) == 0);
	score_point(&s, 0);
	score_point(&s, 0);
	CHECK(score_display(&s, 0) == 3);
}

void test_score_deuce_and_advantage(void)
{
	Score s;
	score_init(&s, 0);
	for (int i = 0; i < 3; i++) {
		score_point(&s, 0);
		score_point(&s, 1);
	}
	CHECK(score_display(&s, 0) == 3 && score_display(&s, 1) == 3); /* deuce */
	score_point(&s, 0);
	CHECK(score_display(&s, 0) == 4 && score_display(&s, 1) == 3); /* advantage human */
	score_point(&s, 1);
	CHECK(score_display(&s, 0) == 3 && score_display(&s, 1) == 3 && s.games[0] == 0);
	score_point(&s, 1);
	score_point(&s, 1);
	CHECK(s.games[1] == 1 && s.points[0] == 0);
}

void test_score_set_to_four_and_match_over(void)
{
	Score s;
	score_init(&s, 0);
	for (int i = 0; i < 3; i++)
		win_game(&s, 0);
	CHECK(!s.over);
	win_game(&s, 0);
	CHECK(s.over && s.winner == 0 && s.games[0] == 4);
	score_point(&s, 1); /* ignored after the end */
	CHECK(s.points[1] == 0);
}

void test_score_three_all_next_game_wins(void)
{
	Score s;
	score_init(&s, 1);
	for (int i = 0; i < 3; i++) {
		win_game(&s, 0);
		win_game(&s, 1);
	}
	CHECK(s.games[0] == 3 && s.games[1] == 3 && !s.over);
	win_game(&s, 1);
	CHECK(s.over && s.winner == 1);
}

void test_score_short_match_for_story_mode(void)
{
	Score s;
	score_set_games_to_win(2);
	score_init(&s, 0);
	win_game(&s, 0);
	win_game(&s, 0);
	CHECK(s.over && s.winner == 0 && s.games[0] == 2); /* first to two, two clear */
	score_init(&s, 0);
	win_game(&s, 0);
	win_game(&s, 1);
	CHECK(!s.over && s.games[0] == 1 && s.games[1] == 1);
	win_game(&s, 1);
	CHECK(s.over && s.winner == 1); /* one game each: the next decides it */
	score_set_games_to_win(0); /* back to the normal length */
	score_init(&s, 0);
	win_game(&s, 0);
	win_game(&s, 0);
	CHECK(!s.over);
}
