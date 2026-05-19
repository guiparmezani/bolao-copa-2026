-- CreateEnum
CREATE TYPE "MatchPhase" AS ENUM ('group', 'round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('scheduled', 'live', 'paused', 'finished', 'postponed', 'cancelled');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "KnockoutSlotSide" AS ENUM ('home', 'away');

-- CreateEnum
CREATE TYPE "QualificationStatus" AS ENUM ('unknown', 'qualified_top_two', 'qualified_third_place', 'eliminated');

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "provider_source" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "fifa_code" TEXT,
    "iso2_code" TEXT,
    "name_en" TEXT NOT NULL,
    "name_pt" TEXT NOT NULL,
    "flag_emoji" TEXT NOT NULL,
    "group_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL,
    "provider_source" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "match_number" INTEGER NOT NULL,
    "phase" "MatchPhase" NOT NULL,
    "group_name" TEXT,
    "kickoff_at" TIMESTAMP(3) NOT NULL,
    "venue_name" TEXT,
    "venue_city" TEXT,
    "home_team_id" UUID,
    "away_team_id" UUID,
    "home_placeholder" TEXT,
    "away_placeholder" TEXT,
    "status" "MatchStatus" NOT NULL DEFAULT 'scheduled',
    "home_goals" INTEGER,
    "away_goals" INTEGER,
    "home_goals_full_time" INTEGER,
    "away_goals_full_time" INTEGER,
    "home_goals_extra_time" INTEGER,
    "away_goals_extra_time" INTEGER,
    "home_penalties" INTEGER,
    "away_penalties" INTEGER,
    "winner_team_id" UUID,
    "publication_status" "PublicationStatus" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "published_by_user_id" UUID,
    "manual_override_by_user_id" UUID,
    "manual_override_at" TIMESTAMP(3),
    "raw_provider_payload" JSONB,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_standings" (
    "id" UUID NOT NULL,
    "provider_source" TEXT NOT NULL,
    "provider_id" TEXT,
    "group_name" TEXT NOT NULL,
    "team_id" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "played" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "goals_for" INTEGER NOT NULL DEFAULT 0,
    "goals_against" INTEGER NOT NULL DEFAULT 0,
    "goal_difference" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "fair_play_points" INTEGER,
    "fifa_ranking_current" INTEGER,
    "qualification_status" "QualificationStatus" NOT NULL DEFAULT 'unknown',
    "raw_provider_payload" JSONB,
    "last_synced_at" TIMESTAMP(3),

    CONSTRAINT "group_standings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knockout_slots" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "side" "KnockoutSlotSide" NOT NULL,
    "slot_label" TEXT NOT NULL,
    "resolved_team_id" UUID,
    "resolved_at" TIMESTAMP(3),
    "source" TEXT NOT NULL,
    "raw_provider_payload" JSONB,

    CONSTRAINT "knockout_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teams_provider_source_provider_id_key" ON "teams"("provider_source", "provider_id");

-- CreateIndex
CREATE INDEX "teams_group_name_idx" ON "teams"("group_name");

-- CreateIndex
CREATE UNIQUE INDEX "matches_match_number_key" ON "matches"("match_number");

-- CreateIndex
CREATE UNIQUE INDEX "matches_provider_source_provider_id_key" ON "matches"("provider_source", "provider_id");

-- CreateIndex
CREATE INDEX "matches_kickoff_at_idx" ON "matches"("kickoff_at");

-- CreateIndex
CREATE INDEX "matches_phase_kickoff_at_idx" ON "matches"("phase", "kickoff_at");

-- CreateIndex
CREATE INDEX "matches_status_idx" ON "matches"("status");

-- CreateIndex
CREATE INDEX "matches_publication_status_kickoff_at_idx" ON "matches"("publication_status", "kickoff_at");

-- CreateIndex
CREATE INDEX "matches_home_team_id_idx" ON "matches"("home_team_id");

-- CreateIndex
CREATE INDEX "matches_away_team_id_idx" ON "matches"("away_team_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_standings_group_name_team_id_key" ON "group_standings"("group_name", "team_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_standings_group_name_rank_key" ON "group_standings"("group_name", "rank");

-- CreateIndex
CREATE INDEX "group_standings_team_id_idx" ON "group_standings"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "knockout_slots_match_id_side_key" ON "knockout_slots"("match_id", "side");

-- CreateIndex
CREATE INDEX "knockout_slots_resolved_team_id_idx" ON "knockout_slots"("resolved_team_id");

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_team_id_fkey" FOREIGN KEY ("home_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_team_id_fkey" FOREIGN KEY ("away_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_team_id_fkey" FOREIGN KEY ("winner_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_published_by_user_id_fkey" FOREIGN KEY ("published_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_manual_override_by_user_id_fkey" FOREIGN KEY ("manual_override_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_standings" ADD CONSTRAINT "group_standings_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knockout_slots" ADD CONSTRAINT "knockout_slots_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knockout_slots" ADD CONSTRAINT "knockout_slots_resolved_team_id_fkey" FOREIGN KEY ("resolved_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
