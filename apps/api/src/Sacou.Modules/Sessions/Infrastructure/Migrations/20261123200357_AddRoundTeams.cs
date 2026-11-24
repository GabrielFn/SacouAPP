using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sacou.Modules.Sessions.Infrastructure.Migrations
{
    /// <inheritdoc />
    internal partial class AddRoundTeams : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "teams_confirmed_at",
                schema: "sessions",
                table: "rounds",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "round_teams",
                schema: "sessions",
                columns: table => new
                {
                    round_id = table.Column<Guid>(type: "uuid", nullable: false),
                    member_id = table.Column<Guid>(type: "uuid", nullable: false),
                    team_number = table.Column<short>(type: "smallint", nullable: true),
                    position = table.Column<short>(type: "smallint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_round_teams", x => new { x.round_id, x.member_id });
                    table.CheckConstraint("ck_round_teams_position", "position >= 1");
                    table.CheckConstraint("ck_round_teams_team_number", "team_number IS NULL OR team_number >= 1");
                    table.ForeignKey(
                        name: "fk_round_teams_rounds",
                        column: x => x.round_id,
                        principalSchema: "sessions",
                        principalTable: "rounds",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_round_teams_member",
                schema: "sessions",
                table: "round_teams",
                column: "member_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "round_teams",
                schema: "sessions");

            migrationBuilder.DropColumn(
                name: "teams_confirmed_at",
                schema: "sessions",
                table: "rounds");
        }
    }
}
