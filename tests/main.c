#include "test.h"

int test_passed;
int test_failed;

int main(void)
{
	RUN(test_vec_cross_right_handed);
	RUN(test_vec_norm_zero_safe);
	RUN(test_vec_len);

	RUN(test_free_fall_matches_closed_form);
	RUN(test_terminal_velocity);
	RUN(test_magnus_topspin_pushes_down);
	RUN(test_magnus_sidespin_curves_positive_x);
	RUN(test_zero_spin_is_finite);
	RUN(test_flight_never_gains_energy);

	RUN(test_net_profile);
	RUN(test_line_edge_inclusive);
	RUN(test_service_box);
	RUN(test_centre_service_line_is_in);

	RUN(test_itf_drop);
	RUN(test_spin_changes_bounce);
	RUN(test_ball_settles);

	RUN(test_mesh_stops_ball);
	RUN(test_fast_ball_cannot_tunnel_mesh);
	RUN(test_cord_both_outcomes);
	RUN(test_clear_ball_unaffected);
	RUN(test_rolling_ball_stopped_by_mesh);
	RUN(test_rising_ball_under_cord_is_stopped);
	RUN(test_below_cord_sweep_never_passes);

	RUN(test_flat_serve_window);
	RUN(test_topspin_widens_rally_window);
	RUN(test_magnus_changes_length);
	RUN(test_solver_hits_target);
	RUN(test_solver_unreachable);
	RUN(test_solver_never_returns_net_clipping_shot);

	RUN(test_sweet_spot_is_fastest);
	RUN(test_brushing_up_makes_topspin);
	RUN(test_open_face_lifts);
	RUN(test_racket_no_approach_is_safe);

	RUN(test_rates_scale_slow_and_fast);
	RUN(test_gyro_saturation_finite);
	RUN(test_calibrates_zero_when_still);
	RUN(test_integrates_quarter_turn);
	RUN(test_tilt_corrects_toward_gravity);
	RUN(test_reset_heading_keeps_tilt);
	RUN(test_orient_to_court_axes);
	RUN(test_slow_bits_map_to_the_right_axes);
	RUN(test_calibrates_far_from_default_zero);
	RUN(test_moving_remote_does_not_calibrate);
	RUN(test_frozen_gyro_is_flagged_dead);
	RUN(test_live_gyro_is_not_dead);

	RUN(test_gyro_swing_detected_with_peak);
	RUN(test_small_motion_is_not_a_swing);
	RUN(test_refractory_blocks_double_swing);
	RUN(test_accel_swing_detected);
	RUN(test_gyro_dropout_no_false_swing);
	RUN(test_sample_gap_no_false_swing);
	RUN(test_sensor_switch_abandons_swing);

	RUN(test_player_reaches_top_speed_smoothly);
	RUN(test_player_stops_within_0_2s);
	RUN(test_diagonal_not_faster);
	RUN(test_player_stays_on_own_side);
	RUN(test_assist_widens_the_reach);
	RUN(test_reach_forehand_backhand);
	RUN(test_plant_slows_player);

	RUN(test_faster_swing_faster_racket);
	RUN(test_early_forehand_goes_cross_court);
	RUN(test_timing_error_moves_off_sweet_spot);
	RUN(test_accel_mode_maps_speed_and_path);
	RUN(test_stroke_returns_ball_over_net);
	RUN(test_heading_same_for_q_and_minus_q);
	RUN(test_timing_within_reach_steers_shot);
	RUN(test_low_ball_is_lifted);

	RUN(test_feeds_land_in_near_court);
	RUN(test_timed_swing_hits_ball);
	RUN(test_remote_receiver_runs_while_the_serve_flies);
	RUN(test_remote_receiver_finds_the_served_ball_after_its_bounce);
	RUN(test_remote_long_ball_is_out_not_a_miss);
	RUN(test_remote_pair_over_lag_keeps_rules_and_scores_in_sync);
	RUN(test_remote_score_is_adopted_and_ignored_outside_remote);
	RUN(test_serve_toss_is_hittable_on_both_balls);
	RUN(test_whiff_changes_nothing);
	RUN(test_one_hit_per_approach);
	RUN(test_missed_ball_is_miss_then_next_feed);
	RUN(test_long_dt_is_stable);
	RUN(test_late_recognised_swing_still_hits);
	RUN(test_movement_assist_brings_player_into_reach);
	RUN(test_movement_assist_yields_to_the_dpad);

	RUN(test_aim_assist_keeps_more_shots_in);
	RUN(test_aim_assist_leaves_good_shots_alone);
	RUN(test_aim_assist_ignores_balls_not_going_downcourt);
	RUN(test_aim_assist_pulls_a_wide_ball_inside);
	RUN(test_aim_assist_in_the_lab);
	RUN(test_hit_record_has_aim_nudge);
	RUN(test_standard_remote_swings_mostly_land_in);
	RUN(test_strong_aim_keeps_at_least_as_many_in);
	RUN(test_later_swing_keeps_hit_record);
	RUN(test_hit_record_has_stroke_details);

	RUN(test_sample_roundtrip);
	RUN(test_parse_rejects_noise);
	RUN(test_hit_line_format);
	RUN(test_phone_sample_roundtrip);
	RUN(test_phone_parse_rejects_other_formats_and_noise);

	RUN(test_skill_levels_differ);
	RUN(test_cpu_rand_deterministic_and_spread);
	RUN(test_choose_stroke_in_ranges);
	RUN(test_choose_stroke_aims_across_the_court);

	RUN(test_point_rules);
	RUN(test_serve_comes_from_cpu_side);
	RUN(test_every_rally_ends);
	RUN(test_no_double_hits);
	RUN(test_cpu_returns_happen);
	RUN(test_levels_make_different_errors);
	RUN(test_human_recovers_to_ready_spot);
	RUN(test_dpad_overrides_auto_run);

	RUN(test_pose_rest_is_neutral);
	RUN(test_pose_run_phase_follows_speed);
	RUN(test_pose_swing_sweeps_forward);
	RUN(test_pose_left_hand_mirrors);
	RUN(test_pose_long_dt_is_stable);
	RUN(test_camera_settles_behind_player);
	RUN(test_camera_follows_sideways_smoothly);
	RUN(test_camera_ball_pulls_target_downcourt);
	RUN(test_camera_teleport_is_bounded);
	RUN(test_camera_long_dt_is_stable);
	RUN(test_crowd_deterministic_and_filled);
	RUN(test_crowd_stays_in_the_stands);
	RUN(test_cheer_raises_and_decays);
	RUN(test_hit_does_not_teleport_the_drawn_ball);
	RUN(test_auto_run_always_reaches_the_ball);
	RUN(test_auto_run_in_rallies);
	RUN(test_arcade_rally_plays);
	RUN(test_phone_synthetic_forehand_one_swing);
	RUN(test_phone_hard_swings_are_soft_capped);
	RUN(test_phone_backwards_timestamp_ignored);
	RUN(test_phone_idle_no_swing);
	RUN(test_phone_swing_axis_follows_orientation_not_gyro_axes);
	RUN(test_phone_face_is_the_screen);
	RUN(test_phone_swing_reported_once_rate_halves);
	RUN(test_shot_topspin);
	RUN(test_shot_slice);
	RUN(test_shot_drop);
	RUN(test_shot_lob);
	RUN(test_shot_flat_drive);
	RUN(test_serve_human_serves_first_and_ball_is_tossed);
	RUN(test_serve_swing_lands_in_the_box);
	RUN(test_serve_missed_toss_is_not_a_fault_and_is_tossed_again);
	RUN(test_serve_swing_too_early_finds_nothing);
	RUN(test_serve_alternates_each_game);
	RUN(test_score_love_game_and_server_swaps);
	RUN(test_score_display_calls);
	RUN(test_score_deuce_and_advantage);
	RUN(test_score_set_to_four_and_match_over);
	RUN(test_score_three_all_next_game_wins);
	RUN(test_score_short_match_for_story_mode);
	RUN(test_shot_miss_is_none);
	RUN(test_shot_basic_mode_names_everything_a_drive);
	RUN(test_shot_names_follow_side);

	RUN(test_doubles_off_by_default);
	RUN(test_court_in_doubles);
	RUN(test_partner_positions);
	RUN(test_ball_owner_follows_the_half_it_lands_in);
	RUN(test_serve_side_alternates_and_target_box_sign);
	RUN(test_partner_serves_in_turn_and_lands_in_the_box);
	RUN(test_partner_returns_land_in_the_far_court);
	RUN(test_full_doubles_match);

	printf("%d passed, %d failed\n", test_passed, test_failed);
	return test_failed ? 1 : 0;
}
