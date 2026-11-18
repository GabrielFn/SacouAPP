using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sacou.Modules.Matches.Infrastructure.Migrations
{
    /// <inheritdoc />
    internal partial class CreateCourtSessions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "matches");

            migrationBuilder.CreateTable(
                name: "court_sessions",
                schema: "matches",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    group_id = table.Column<Guid>(type: "uuid", nullable: false),
                    round_id = table.Column<Guid>(type: "uuid", nullable: false),
                    current_batch = table.Column<long>(type: "bigint", nullable: false),
                    event_count = table.Column<int>(type: "integer", nullable: false),
                    envelope_bytes = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    last_event_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    open_match_id = table.Column<Guid>(type: "uuid", nullable: true),
                    set_number = table.Column<int>(type: "integer", nullable: true),
                    points_a = table.Column<int>(type: "integer", nullable: true),
                    points_b = table.Column<int>(type: "integer", nullable: true),
                    sets_a = table.Column<int>(type: "integer", nullable: true),
                    sets_b = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_court_sessions", x => x.id);
                    table.CheckConstraint("ck_court_sessions_current_batch", "current_batch >= 1");
                    table.CheckConstraint("ck_court_sessions_envelope_bytes", "envelope_bytes BETWEEN 0 AND 8388608");
                    table.CheckConstraint("ck_court_sessions_event_count", "event_count BETWEEN 0 AND 20000");
                });

            migrationBuilder.CreateTable(
                name: "court_events",
                schema: "matches",
                columns: table => new
                {
                    court_session_id = table.Column<Guid>(type: "uuid", nullable: false),
                    position = table.Column<int>(type: "integer", nullable: false),
                    event_id = table.Column<Guid>(type: "uuid", nullable: false),
                    batch = table.Column<long>(type: "bigint", nullable: false),
                    sequence = table.Column<long>(type: "bigint", nullable: false),
                    device_id = table.Column<Guid>(type: "uuid", nullable: false),
                    schema_version = table.Column<long>(type: "bigint", nullable: false),
                    type = table.Column<string>(type: "text", nullable: false),
                    match_id = table.Column<Guid>(type: "uuid", nullable: true),
                    envelope = table.Column<string>(type: "text", nullable: false),
                    received_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_court_events", x => new { x.court_session_id, x.position });
                    table.CheckConstraint("ck_court_events_envelope", "octet_length(envelope) <= 16384");
                    table.CheckConstraint("ck_court_events_position", "position >= 1");
                    table.CheckConstraint("ck_court_events_type", "octet_length(type) <= 64");
                    table.ForeignKey(
                        name: "fk_court_events_court_sessions",
                        column: x => x.court_session_id,
                        principalSchema: "matches",
                        principalTable: "court_sessions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "court_writers",
                schema: "matches",
                columns: table => new
                {
                    court_session_id = table.Column<Guid>(type: "uuid", nullable: false),
                    batch = table.Column<long>(type: "bigint", nullable: false),
                    device_id = table.Column<Guid>(type: "uuid", nullable: false),
                    member_id = table.Column<Guid>(type: "uuid", nullable: false),
                    events_before = table.Column<long>(type: "bigint", nullable: false),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_court_writers", x => new { x.court_session_id, x.batch });
                    table.CheckConstraint("ck_court_writers_batch", "batch >= 1");
                    table.CheckConstraint("ck_court_writers_events_before", "events_before BETWEEN 0 AND 20000");
                    table.ForeignKey(
                        name: "fk_court_writers_court_sessions",
                        column: x => x.court_session_id,
                        principalSchema: "matches",
                        principalTable: "court_sessions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ux_court_events_batch_sequence_device",
                schema: "matches",
                table: "court_events",
                columns: new[] { "court_session_id", "batch", "sequence", "device_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_court_events_event_id",
                schema: "matches",
                table: "court_events",
                columns: new[] { "court_session_id", "event_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_court_sessions_round",
                schema: "matches",
                table: "court_sessions",
                column: "round_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_court_writers_member",
                schema: "matches",
                table: "court_writers",
                column: "member_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "court_events",
                schema: "matches");

            migrationBuilder.DropTable(
                name: "court_writers",
                schema: "matches");

            migrationBuilder.DropTable(
                name: "court_sessions",
                schema: "matches");
        }
    }
}
