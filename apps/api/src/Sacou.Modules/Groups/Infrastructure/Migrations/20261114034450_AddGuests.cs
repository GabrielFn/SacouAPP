using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sacou.Modules.Groups.Infrastructure.Migrations
{
    /// <inheritdoc />
    internal partial class AddGuests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "guests",
                schema: "groups",
                columns: table => new
                {
                    member_id = table.Column<Guid>(type: "uuid", nullable: false),
                    group_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    primary_position = table.Column<string>(type: "text", nullable: true),
                    request_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_guests", x => x.member_id);
                    table.CheckConstraint("ck_guests_name", "char_length(name) BETWEEN 1 AND 80");
                    table.CheckConstraint("ck_guests_primary_position", "primary_position IS NULL OR primary_position IN ('libero', 'middleBlocker', 'opposite', 'outsideHitter', 'setter')");
                    table.ForeignKey(
                        name: "fk_guests_groups",
                        column: x => x.group_id,
                        principalSchema: "groups",
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_guests_members",
                        column: x => x.member_id,
                        principalSchema: "groups",
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ux_guests_group_request",
                schema: "groups",
                table: "guests",
                columns: new[] { "group_id", "request_id" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "guests",
                schema: "groups");
        }
    }
}
