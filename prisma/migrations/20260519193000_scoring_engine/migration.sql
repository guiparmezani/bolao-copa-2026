-- CreateEnum
CREATE TYPE "PredictionPhaseGroup" AS ENUM ('group', 'knockout');

-- CreateEnum
CREATE TYPE "PredictionSubmissionStatus" AS ENUM ('draft', 'confirmed');

-- CreateEnum
CREATE TYPE "PlacementPredictionKind" AS ENUM ('champion', 'runner_up', 'third_place');

-- CreateTable
CREATE TABLE "scoring_rules" (
    "id" UUID NOT NULL,
    "phase" "MatchPhase" NOT NULL,
    "one_team_goals_points" DECIMAL(5,1) NOT NULL,
    "outcome_points" DECIMAL(5,1) NOT NULL,
    "scoreline_points" DECIMAL(5,1) NOT NULL,
    "exact_cap_points" DECIMAL(5,1) NOT NULL,
    "active_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active_to" TIMESTAMP(3),
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scoring_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by_user_id" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "prediction_submissions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "phase_group" "PredictionPhaseGroup" NOT NULL,
    "status" "PredictionSubmissionStatus" NOT NULL DEFAULT 'draft',
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prediction_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_predictions" (
    "id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "home_goals" INTEGER NOT NULL,
    "away_goals" INTEGER NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "placement_predictions" (
    "id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "placement" "PlacementPredictionKind" NOT NULL,
    "team_id" UUID NOT NULL,
    "confirmed_at" TIMESTAMP(3),

    CONSTRAINT "placement_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_prediction_scores" (
    "id" UUID NOT NULL,
    "match_prediction_id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "phase" "MatchPhase" NOT NULL,
    "one_team_goals_points" DECIMAL(5,1) NOT NULL,
    "outcome_points" DECIMAL(5,1) NOT NULL,
    "scoreline_points" DECIMAL(5,1) NOT NULL,
    "total_points" DECIMAL(5,1) NOT NULL,
    "is_exact" BOOLEAN NOT NULL,
    "is_outcome_correct" BOOLEAN NOT NULL,
    "is_one_team_goals_correct" BOOLEAN NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_prediction_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_snapshots" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "total_points" DECIMAL(7,1) NOT NULL,
    "exact_count" INTEGER NOT NULL DEFAULT 0,
    "outcome_count" INTEGER NOT NULL DEFAULT 0,
    "one_team_goals_count" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaderboard_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scoring_rules_phase_active_from_active_to_idx" ON "scoring_rules"("phase", "active_from", "active_to");

-- CreateIndex
CREATE UNIQUE INDEX "prediction_submissions_user_id_phase_group_key" ON "prediction_submissions"("user_id", "phase_group");

-- CreateIndex
CREATE INDEX "prediction_submissions_status_idx" ON "prediction_submissions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "match_predictions_user_id_match_id_key" ON "match_predictions"("user_id", "match_id");

-- CreateIndex
CREATE INDEX "match_predictions_submission_id_idx" ON "match_predictions"("submission_id");

-- CreateIndex
CREATE INDEX "match_predictions_match_id_idx" ON "match_predictions"("match_id");

-- CreateIndex
CREATE UNIQUE INDEX "placement_predictions_user_id_placement_key" ON "placement_predictions"("user_id", "placement");

-- CreateIndex
CREATE INDEX "placement_predictions_submission_id_idx" ON "placement_predictions"("submission_id");

-- CreateIndex
CREATE INDEX "placement_predictions_team_id_idx" ON "placement_predictions"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_prediction_scores_match_prediction_id_key" ON "match_prediction_scores"("match_prediction_id");

-- CreateIndex
CREATE INDEX "match_prediction_scores_match_id_idx" ON "match_prediction_scores"("match_id");

-- CreateIndex
CREATE INDEX "match_prediction_scores_user_id_idx" ON "match_prediction_scores"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_snapshots_user_id_key" ON "leaderboard_snapshots"("user_id");

-- CreateIndex
CREATE INDEX "leaderboard_snapshots_rank_idx" ON "leaderboard_snapshots"("rank");

-- AddCheck
ALTER TABLE "match_predictions" ADD CONSTRAINT "match_predictions_home_goals_non_negative" CHECK ("home_goals" >= 0);

-- AddCheck
ALTER TABLE "match_predictions" ADD CONSTRAINT "match_predictions_away_goals_non_negative" CHECK ("away_goals" >= 0);

-- AddForeignKey
ALTER TABLE "scoring_rules" ADD CONSTRAINT "scoring_rules_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction_submissions" ADD CONSTRAINT "prediction_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_predictions" ADD CONSTRAINT "match_predictions_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "prediction_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_predictions" ADD CONSTRAINT "match_predictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_predictions" ADD CONSTRAINT "match_predictions_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_predictions" ADD CONSTRAINT "placement_predictions_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "prediction_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_predictions" ADD CONSTRAINT "placement_predictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_predictions" ADD CONSTRAINT "placement_predictions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_prediction_scores" ADD CONSTRAINT "match_prediction_scores_match_prediction_id_fkey" FOREIGN KEY ("match_prediction_id") REFERENCES "match_predictions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_prediction_scores" ADD CONSTRAINT "match_prediction_scores_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_prediction_scores" ADD CONSTRAINT "match_prediction_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_snapshots" ADD CONSTRAINT "leaderboard_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Immutable confirmed prediction guard.
CREATE FUNCTION reject_confirmed_prediction_changes() RETURNS trigger AS $$
BEGIN
  IF OLD.confirmed_at IS NOT NULL THEN
    RAISE EXCEPTION 'confirmed predictions cannot be changed';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reject_confirmed_match_prediction_update
BEFORE UPDATE OR DELETE ON "match_predictions"
FOR EACH ROW EXECUTE FUNCTION reject_confirmed_prediction_changes();

CREATE TRIGGER reject_confirmed_placement_prediction_update
BEFORE UPDATE OR DELETE ON "placement_predictions"
FOR EACH ROW EXECUTE FUNCTION reject_confirmed_prediction_changes();
