using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sacou.Modules.Matches.Infrastructure.Migrations
{
    /// <inheritdoc />
    internal partial class AddCourtTakeover : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_court_writers_batch",
                schema: "matches",
                table: "court_writers");

            migrationBuilder.DropCheckConstraint(
                name: "ck_court_sessions_current_batch",
                schema: "matches",
                table: "court_sessions");

            migrationBuilder.AddCheckConstraint(
                name: "ck_court_writers_batch",
                schema: "matches",
                table: "court_writers",
                sql: "batch BETWEEN 1 AND 40");

            migrationBuilder.AddCheckConstraint(
                name: "ck_court_sessions_current_batch",
                schema: "matches",
                table: "court_sessions",
                sql: "current_batch BETWEEN 1 AND 40");

            migrationBuilder.AddCheckConstraint(
                name: "ck_court_sessions_scoreboard",
                schema: "matches",
                table: "court_sessions",
                sql: "num_nulls(open_match_id, set_number, points_a, points_b, sets_a, sets_b) IN (0, 6)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_court_writers_batch",
                schema: "matches",
                table: "court_writers");

            migrationBuilder.DropCheckConstraint(
                name: "ck_court_sessions_current_batch",
                schema: "matches",
                table: "court_sessions");

            migrationBuilder.DropCheckConstraint(
                name: "ck_court_sessions_scoreboard",
                schema: "matches",
                table: "court_sessions");

            migrationBuilder.AddCheckConstraint(
                name: "ck_court_writers_batch",
                schema: "matches",
                table: "court_writers",
                sql: "batch >= 1");

            migrationBuilder.AddCheckConstraint(
                name: "ck_court_sessions_current_batch",
                schema: "matches",
                table: "court_sessions",
                sql: "current_batch >= 1");
        }
    }
}
