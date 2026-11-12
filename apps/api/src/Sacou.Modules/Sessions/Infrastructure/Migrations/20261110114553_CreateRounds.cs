using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sacou.Modules.Sessions.Infrastructure.Migrations
{
    /// <inheritdoc />
    internal partial class CreateRounds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "sessions");

            migrationBuilder.CreateTable(
                name: "round_series",
                schema: "sessions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    group_id = table.Column<Guid>(type: "uuid", nullable: false),
                    weekday = table.Column<short>(type: "smallint", nullable: false),
                    local_time = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    venue = table.Column<string>(type: "text", nullable: false),
                    time_zone = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    stopped_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_round_series", x => x.id);
                    table.CheckConstraint("ck_round_series_time_zone", "time_zone IN ('America/Sao_Paulo')");
                    table.CheckConstraint("ck_round_series_venue", "char_length(venue) <= 320");
                    table.CheckConstraint("ck_round_series_weekday", "weekday BETWEEN 1 AND 7");
                });

            migrationBuilder.CreateTable(
                name: "rounds",
                schema: "sessions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    group_id = table.Column<Guid>(type: "uuid", nullable: false),
                    series_id = table.Column<Guid>(type: "uuid", nullable: true),
                    local_date = table.Column<DateOnly>(type: "date", nullable: false),
                    local_time = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    time_zone = table.Column<string>(type: "text", nullable: false),
                    starts_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    venue = table.Column<string>(type: "text", nullable: false),
                    settings_layer = table.Column<string>(type: "jsonb", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    next_sequence = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_rounds", x => x.id);
                    table.CheckConstraint("ck_rounds_next_sequence", "next_sequence >= 1");
                    table.CheckConstraint("ck_rounds_settings_layer", "settings_layer IS NULL OR (jsonb_typeof(settings_layer) = 'object' AND octet_length(settings_layer::text) <= 4096)");
                    table.CheckConstraint("ck_rounds_status", "status IN ('canceled', 'scheduled')");
                    table.CheckConstraint("ck_rounds_time_zone", "time_zone IN ('America/Sao_Paulo')");
                    table.CheckConstraint("ck_rounds_venue", "char_length(venue) <= 320");
                    table.ForeignKey(
                        name: "fk_rounds_round_series",
                        column: x => x.series_id,
                        principalSchema: "sessions",
                        principalTable: "round_series",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "attendances",
                schema: "sessions",
                columns: table => new
                {
                    round_id = table.Column<Guid>(type: "uuid", nullable: false),
                    member_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "text", nullable: false),
                    sequence = table.Column<int>(type: "integer", nullable: false),
                    source = table.Column<string>(type: "text", nullable: false),
                    responded_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    promoted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_attendances", x => new { x.round_id, x.member_id });
                    table.CheckConstraint("ck_attendances_promoted_at", "(status = 'promoted') = (promoted_at IS NOT NULL)");
                    table.CheckConstraint("ck_attendances_sequence", "sequence >= 1");
                    table.CheckConstraint("ck_attendances_source", "source IN ('admin', 'regular', 'self')");
                    table.CheckConstraint("ck_attendances_status", "status IN ('going', 'not_going', 'promoted', 'waitlisted')");
                    table.ForeignKey(
                        name: "fk_attendances_rounds",
                        column: x => x.round_id,
                        principalSchema: "sessions",
                        principalTable: "rounds",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ux_attendances_round_sequence",
                schema: "sessions",
                table: "attendances",
                columns: new[] { "round_id", "sequence" },
                unique: true,
                filter: "status <> 'not_going'");

            migrationBuilder.CreateIndex(
                name: "ix_round_series_group_id",
                schema: "sessions",
                table: "round_series",
                column: "group_id");

            migrationBuilder.CreateIndex(
                name: "ix_rounds_group_starts_at",
                schema: "sessions",
                table: "rounds",
                columns: new[] { "group_id", "starts_at" });

            migrationBuilder.CreateIndex(
                name: "ux_rounds_series_date",
                schema: "sessions",
                table: "rounds",
                columns: new[] { "series_id", "local_date" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "attendances",
                schema: "sessions");

            migrationBuilder.DropTable(
                name: "rounds",
                schema: "sessions");

            migrationBuilder.DropTable(
                name: "round_series",
                schema: "sessions");
        }
    }
}
