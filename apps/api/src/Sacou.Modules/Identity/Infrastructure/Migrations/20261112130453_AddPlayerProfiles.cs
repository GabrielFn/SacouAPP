using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sacou.Modules.Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    internal partial class AddPlayerProfiles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "player_profiles",
                schema: "identity",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    nickname = table.Column<string>(type: "text", nullable: false),
                    primary_position = table.Column<string>(type: "text", nullable: true),
                    other_positions = table.Column<string[]>(type: "text[]", nullable: false, defaultValueSql: "'{}'"),
                    suggested_level_tenths = table.Column<short>(type: "smallint", nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_player_profiles", x => x.user_id);
                    table.CheckConstraint("ck_player_profiles_nickname_length", "char_length(nickname) BETWEEN 1 AND 80");
                    table.CheckConstraint("ck_player_profiles_other_positions", "other_positions <@ ARRAY['libero', 'middle_blocker', 'opposite', 'outside_hitter', 'setter']::text[]");
                    table.CheckConstraint("ck_player_profiles_other_positions_count", "cardinality(other_positions) <= 4");
                    table.CheckConstraint("ck_player_profiles_primary_position", "primary_position IS NULL OR primary_position IN ('any', 'libero', 'middle_blocker', 'opposite', 'outside_hitter', 'setter')");
                    table.CheckConstraint("ck_player_profiles_suggested_level", "suggested_level_tenths IS NULL OR (suggested_level_tenths BETWEEN 10 AND 50 AND suggested_level_tenths % 5 = 0)");
                    table.ForeignKey(
                        name: "fk_player_profiles_users",
                        column: x => x.user_id,
                        principalSchema: "identity",
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "player_profiles",
                schema: "identity");
        }
    }
}
