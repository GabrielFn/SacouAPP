using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sacou.Modules.Stats.Infrastructure.Migrations
{
    /// <inheritdoc />
    internal partial class CreateStatsProjections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "stats");

            migrationBuilder.CreateTable(
                name: "rating_pools",
                schema: "stats",
                columns: table => new
                {
                    group_id = table.Column<Guid>(type: "uuid", nullable: false),
                    pool = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    inputs_hash = table.Column<string>(type: "character(64)", fixedLength: true, maxLength: 64, nullable: false),
                    params_version = table.Column<int>(type: "integer", nullable: false),
                    rebuilt_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_rating_pools", x => new { x.group_id, x.pool });
                    table.CheckConstraint("ck_rating_pools_pool", "pool IN ('indoor', 'beach')");
                });

            migrationBuilder.CreateTable(
                name: "round_projections",
                schema: "stats",
                columns: table => new
                {
                    round_id = table.Column<Guid>(type: "uuid", nullable: false),
                    group_id = table.Column<Guid>(type: "uuid", nullable: false),
                    court_session_id = table.Column<Guid>(type: "uuid", nullable: false),
                    event_count = table.Column<int>(type: "integer", nullable: false),
                    projection_version = table.Column<int>(type: "integer", nullable: false),
                    facts_hash = table.Column<string>(type: "character(64)", fixedLength: true, maxLength: 64, nullable: false),
                    starts_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    local_date = table.Column<DateOnly>(type: "date", nullable: false),
                    counts = table.Column<bool>(type: "boolean", nullable: false),
                    modality = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    finished_matches = table.Column<int>(type: "integer", nullable: false),
                    summary = table.Column<string>(type: "jsonb", nullable: false),
                    rebuilt_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_round_projections", x => x.round_id);
                    table.CheckConstraint("ck_round_projections_event_count", "event_count >= 0");
                    table.CheckConstraint("ck_round_projections_finished_matches", "finished_matches >= 0");
                    table.CheckConstraint("ck_round_projections_modality", "modality IN ('indoor-6x6', 'beach-2x2', 'beach-4x4')");
                });

            migrationBuilder.CreateTable(
                name: "member_ratings",
                schema: "stats",
                columns: table => new
                {
                    group_id = table.Column<Guid>(type: "uuid", nullable: false),
                    pool = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    member_id = table.Column<Guid>(type: "uuid", nullable: false),
                    mu = table.Column<double>(type: "double precision", nullable: false),
                    sigma = table.Column<double>(type: "double precision", nullable: false),
                    seed_tenths = table.Column<int>(type: "integer", nullable: false),
                    seed_source = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    matches_rated = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_member_ratings", x => new { x.group_id, x.pool, x.member_id });
                    table.CheckConstraint("ck_member_ratings_matches_rated", "matches_rated >= 0");
                    table.CheckConstraint("ck_member_ratings_pool", "pool IN ('indoor', 'beach')");
                    table.CheckConstraint("ck_member_ratings_seed_source", "seed_source IN ('admin', 'suggested', 'default')");
                    table.CheckConstraint("ck_member_ratings_seed_tenths", "seed_tenths BETWEEN 10 AND 50");
                    table.ForeignKey(
                        name: "fk_member_ratings_rating_pools",
                        columns: x => new { x.group_id, x.pool },
                        principalSchema: "stats",
                        principalTable: "rating_pools",
                        principalColumns: new[] { "group_id", "pool" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "round_member_stats",
                schema: "stats",
                columns: table => new
                {
                    round_id = table.Column<Guid>(type: "uuid", nullable: false),
                    member_id = table.Column<Guid>(type: "uuid", nullable: false),
                    group_id = table.Column<Guid>(type: "uuid", nullable: false),
                    starts_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    local_date = table.Column<DateOnly>(type: "date", nullable: false),
                    matches_played = table.Column<int>(type: "integer", nullable: false),
                    wins = table.Column<int>(type: "integer", nullable: false),
                    losses = table.Column<int>(type: "integer", nullable: false),
                    undecided = table.Column<int>(type: "integer", nullable: false),
                    plus_minus = table.Column<int>(type: "integer", nullable: false),
                    longest_win_streak = table.Column<int>(type: "integer", nullable: false),
                    results = table.Column<string>(type: "text", nullable: false),
                    was_mvp = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_round_member_stats", x => new { x.round_id, x.member_id });
                    table.CheckConstraint("ck_round_member_stats_counts", "matches_played >= 0 AND wins >= 0 AND losses >= 0 AND undecided >= 0");
                    table.CheckConstraint("ck_round_member_stats_results", "results ~ '^[wlu]*$' AND length(results) = matches_played");
                    table.ForeignKey(
                        name: "fk_round_member_stats_round_projections",
                        column: x => x.round_id,
                        principalSchema: "stats",
                        principalTable: "round_projections",
                        principalColumn: "round_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_round_member_stats_group",
                schema: "stats",
                table: "round_member_stats",
                column: "group_id");

            migrationBuilder.CreateIndex(
                name: "ix_round_member_stats_member",
                schema: "stats",
                table: "round_member_stats",
                column: "member_id");

            migrationBuilder.CreateIndex(
                name: "ix_round_projections_group",
                schema: "stats",
                table: "round_projections",
                column: "group_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "member_ratings",
                schema: "stats");

            migrationBuilder.DropTable(
                name: "round_member_stats",
                schema: "stats");

            migrationBuilder.DropTable(
                name: "rating_pools",
                schema: "stats");

            migrationBuilder.DropTable(
                name: "round_projections",
                schema: "stats");
        }
    }
}
