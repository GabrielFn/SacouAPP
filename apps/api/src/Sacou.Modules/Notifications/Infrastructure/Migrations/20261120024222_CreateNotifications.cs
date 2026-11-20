using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sacou.Modules.Notifications.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CreateNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "notifications");

            migrationBuilder.CreateTable(
                name: "notifications",
                schema: "notifications",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    dedupe_key = table.Column<string>(type: "text", nullable: false),
                    kind = table.Column<string>(type: "text", nullable: false),
                    member_id = table.Column<Guid>(type: "uuid", nullable: false),
                    group_id = table.Column<Guid>(type: "uuid", nullable: false),
                    round_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    read_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_notifications", x => x.id);
                    table.CheckConstraint("ck_notifications_dedupe_key", "char_length(dedupe_key) <= 200");
                    table.CheckConstraint("ck_notifications_kind", "kind IN ('waitlist_promoted')");
                });

            migrationBuilder.CreateTable(
                name: "push_devices",
                schema: "notifications",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    installation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    expo_token = table.Column<string>(type: "text", nullable: false),
                    platform = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    last_seen_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    disabled_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    disabled_reason = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_push_devices", x => x.id);
                    table.CheckConstraint("ck_push_devices_disabled", "(disabled_at IS NULL) = (disabled_reason IS NULL) AND (disabled_reason IS NULL OR disabled_reason IN ('not_registered', 'over_device_limit'))");
                    table.CheckConstraint("ck_push_devices_platform", "platform IN ('android', 'ios')");
                    table.CheckConstraint("ck_push_devices_token", "char_length(expo_token) <= 200");
                });

            migrationBuilder.CreateTable(
                name: "push_deliveries",
                schema: "notifications",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    notification_id = table.Column<Guid>(type: "uuid", nullable: false),
                    device_id = table.Column<Guid>(type: "uuid", nullable: false),
                    state = table.Column<string>(type: "text", nullable: false),
                    attempts = table.Column<int>(type: "integer", nullable: false),
                    next_attempt_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    lease_until = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ticket_id = table.Column<string>(type: "text", nullable: true),
                    error_code = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_push_deliveries", x => x.id);
                    table.CheckConstraint("ck_push_deliveries_attempts", "attempts >= 0");
                    table.CheckConstraint("ck_push_deliveries_state", "state IN ('delivered', 'expired', 'failed', 'pending', 'sending', 'sent', 'unknown')");
                    table.ForeignKey(
                        name: "fk_push_deliveries_notifications",
                        column: x => x.notification_id,
                        principalSchema: "notifications",
                        principalTable: "notifications",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_push_deliveries_push_devices",
                        column: x => x.device_id,
                        principalSchema: "notifications",
                        principalTable: "push_devices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_notifications_member_created",
                schema: "notifications",
                table: "notifications",
                columns: new[] { "member_id", "created_at", "id" },
                descending: new[] { false, true, true });

            migrationBuilder.CreateIndex(
                name: "ux_notifications_dedupe_key",
                schema: "notifications",
                table: "notifications",
                column: "dedupe_key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_push_deliveries_device",
                schema: "notifications",
                table: "push_deliveries",
                column: "device_id");

            migrationBuilder.CreateIndex(
                name: "ix_push_deliveries_open",
                schema: "notifications",
                table: "push_deliveries",
                columns: new[] { "state", "next_attempt_at" },
                filter: "state IN ('pending', 'sending')");

            migrationBuilder.CreateIndex(
                name: "ux_push_deliveries_notification_device",
                schema: "notifications",
                table: "push_deliveries",
                columns: new[] { "notification_id", "device_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_push_devices_expo_token",
                schema: "notifications",
                table: "push_devices",
                column: "expo_token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_push_devices_user_installation",
                schema: "notifications",
                table: "push_devices",
                columns: new[] { "user_id", "installation_id" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "push_deliveries",
                schema: "notifications");

            migrationBuilder.DropTable(
                name: "notifications",
                schema: "notifications");

            migrationBuilder.DropTable(
                name: "push_devices",
                schema: "notifications");
        }
    }
}
