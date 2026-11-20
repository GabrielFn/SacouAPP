using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sacou.Modules.Matches.Infrastructure.Migrations
{
    /// <inheritdoc />
    internal partial class AddCourtSessionsGroupIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "ix_court_sessions_group",
                schema: "matches",
                table: "court_sessions",
                column: "group_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_court_sessions_group",
                schema: "matches",
                table: "court_sessions");
        }
    }
}
