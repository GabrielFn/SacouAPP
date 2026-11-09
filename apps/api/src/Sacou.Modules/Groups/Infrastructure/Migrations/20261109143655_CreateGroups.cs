using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sacou.Modules.Groups.Infrastructure.Migrations
{
    /// <inheritdoc />
    internal partial class CreateGroups : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "groups");

            migrationBuilder.CreateTable(
                name: "groups",
                schema: "groups",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_groups", x => x.id);
                    table.CheckConstraint("ck_groups_name_length", "char_length(name) BETWEEN 1 AND 240");
                });

            migrationBuilder.CreateTable(
                name: "members",
                schema: "groups",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    group_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    role = table.Column<string>(type: "text", nullable: false),
                    member_type = table.Column<string>(type: "text", nullable: false),
                    status = table.Column<string>(type: "text", nullable: false),
                    joined_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    left_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_members", x => x.id);
                    table.CheckConstraint("ck_members_left_at", "(status = 'active') = (left_at IS NULL)");
                    table.CheckConstraint("ck_members_member_type", "member_type IN ('drop_in', 'regular')");
                    table.CheckConstraint("ck_members_role", "role IN ('admin', 'co_admin', 'player', 'scorekeeper')");
                    table.CheckConstraint("ck_members_status", "status IN ('active', 'left', 'removed')");
                    table.ForeignKey(
                        name: "fk_members_groups",
                        column: x => x.group_id,
                        principalSchema: "groups",
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "invites",
                schema: "groups",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    group_id = table.Column<Guid>(type: "uuid", nullable: false),
                    token_hash = table.Column<byte[]>(type: "bytea", nullable: false),
                    created_by_member_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    revoked_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    use_count = table.Column<int>(type: "integer", nullable: false, defaultValue: 0)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_invites", x => x.id);
                    table.CheckConstraint("ck_invites_token_hash_length", "octet_length(token_hash) = 32");
                    table.CheckConstraint("ck_invites_use_count", "use_count >= 0");
                    table.ForeignKey(
                        name: "fk_invites_groups",
                        column: x => x.group_id,
                        principalSchema: "groups",
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_invites_members",
                        column: x => x.created_by_member_id,
                        principalSchema: "groups",
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_invites_created_by_member_id",
                schema: "groups",
                table: "invites",
                column: "created_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_invites_group_id",
                schema: "groups",
                table: "invites",
                column: "group_id");

            migrationBuilder.CreateIndex(
                name: "ux_invites_token_hash",
                schema: "groups",
                table: "invites",
                column: "token_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_members_group_id",
                schema: "groups",
                table: "members",
                column: "group_id");

            migrationBuilder.CreateIndex(
                name: "ix_members_user",
                schema: "groups",
                table: "members",
                column: "user_id",
                filter: "status = 'active'");

            migrationBuilder.CreateIndex(
                name: "ux_members_group_user",
                schema: "groups",
                table: "members",
                columns: new[] { "group_id", "user_id" },
                unique: true,
                filter: "user_id IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "invites",
                schema: "groups");

            migrationBuilder.DropTable(
                name: "members",
                schema: "groups");

            migrationBuilder.DropTable(
                name: "groups",
                schema: "groups");
        }
    }
}
