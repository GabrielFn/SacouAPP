using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sacou.Modules.Stats.Infrastructure.Migrations
{
    /// <inheritdoc />
    internal partial class CreateMvpVotes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "mvp_votes",
                schema: "stats",
                columns: table => new
                {
                    round_id = table.Column<Guid>(type: "uuid", nullable: false),
                    voter_member_id = table.Column<Guid>(type: "uuid", nullable: false),
                    group_id = table.Column<Guid>(type: "uuid", nullable: false),
                    candidate_member_id = table.Column<Guid>(type: "uuid", nullable: false),
                    cast_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_mvp_votes", x => new { x.round_id, x.voter_member_id });
                    table.CheckConstraint("ck_mvp_votes_not_self", "voter_member_id <> candidate_member_id");
                });

            migrationBuilder.CreateIndex(
                name: "ix_mvp_votes_voter",
                schema: "stats",
                table: "mvp_votes",
                column: "voter_member_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "mvp_votes",
                schema: "stats");
        }
    }
}
