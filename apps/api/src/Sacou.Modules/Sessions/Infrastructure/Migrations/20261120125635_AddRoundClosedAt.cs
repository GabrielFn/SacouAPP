using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sacou.Modules.Sessions.Infrastructure.Migrations
{
    /// <inheritdoc />
    internal partial class AddRoundClosedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "closed_at",
                schema: "sessions",
                table: "rounds",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "closed_at",
                schema: "sessions",
                table: "rounds");
        }
    }
}
