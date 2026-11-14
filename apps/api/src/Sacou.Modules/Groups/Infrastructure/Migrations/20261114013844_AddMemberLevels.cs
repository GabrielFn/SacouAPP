using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sacou.Modules.Groups.Infrastructure.Migrations
{
    /// <inheritdoc />
    internal partial class AddMemberLevels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "member_levels",
                schema: "groups",
                columns: table => new
                {
                    member_id = table.Column<Guid>(type: "uuid", nullable: false),
                    group_id = table.Column<Guid>(type: "uuid", nullable: false),
                    level_tenths = table.Column<short>(type: "smallint", nullable: true),
                    set_by_member_id = table.Column<Guid>(type: "uuid", nullable: false),
                    set_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_member_levels", x => x.member_id);
                    table.CheckConstraint("ck_member_levels_level", "level_tenths IS NULL OR (level_tenths BETWEEN 10 AND 50 AND level_tenths % 5 = 0)");
                    table.ForeignKey(
                        name: "fk_member_levels_groups",
                        column: x => x.group_id,
                        principalSchema: "groups",
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_member_levels_members",
                        column: x => x.member_id,
                        principalSchema: "groups",
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_member_levels_set_by",
                        column: x => x.set_by_member_id,
                        principalSchema: "groups",
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_member_levels_group",
                schema: "groups",
                table: "member_levels",
                column: "group_id");

            migrationBuilder.CreateIndex(
                name: "ix_member_levels_set_by_member_id",
                schema: "groups",
                table: "member_levels",
                column: "set_by_member_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "member_levels",
                schema: "groups");
        }
    }
}
