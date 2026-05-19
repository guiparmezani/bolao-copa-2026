# Bolão dos Facabundos 2026 Tech Spec

Last updated: 2026-05-19

## Purpose

Build a mobile-first web app for a Brazilian World Cup 2026 bolão where users create accounts, submit immutable score predictions, follow the live match schedule, compare predictions against real results, and track the leaderboard.

Primary product language must be Brazilian Portuguese (`pt-BR`). Code, schema names, database fields, internal comments, and technical documentation can stay in English.

Every user-facing interface must be in Brazilian Portuguese, including:

- public pages;
- authenticated player pages;
- admin pages;
- navigation;
- buttons;
- form labels;
- validation messages;
- empty states;
- confirmation dialogs;
- loading/error messages;
- emails or password-reset messages if added;
- exported user-facing reports.

English text is acceptable only for internal implementation details that users do not see.

## Current Repository State

This project currently has only empty `design/` and `docs/` directories plus Git metadata. There is no project README yet, so this spec is the starting implementation document.

## External Research Summary

The 2026 tournament must be modeled as the expanded format, not as the 2022 spreadsheet format.

- FIFA's May 2026 regulations are the source of truth for tournament rules: final competition dates, 48 teams, 12 groups of four, group-stage qualification, Round of 32, later knockout rounds, group tiebreakers, best-third-place ranking, extra time, and penalty shootouts. Source: [FIFA World Cup 26 Regulations PDF](https://digitalhub.fifa.com/m/636f5c9c6f29771f/original/FWC2026_regulations_EN.pdf).
- FIFA has announced an updated 2026 match schedule with all 104 matches and a first-ever 48-team tournament. Source: [FIFA media release](https://ipt.fifa.com/organisation/media-releases/updated-world-cup-2026-match-schedule-venues-kick-off-times-104-matches).
- Sportmonks documents World Cup 2026 as season `26618`, including Group Stage, Round of 32, Round of 16, Quarter-finals, Semi-finals, Third-place Final, and Final. Source: [Sportmonks World Cup 2026 API guide](https://www.sportmonks.com/blogs/world-cup-2026-api-guide-coverage-endpoints-data-types/).
- Sportmonks also documents live-score endpoints and placeholder knockout participants, which map well to the app's automatic updates and knockout-unlock rules. Source: [Sportmonks live matches docs](https://docs.sportmonks.com/v3/world-cup-2026/live-matches-livescores-and-events).
- football-data.org supports a `WC` World Cup competition code, match/team endpoints, filters, match statuses, and rate limits. It should be evaluated as a lower-cost source, but access to 2026 coverage and plan limits must be verified before depending on it. Source: [football-data.org API docs](https://www.football-data.org/documentation/api) and [quickstart](https://www.football-data.org/documentation/quickstart).
- OpenFootball has CC0 public-domain World Cup 2026 data that is useful for initial seed data and offline tests, but it is not a live results provider. Source: [openfootball/worldcup](https://github.com/openfootball/worldcup).
- WC2026 API is an unofficial free API with 100 requests/day on the free tier. It is useful for prototyping or as a manual cross-check, but should not be the primary production source without accepting unofficial-provider risk. Source: [WC2026 API](https://www.wc2026api.com/).

## Spreadsheet Review

Source sheet: [BOLAOCOPA Google Sheet](https://docs.google.com/spreadsheets/d/1S3dB9P1xsHK246bcJZUaITrnvdQ4rNBzlaM_SRgBcQs/edit?usp=drivesdk).

What makes sense:

- The scoring model is coherent for score predictions:
  - correct one team's goals;
  - correct winner or draw;
  - correct full scoreline;
  - exact score total as scoreline points plus outcome points;
  - phase weighting for later rounds.
- The sheet caps exact-score totals so exact predictions do not accidentally overcount.
- Separate bonuses for champion, runner-up, and third place are part of the 2022 bolão behavior and should be kept.

What must change for World Cup 2026:

- The workbook schedule is for World Cup 2022: 8 groups, 48 group-stage matches, Round of 16 as the first knockout round.
- World Cup 2026 has 12 groups, 72 group-stage matches, and a Round of 32 before the Round of 16.
- The spreadsheet scoring table has no explicit Round of 32 points. The app must add a `round_of_32` scoring row using the same weights as Oitavas/Round of 16.
- The spreadsheet's maximum-points formulas are 2022-specific:
  - group max uses `48 * exact_group_points`;
  - final-phase max uses `8 Oitavas + 4 Quartas + 2 Semi + 2 Finais`.
  These formulas must be recalculated dynamically from the database match list.
- The spreadsheet includes placement bonuses: champion `75`, runner-up `50`, third place `25`. These are not match-score predictions; they are separate winner/placement picks and should be implemented to preserve the 2022 bolão rules.

2022 bolão compatibility decision:

- Keep the 2022 spreadsheet scoring behavior.
- Do not add separate extra-time or penalty-shootout prediction rules.
- Match scoring stays goals-only: exact score, winner/draw, and one-team-goals components.
- Knockout matches can still score as `Empate` if the official score recorded for bolão scoring is tied.
- Advancement and final placement are handled separately through the winner/placement picks: third place, runner-up, champion.
- Penalty shootout winner may be stored and displayed for schedule/bracket accuracy, but it does not create additional prediction points.

## Official 2026 Tournament Rules To Follow

The site should follow FIFA's 2026 competition rules for schedule, phase structure, standings, qualification, and knockout behavior. The bolão can have its own scoring rules, but it should not invent tournament progression rules.

Core format:

- Final competition dates: 11 June to 19 July 2026.
- 48 teams.
- 12 groups of four teams: Groups A through L.
- Group stage followed by Round of 32, Round of 16, quarter-finals, semi-finals, match for third place, and final.
- Each team plays the other three teams in its group once.
- Group match points: win = 3, draw = 1, loss = 0.
- The final two matches in each group are scheduled with simultaneous kickoffs unless FIFA specifies an exception.

Qualification from group stage:

- The first- and second-place teams in each group qualify for the Round of 32.
- The eight best third-place teams also qualify for the Round of 32.
- The Round of 32 contains matches M73 through M88.
- Round of 16 contains M89 through M96.
- Quarter-finals contain M97 through M100.
- Semi-finals are M101 and M102.
- Third-place match is M103.
- Final is M104.

Group ranking tiebreakers inside the same group:

1. Points in group matches between the tied teams.
2. Goal difference in group matches between the tied teams.
3. Goals scored in group matches between the tied teams.
4. If teams remain tied, reapply the first three criteria to matches between only the remaining tied teams.
5. Goal difference in all group matches.
6. Goals scored in all group matches.
7. Team conduct/fair-play score, with the highest score ranked highest:
   - yellow card: -1;
   - indirect red card from two yellows: -3;
   - direct red card: -4;
   - yellow card plus direct red card: -5.
8. Most recent FIFA/Coca-Cola Men's World Ranking.
9. Earlier FIFA/Coca-Cola Men's World Rankings, moving backward until the tie is resolved.

Best third-place ranking:

1. Points in all group matches.
2. Goal difference in all group matches.
3. Goals scored in all group matches.
4. Team conduct/fair-play score.
5. Most recent FIFA/Coca-Cola Men's World Ranking.
6. Earlier FIFA/Coca-Cola Men's World Rankings, moving backward until the tie is resolved.

Knockout match rules:

- If a knockout match is tied after normal time, extra time is played.
- Extra time is two 15-minute periods.
- If the score is still tied after extra time, a penalty shootout decides the winner.
- For this bolão, FIFA's extra-time and penalty rules are used only to understand official match progression. The scoring rules remain the same as the 2022 spreadsheet: no separate points for predicting extra time, penalties, or who advances on penalties.

Implementation implication:

- Prefer provider/FIFA official standings and bracket assignments over local derivation.
- The local app may calculate standings as a validation fallback, but should not override provider-confirmed Round-of-32 participants or Annex C best-third-place pairings.
- Knockout prediction entry opens only after Round-of-32 match participants are official, non-placeholder teams.

## Recommended Stack

Use a self-hosted Next.js application with PostgreSQL.

- Frontend and backend: Next.js App Router, React, TypeScript.
- Styling: Tailwind CSS plus a small design-token layer for the Brazil theme.
- Auth: Auth.js with username/password credentials and a Prisma adapter, or a local session implementation if Auth.js credentials flows become too awkward.
- Password hashing: Argon2id.
- Database: PostgreSQL, isolated to this app's Docker Compose project.
- ORM/migrations: Prisma.
- Background jobs: a separate `worker` service using the same codebase to sync fixture data, scores, standings, and score recalculations.
- Testing: Vitest for scoring and service tests, Playwright for end-to-end UI tests.
- Deployment: Docker Compose on `parmavps`, behind the existing Dockerized Caddy reverse proxy.

Why this stack:

- The app is small but stateful: server-rendered pages, forms, auth, and DB transactions matter more than a separate SPA/API split.
- Next.js keeps the initial product compact while supporting public pages, authenticated pages, server actions/routes, and good mobile performance.
- PostgreSQL makes immutable submissions, unique usernames, leaderboard queries, audit logs, and provider snapshots straightforward.
- The VPS already runs Docker, Compose, and shared Caddy, so an isolated Compose deployment fits the current infrastructure.

## VPS Hosting Constraints

Observed on `parmavps` on 2026-05-19:

- Hostname: `parma-vps`.
- OS kernel: Ubuntu Linux kernel `6.8.0-111-generic`.
- Docker: `29.1.3`.
- Docker Compose: `2.40.3`.
- Disk: 75G root volume, about 34G available.
- Memory: 3.8Gi total, about 1.8Gi available at inspection time.
- Public ports `80` and `443` are owned by Dockerized Caddy container `proxy-caddy-1`.
- Shared public Docker network: `public_proxy`.

Deployment requirements from the VPS rulebook:

- Do not bind app services directly to host ports `80` or `443`.
- Create an app-owned directory such as `/opt/bolao-copa-2026`.
- Use a unique Compose project name: `bolao-copa-2026`.
- Attach only the public-facing web service to `public_proxy`.
- Keep PostgreSQL and worker services off the shared proxy network.
- Add Caddy routing in `/opt/caddy/sites/bolao-copa-2026.caddy`.
- Back up Caddy config, validate Caddy, then reload Caddy for route changes.

Target Compose shape:

```yaml
name: bolao-copa-2026

services:
  web:
    build: .
    restart: unless-stopped
    expose:
      - "3000"
    depends_on:
      - postgres
    networks:
      default:
      proxy:
        aliases:
          - bolao-copa-2026-web

  worker:
    build: .
    restart: unless-stopped
    command: ["node", "dist/worker.js"]
    depends_on:
      - postgres
    networks:
      - default

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - default

networks:
  proxy:
    external: true
    name: public_proxy

volumes:
  postgres_data:
```

Caddy target pattern:

```caddyfile
bolao-facabundos-2026.parmezani.com {
    encode zstd gzip
    reverse_proxy bolao-copa-2026-web:3000
}
```

Final domain: `bolao-facabundos-2026.parmezani.com`.

Deployment is not part of the initial implementation sprint. Build and validate locally first, then deploy to `parmavps` later following the VPS deployment rulebook.

## Product Scope

### Public Pages

`/`

- Homepage for `Bolão dos Facabundos 2026`.
- Brazil football visual theme, mobile-first.
- Login/signup entry point.
- Live leaderboard preview with participant name, total points, exact scores, and last updated time.
- Public ranking should not expose unclosed predictions.

`/matches`

- World Cup schedule ordered by date.
- Shows flag emoji, team names, kickoff time in Brazil time by default, venue, phase, match status, and score.
- Shows extra-time and penalty-shootout details when available, but these are informational for bolão scoring.
- Automatically reflects provider updates after worker sync.
- Filters: all, live, today, group, knockout, team.

`/rules`

- Human-readable bolão rules.
- Explains scoring table, submission locks, phase windows, winner/placement bonuses, tie-breakers, and data-source policy.

### Auth Pages

`/signup`

- Fields: display name, unique username, password, password confirmation.
- Username normalization: trim, lowercase, allow `a-z`, `0-9`, `_`, `.`, `-`.
- Enforce unique username at DB level.

`/login`

- Username/password login.
- Rate-limited.

### Authenticated Pages

`/dashboard`

- Shows the current user's group and knockout submission status.
- Shows submitted predictions read-only.
- Shows pending drafts if not confirmed.
- Shows current score breakdown after matches are scored.

`/predictions/group`

- Group-stage score prediction form.
- Accept integer goals for home and away teams.
- Auto-save drafts before confirmation.
- Branded confirmation lightbox:
  - tells user predictions cannot be changed after confirmation;
  - requires explicit checkbox or typed confirmation;
  - after confirmation, the phase submission becomes immutable.

`/predictions/knockout`

- Hidden or locked until knockout fixtures are defined.
- Same UX as group predictions.
- Uses placeholder labels before teams are known only for schedule display, not for prediction submission.

`/predictions/winners`

- Captures the 2022 spreadsheet-style placement picks:
  - third place;
  - runner-up;
  - champion.
- These picks are submitted separately from match score predictions and lock on 2026-07-16 by default.

`/predictions`

- Public comparison view.
- Shows all users' confirmed predictions and real results.
- To reduce copying risk, reveal predictions match-by-match as soon as each match is finished. Before a match is finished, predictions for that match remain hidden.

`/admin`

- Admin-only.
- Manage scoring rules, deadlines, data-source status, manual match overrides, and user support.
- Required for production even if hidden from normal navigation.

## Admin Page Spec

Admin pages should be available only to users with `role = admin`. Every mutation must write an `audit_logs` row with actor, target entity, before/after payload, and timestamp.

### `/admin`

Admin home/dashboard:

- Data-provider status:
  - last successful static sync;
  - last successful live sync;
  - failed sync count;
  - current provider rate-limit state if available.
- Bolão health:
  - number of users;
  - group submissions confirmed/pending;
  - knockout submissions confirmed/pending;
  - winner/placement picks confirmed/pending;
  - matches finished but not scored;
  - leaderboard last recomputed time.
- Quick actions:
  - run data sync now;
  - recompute leaderboard;
  - open/close group predictions;
  - open/close knockout predictions;
  - publish all imported scheduled matches.

### `/admin/matches`

Match management and manual publishing:

- List matches by phase, group, date, status, and publication status.
- View imported provider payload and normalized app values.
- Manually publish matches:
  - publish one match;
  - bulk publish by date range, phase, group, or all imported matches;
  - unpublish a match only if no confirmed prediction references it, unless using an audited admin override.
- Add a manual match when the provider is unavailable:
  - match number;
  - phase;
  - group;
  - kickoff time;
  - venue;
  - teams or placeholder labels.
- Update match metadata:
  - kickoff time;
  - venue;
  - home/away teams;
  - placeholder labels;
  - publication status.
- Enter or override results:
  - match status;
  - goals used for bolão scoring;
  - full-time goals;
  - extra-time goals;
  - penalties;
  - advancing/winner team.
- Trigger recalculation for one match after a result change.

Publication semantics:

- `draft`: imported or manually created but hidden from public pages and prediction forms.
- `published`: visible on public schedule and eligible for prediction forms if phase is open.
- `archived`: hidden from default views but retained for audit/history.
- Provider sync can update draft or published matches, but must not overwrite admin result overrides unless an admin clears the override.

### `/admin/users`

User management:

- Add user manually:
  - display name;
  - username;
  - temporary password or password reset link;
  - role.
- Update user:
  - display name;
  - username, with uniqueness validation;
  - role;
  - active/disabled status.
- Delete/deactivate user:
  - prefer deactivate/soft-delete after a user has predictions, scores, or audit records;
  - allow hard delete only for users without dependent bolão data.
- Reset password.
- Force logout by invalidating sessions.
- View user prediction/submission status.
- Impersonation is not required. If ever added, it must be read-only by default and heavily audited.

### `/admin/submissions`

Submission support:

- View each user's group, knockout, and winner/placement submission state.
- See missing predictions before a deadline.
- Unlock a submission only through an explicit audited override. Default behavior should keep confirmed submissions immutable.
- Mark a late submission with `late=true` if admins decide to allow late entry.
- Export submissions to CSV for offline backup.

### `/admin/scoring`

Scoring and leaderboard:

- Edit active scoring rules by phase:
  - one-team-goals points;
  - outcome points;
  - scoreline points;
  - exact cap.
- Edit winner/placement bonus points:
  - champion;
  - runner-up;
  - third place.
- Preview scoring changes before saving:
  - show old leaderboard;
  - show projected leaderboard;
  - show point deltas by user.
- Save scoring changes as new rule versions, not silent in-place edits.
- Recompute all match scores and leaderboard snapshots.

### `/admin/settings`

Bolão configuration:

- Prediction deadlines:
  - group open/close time;
  - knockout open/close time;
  - winner/placement pick deadline.
- Reveal policy:
  - default: reveal each match's predictions after that match is finished;
  - optional: reveal after phase deadline;
  - optional: reveal after user submits;
  - admin-only until manually released.
- Signup policy:
  - public signup by default;
  - invite-code-only signup;
  - admin-created users only.
- Data provider:
  - primary provider;
  - fallback provider;
  - sync interval;
  - pause/resume automatic sync.
- Manual override policy:
  - require confirmation text for dangerous actions;
  - optional second admin approval for result changes after scoring.

### `/admin/audit`

Audit and operations:

- Browse audit log by actor, entity, action, and date.
- Browse provider sync logs and errors.
- Download operational exports:
  - users;
  - matches;
  - predictions;
  - scores;
  - leaderboard.
- Test mode actions for development/staging only:
  - create sample users;
  - generate sample predictions;
  - simulate match result;
  - simulate phase transition;
  - reset sample data.

Test mode must be disabled in production unless explicitly enabled through an environment variable.

## Phase and Locking Rules

Phases:

- `group`
- `round_of_32`
- `round_of_16`
- `quarter_final`
- `semi_final`
- `third_place`
- `final`

Submission groups:

- Group submission covers `group`.
- Knockout submission covers all knockout phases: `round_of_32` through `final`.
- Winner/placement submission covers champion, runner-up, and third-place picks.

Recommended default deadlines:

- Group predictions close at 2026-06-11 23:59 `America/Sao_Paulo`.
- Knockout predictions open only when the provider confirms all Round-of-32 participants and fixtures are non-placeholder.
- Knockout predictions close at 2026-06-27 23:59 `America/Sao_Paulo`.
- Winner/placement picks close at 2026-07-16 23:59 `America/Sao_Paulo`.
- Public prediction reveal happens per match as soon as that match is finished. Before a match is finished, submitted predictions for that match stay hidden to prevent copying.

If the group decides to allow late group submissions, this should be an explicit admin setting and should mark late predictions separately.

Immutability:

- Users can edit draft predictions until they confirm or the deadline passes.
- Confirmation locks all predictions in that submission.
- Database writes must reject updates/deletes to confirmed prediction rows except admin corrections through audited override code.
- Admin overrides should never rewrite the original user prediction; store a separate audit record if a correction is unavoidable.

## Scoring Rules

Default component scores from the spreadsheet:

| Phase | One Team Goals | Outcome | Scoreline | Exact Cap |
| --- | ---: | ---: | ---: | ---: |
| Group | 1 | 2 | 3 | 5 |
| Round of 32 | 1.5 | 3 | 4.5 | 7.5 |
| Round of 16/Oitavas | 1.5 | 3 | 4.5 | 7.5 |
| Quarter-finals/Quartas | 1.5 | 3 | 4.5 | 7.5 |
| Semi-finals/Semi | 2 | 4 | 6 | 10 |
| Third-place | 3 | 6 | 9 | 15 |
| Final/Finais | 3 | 6 | 9 | 15 |

Winner/placement bonuses from the 2022 bolão:

| Prediction | Points |
| --- | ---: |
| Champion | 75 |
| Runner-up | 50 |
| Third place | 25 |

Match scoring algorithm:

1. If the match has no final score, score is pending.
2. Let `predictedOutcome = sign(predictedHomeGoals - predictedAwayGoals)`.
3. Let `actualOutcome = sign(actualHomeGoals - actualAwayGoals)`.
4. Award `scoreline` points when both team scores match exactly.
5. Award `outcome` points when `predictedOutcome === actualOutcome`.
6. Award `oneTeamGoals` points when exactly one team's goals match and the full scoreline is not exact.
7. Cap the result at `exactCap`.

Examples for a group match:

| Prediction | Actual | Points | Reason |
| --- | --- | ---: | --- |
| 2-1 | 2-1 | 5 | scoreline + outcome, capped at exact |
| 2-0 | 2-1 | 3 | home goals + winner |
| 1-0 | 2-0 | 3 | away goals + winner |
| 1-1 | 2-2 | 2 | draw outcome |
| 0-1 | 2-1 | 1 | away goals only |

Knockout score basis:

- Keep the same behavior as the 2022 spreadsheet: score every match from the recorded goals only.
- Do not ask users to predict extra time or penalties separately.
- Do not award penalty-specific points.
- Store full-time, extra-time, penalty-shootout, and advancing-team data if the provider supplies it, but use it for display/bracket progression rather than match-score points.
- Admins should be able to choose which official goal total populates `home_goals`/`away_goals` for scoring if provider semantics differ. The default should mirror the official displayed match score excluding penalty-shootout kicks.

Tie-breakers for leaderboard:

1. Total points.
2. Exact score count.
3. Correct outcome count.
4. Correct one-team-goals count.
5. Earliest complete submission time across relevant phases.
6. If still tied, same rank.

## Data Model

Use UUID primary keys unless a table benefits from a provider numeric ID plus source.

### `users`

- `id`
- `username`
- `username_normalized` unique
- `display_name`
- `password_hash`
- `role` enum: `player`, `admin`
- `status` enum: `active`, `disabled`, `deleted`
- `deleted_at`
- `created_at`
- `updated_at`

### `teams`

- `id`
- `provider_source`
- `provider_id`
- `fifa_code`
- `iso2_code`
- `name_en`
- `name_pt`
- `flag_emoji`
- `group_name`
- `created_at`
- `updated_at`

Store `flag_emoji` directly because some teams are not clean ISO country flags across platforms, especially England, Scotland, Wales, and similar football associations.

### `matches`

- `id`
- `provider_source`
- `provider_id`
- `match_number`
- `phase`
- `group_name`
- `kickoff_at`
- `venue_name`
- `venue_city`
- `home_team_id`
- `away_team_id`
- `home_placeholder`
- `away_placeholder`
- `status` enum: `scheduled`, `live`, `paused`, `finished`, `postponed`, `cancelled`
- `home_goals`
- `away_goals`
- `home_goals_full_time`
- `away_goals_full_time`
- `home_goals_extra_time`
- `away_goals_extra_time`
- `home_penalties`
- `away_penalties`
- `winner_team_id`
- `publication_status` enum: `draft`, `published`, `archived`
- `published_at`
- `published_by_user_id`
- `manual_override_by_user_id`
- `manual_override_at`
- `raw_provider_payload` JSONB
- `last_synced_at`
- `created_at`
- `updated_at`

Indexes:

- unique `(provider_source, provider_id)`
- unique `match_number`
- `(kickoff_at)`
- `(phase, kickoff_at)`
- `(status)`
- `(publication_status, kickoff_at)`

### `group_standings`

Stores provider-confirmed standings and enough normalized data to validate FIFA rules locally.

- `id`
- `provider_source`
- `provider_id`
- `group_name`
- `team_id`
- `rank`
- `played`
- `wins`
- `draws`
- `losses`
- `goals_for`
- `goals_against`
- `goal_difference`
- `points`
- `fair_play_points`
- `fifa_ranking_current`
- `qualification_status` enum: `unknown`, `qualified_top_two`, `qualified_third_place`, `eliminated`
- `raw_provider_payload` JSONB
- `last_synced_at`

Constraints:

- unique `(group_name, team_id)`
- unique `(group_name, rank)`

### `knockout_slots`

Represents official bracket placeholders and final resolved teams. This is important for the 2026 Round of 32 because third-place teams can map into many possible bracket combinations.

- `id`
- `match_id`
- `side` enum: `home`, `away`
- `slot_label`, e.g. `1A`, `2B`, `Best 3rd ABCDF`, `W73`
- `resolved_team_id`
- `resolved_at`
- `source`
- `raw_provider_payload` JSONB

Constraints:

- unique `(match_id, side)`

### `scoring_rules`

- `id`
- `phase`
- `one_team_goals_points`
- `outcome_points`
- `scoreline_points`
- `exact_cap_points`
- `active_from`
- `active_to`
- `created_by_user_id`
- `created_at`

### `app_settings`

- `key`
- `value` JSONB
- `updated_by_user_id`
- `updated_at`

Settings:

- `group_submission_deadline`
- `knockout_submission_open_at`
- `knockout_submission_deadline`
- `placement_submission_deadline`
- `prediction_reveal_policy`
- `placement_predictions_enabled` default `true` to preserve the 2022 bolão rules
- `data_provider_primary`

### `prediction_submissions`

- `id`
- `user_id`
- `phase_group` enum: `group`, `knockout`
- `status` enum: `draft`, `confirmed`
- `confirmed_at`
- `created_at`
- `updated_at`

Constraints:

- unique `(user_id, phase_group)`

### `match_predictions`

- `id`
- `submission_id`
- `user_id`
- `match_id`
- `home_goals`
- `away_goals`
- `confirmed_at`
- `created_at`
- `updated_at`

Constraints:

- unique `(user_id, match_id)`
- check goals are integers `>= 0`
- application and DB trigger should reject changes after `confirmed_at` is set.

### `placement_predictions`

Stores the 2022 spreadsheet-style winner/placement picks. Keep enabled by default.

- `id`
- `submission_id`
- `user_id`
- `placement` enum: `champion`, `runner_up`, `third_place`
- `team_id`
- `confirmed_at`

Constraints:

- unique `(user_id, placement)`

### `match_prediction_scores`

- `id`
- `match_prediction_id`
- `match_id`
- `user_id`
- `phase`
- `one_team_goals_points`
- `outcome_points`
- `scoreline_points`
- `total_points`
- `is_exact`
- `is_outcome_correct`
- `is_one_team_goals_correct`
- `computed_at`

Constraints:

- unique `(match_prediction_id)`

### `leaderboard_snapshots`

- `id`
- `user_id`
- `total_points`
- `exact_count`
- `outcome_count`
- `one_team_goals_count`
- `rank`
- `computed_at`

This can be a table maintained by the worker or a materialized view. Start with a table for fast homepage reads and predictable caching.

### `provider_sync_logs`

- `id`
- `provider_source`
- `sync_type`
- `status`
- `started_at`
- `finished_at`
- `error_message`
- `metadata` JSONB

### `audit_logs`

- `id`
- `actor_user_id`
- `action`
- `entity_type`
- `entity_id`
- `before` JSONB
- `after` JSONB
- `created_at`

## Data Provider Integration

Recommended provider strategy:

1. Primary preference: official public data, especially FIFA, if a usable documented source is available and its terms allow this use.
2. Secondary/backup: football-data.org after verifying 2026 World Cup coverage and plan access.
3. Paid fallback: Sportmonks, if official/public options are insufficient and budget allows.
4. Seed/offline source: OpenFootball CC0.
5. Optional prototype source: WC2026 API.
6. Manual verification source: FIFA official schedule and match centre.

Do not scrape FIFA pages for production updates. Use FIFA as a manual source of truth only unless FIFA exposes a documented API with acceptable terms.

Worker sync jobs:

- `syncStaticTournamentData`
  - Before tournament: daily.
  - During tournament: every 6 hours.
  - Updates teams, venues, match numbers, kickoff times, placeholders, phases.
- `syncLiveMatches`
  - During active match windows: every 15-60 seconds depending on provider limits.
  - Outside active windows: every 5-15 minutes.
  - Updates status and current scores.
- `finalizeFinishedMatches`
  - Runs after any match moves to `finished`.
  - Stores final normalized goals, penalty data, and raw payload.
  - Recomputes affected prediction scores and leaderboard.
- `openKnockoutPredictionsIfReady`
  - Checks all Round-of-32 fixtures have real participants and no placeholders.
  - Sets `knockout_submission_open_at` or flips a setting.
  - Notifies admins in logs.
- `syncOfficialStandings`
  - Stores official group standings and qualification status when available.
  - Uses FIFA tiebreaker implementation only as a fallback/validation check.
  - Never overwrites official provider-confirmed Round-of-32 teams with a local guess.

Provider normalization should convert every provider response into the app's internal `NormalizedMatch` shape before database writes.

```ts
type NormalizedMatch = {
  providerSource: string;
  providerId: string;
  matchNumber: number;
  phase: MatchPhase;
  groupName?: string;
  kickoffAt: Date;
  venueName?: string;
  homeTeam?: NormalizedTeam;
  awayTeam?: NormalizedTeam;
  homePlaceholder?: string;
  awayPlaceholder?: string;
  status: MatchStatus;
  score?: {
    homeGoals: number;
    awayGoals: number;
    homePenalties?: number;
    awayPenalties?: number;
  };
  raw: unknown;
};
```

## API Routes and Server Actions

Use server actions for simple authenticated form submissions and route handlers for public JSON or worker/admin endpoints.

Public:

- `GET /api/leaderboard`
- `GET /api/matches`
- `GET /api/rules`

Auth:

- `POST /api/auth/signup`
- Auth.js route handlers for login/session if using Auth.js.

Authenticated:

- `GET /api/me/predictions`
- `POST /api/predictions/group/draft`
- `POST /api/predictions/group/confirm`
- `POST /api/predictions/knockout/draft`
- `POST /api/predictions/knockout/confirm`

Admin:

- `POST /api/admin/sync/run`
- `GET /api/admin/health`
- `GET /api/admin/audit`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:id`
- `DELETE /api/admin/users/:id`
- `POST /api/admin/users/:id/reset-password`
- `GET /api/admin/matches`
- `POST /api/admin/matches`
- `PATCH /api/admin/matches/:id`
- `POST /api/admin/matches/:id/publish`
- `POST /api/admin/matches/bulk-publish`
- `POST /api/admin/matches/:id/override-result`
- `POST /api/admin/matches/:id/recalculate`
- `GET /api/admin/submissions`
- `PATCH /api/admin/submissions/:id`
- `POST /api/admin/scoring-rules`
- `POST /api/admin/settings`
- `POST /api/admin/leaderboard/recompute`
- `GET /api/admin/export/:entity`

## UI and Design Direction

Locked direction:

- Use `design/conceito-02-noite-de-copa.html` as the visual source of truth for the homepage and shared shell.
- Use `design/conceito-02-regras.html` as the visual source of truth for the rules page.
- The implementation should match these concepts closely in spacing, density, color, typography scale, card treatment, navigation, and responsive behavior.
- The homepage must not expose admin-only widgets, user-specific submission status, or login-restricted prediction details.
- Public homepage sections should be limited to public-facing content such as:
  - hero and login/signup CTA;
  - public leaderboard;
  - public match schedule/highlight;
  - short explanation of how the bolão works;
  - link to the full rules page.
- Admin pages remain available only after login and must not appear as a public homepage widget.

Language:

- UI locale is `pt-BR`.
- All visible copy must use Brazilian Portuguese.
- Dates and times should be formatted for Brazil by default, with kickoff times shown in `America/Sao_Paulo` unless a user setting is added later.
- Match phases should use Brazilian football terms in the UI, for example `Fase de grupos`, `Oitavas`, `Quartas`, `Semi`, `Disputa de terceiro lugar`, and `Final`. Because World Cup 2026 adds a Round of 32, use `16 avos de final` or another agreed Portuguese label consistently after confirmation.
- Internal enum names can remain English, but UI labels must be mapped through a translation/display layer instead of rendering raw enum values.

Theme:

- Build dark and light themes.
- Default theme should follow the user's system preference via `prefers-color-scheme`.
- Add a theme toggle in the main navigation.
- Persist manual theme choice in local storage or user profile after login.
- The dark theme should be the primary visual expression from Concept 02: stadium background, dark translucent panels, yellow CTA, green accents, and blue score/ranking highlights.
- The light theme should preserve the same layout and stadium background but shift panels and text to a brighter match-day palette.

Mobile-first layout:

- Primary navigation as bottom tabs or compact header on mobile.
- Desktop navigation can expand into a top nav.
- Forms should be grouped by date and phase, not giant tables.
- Prediction inputs should use numeric steppers and native number input fallback.
- Use tight, scannable match rows with flag emoji, team name, and goals.

Visual direction:

- Brazil-inspired palette, but avoid a one-note green/yellow UI.
- Suggested palette:
  - deep green for structure;
  - yellow/gold for highlights;
  - blue for interactive controls;
  - off-white surfaces;
  - neutral dark text.
- Homepage can use a football/Brazil hero image or generated bitmap background.
- Avoid marketing-only homepage behavior; first viewport should immediately show login/signup and leaderboard.

Flag emoji:

- Display as `{flag_emoji} {team_name_pt}`.
- Store fallback short code, e.g. `BRA Brasil`, where emoji rendering is inconsistent.
- Do not rely solely on country ISO conversion; store manual overrides.

Lightbox confirmation copy:

```text
Confirmar palpites?

Depois de confirmar, seus placares desta fase ficam travados e não poderão ser alterados.

[ ] Entendi que não poderei mudar estes palpites.

Cancelar | Confirmar e travar
```

## Security

- Passwords: Argon2id, never reversible encryption.
- Sessions: secure, HTTP-only cookies in production.
- CSRF protection for mutations.
- Login/signup rate limiting by IP and username.
- Normalize usernames and enforce DB uniqueness.
- Validate prediction deadlines on the server, not only in the UI.
- Use transaction boundaries for confirmation:
  - validate deadline;
  - validate every match has exactly one prediction;
  - set prediction rows and submission as confirmed;
  - commit atomically.
- Audit all admin overrides and scoring rule changes.
- Keep provider API keys server-side only.
- Never expose `.env.production` values in logs or docs.

## Performance and Caching

- Homepage should read from `leaderboard_snapshots` to avoid recomputing on every request.
- Schedule page can use cached DB data and revalidate frequently during match windows.
- Prediction forms should paginate or group by date/phase on mobile to avoid long render stalls.
- Worker should use provider-specific incremental endpoints when available.
- Avoid client polling every user against provider APIs; all provider calls happen server-side.

## Testing Plan

Unit tests:

- Score engine:
  - exact score;
  - correct winner only;
  - correct draw only;
  - one team goals only;
  - one team goals plus outcome;
  - knockout phase weights;
  - exact cap behavior;
  - penalty shootout data ignored for score prediction.
- Deadline and immutability rules.
- Username normalization.
- FIFA 2026 format helpers if implemented locally:
  - 12 groups of four;
  - top two plus eight best third-place teams;
  - same-group tiebreaker order;
  - best-third-place tiebreaker order;
  - Round-of-32 readiness only after placeholders resolve.

Integration tests:

- Signup creates unique user.
- Duplicate username is rejected.
- Draft save works before deadline.
- Confirmation locks predictions.
- Confirmed predictions cannot be edited.
- Knockout form stays locked while fixtures have placeholders.
- Provider sync updates match scores and recalculates leaderboard.

E2E tests:

- Mobile signup/login.
- Mobile group prediction confirmation lightbox.
- Homepage leaderboard.
- Match schedule filtering.
- Authenticated prediction comparison page.

## Implementation Milestones

1. Project scaffold
   - Next.js, TypeScript, Tailwind, Prisma, PostgreSQL Compose for local dev.
   - Base layout, mobile navigation, design tokens.

2. Auth and users - implemented in milestone 2
   - Signup/login/logout.
   - Username uniqueness and password hashing.
   - Admin role seed.

3. Tournament data
   - Database schema.
   - Seed from OpenFootball or provider fixture import.
   - Schedule page.

4. Scoring engine - implemented in milestone 4
   - Configurable rules.
   - Unit-tested score calculation.
   - Leaderboard snapshot generation.

5. Group predictions - implemented in milestone 5
   - Draft save.
   - Confirmation lightbox.
   - Immutable submissions.
   - Authenticated `/predictions/group` page grouped by date with numeric score inputs.
   - `/api/predictions/group/draft`, `/api/predictions/group/confirm`, and `/api/me/predictions`.
   - Dashboard status and read-only confirmed group predictions.
   - Server-side group deadline enforcement from `group_submission_deadline`, defaulting to 2026-06-11 23:59 `America/Sao_Paulo`.

6. Data sync worker - implemented in milestone 6
   - Provider abstraction.
   - Static fixture sync.
   - Live/final score sync.
   - Recalculate scores after final results.
   - `provider_sync_logs` persistence.
   - Worker commands for static data, live match stubs, finished-match
     finalization, official standings stubs, and knockout-open readiness.

7. Knockout predictions - implemented in milestone 7
   - Placeholder detection.
   - Open/close logic.
   - Knockout score and winner/placement form confirmation.

8. Prediction comparison and rules pages - implemented in milestone 8
   - Public comparison page with match-by-match reveal after official final score.
   - Public rules page generated from active scoring config.

9. Admin and deployment - implemented in milestone 9
   - Admin dashboard, match publishing, user management, submissions, scoring, settings, audit, exports.
   - Production Dockerfile and Compose scaffolding implemented for local validation.
   - Caddy route documented for later VPS handoff following the VPS rulebook.
   - Actual VPS deployment, Caddy reload, and service restart are not part of this sprint.

## Production Environment Variables

Required:

- `DATABASE_URL`
- `AUTH_SECRET`
- `APP_URL`
- `NODE_ENV=production`
- `PRIMARY_DATA_PROVIDER`
- `SPORTMONKS_API_TOKEN` if Sportmonks is used
- `FOOTBALL_DATA_API_TOKEN` if football-data.org is used

Optional:

- `ADMIN_USERNAME`
- `ADMIN_DISPLAY_NAME`
- `ADMIN_PASSWORD`
- `PREDICTION_REVEAL_POLICY`
- `LOG_LEVEL`

## Open Decisions

- Whether to require invite codes later; signup starts open by default.

## Acceptance Criteria

- Users can create accounts with unique usernames and log in.
- Users can submit group predictions and cannot alter them after confirmation.
- Knockout prediction form is unavailable until the knockout fixtures are fully defined.
- Users can submit knockout predictions and cannot alter them after confirmation.
- Users can submit champion, runner-up, and third-place picks using the 2022 bolão bonus rules.
- Admins can publish imported/manual matches, manage users, override results, inspect submissions, recompute scores, and review audit logs.
- Homepage shows a live leaderboard.
- Everyone can compare revealed predictions and real results after each match is finished.
- Schedule page updates from a provider-backed sync process.
- Rules page reflects the active scoring configuration.
- Scoring matches the agreed spreadsheet-derived model, including phase-specific knockout weights.
- The production deployment runs behind shared Caddy on `public_proxy` without binding app services to host ports.
