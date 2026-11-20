using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sacou.Modules.Stats.Infrastructure.Migrations
{
    /// <inheritdoc />
    internal partial class CreateMvpResults : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "mvp_results",
                schema: "stats",
                columns: table => new
                {
                    round_id = table.Column<Guid>(type: "uuid", nullable: false),
                    group_id = table.Column<Guid>(type: "uuid", nullable: false),
                    winner_member_ids = table.Column<Guid[]>(type: "uuid[]", nullable: false),
                    voters = table.Column<int>(type: "integer", nullable: false),
                    tallied_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_mvp_results", x => x.round_id);
                    table.CheckConstraint("ck_mvp_results_voters", "voters >= 0");
                });

            migrationBuilder.CreateIndex(
                name: "ix_mvp_results_group",
                schema: "stats",
                table: "mvp_results",
                column: "group_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "mvp_results",
                schema: "stats");
        }
    }
}
