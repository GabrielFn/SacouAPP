using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sacou.Modules.Sessions.Infrastructure.Migrations
{
    /// <inheritdoc />
    internal partial class AddRoundLinkAndChannel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "link_code",
                schema: "sessions",
                table: "rounds",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "channel",
                schema: "sessions",
                table: "attendances",
                type: "text",
                nullable: false,
                defaultValue: "app");

            migrationBuilder.CreateIndex(
                name: "ux_rounds_link_code",
                schema: "sessions",
                table: "rounds",
                column: "link_code",
                unique: true,
                filter: "link_code IS NOT NULL");

            migrationBuilder.AddCheckConstraint(
                name: "ck_rounds_link_code",
                schema: "sessions",
                table: "rounds",
                sql: "link_code ~ '^[A-Za-z0-9_-]{22}$'");

            migrationBuilder.AddCheckConstraint(
                name: "ck_attendances_channel",
                schema: "sessions",
                table: "attendances",
                sql: "channel IN ('app', 'web')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ux_rounds_link_code",
                schema: "sessions",
                table: "rounds");

            migrationBuilder.DropCheckConstraint(
                name: "ck_rounds_link_code",
                schema: "sessions",
                table: "rounds");

            migrationBuilder.DropCheckConstraint(
                name: "ck_attendances_channel",
                schema: "sessions",
                table: "attendances");

            migrationBuilder.DropColumn(
                name: "link_code",
                schema: "sessions",
                table: "rounds");

            migrationBuilder.DropColumn(
                name: "channel",
                schema: "sessions",
                table: "attendances");
        }
    }
}
