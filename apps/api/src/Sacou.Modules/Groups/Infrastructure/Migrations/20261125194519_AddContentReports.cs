using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sacou.Modules.Groups.Infrastructure.Migrations
{
    /// <inheritdoc />
    internal partial class AddContentReports : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "content_reports",
                schema: "groups",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    group_id = table.Column<Guid>(type: "uuid", nullable: false),
                    reporter_member_id = table.Column<Guid>(type: "uuid", nullable: false),
                    reported_member_id = table.Column<Guid>(type: "uuid", nullable: true),
                    reason = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_content_reports", x => x.id);
                    table.CheckConstraint("ck_content_reports_reason", "reason IN ('hate_or_sexual', 'impersonation', 'offensive_name', 'spam')");
                    table.ForeignKey(
                        name: "fk_content_reports_groups",
                        column: x => x.group_id,
                        principalSchema: "groups",
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_content_reports_reported",
                        column: x => x.reported_member_id,
                        principalSchema: "groups",
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_content_reports_reporter",
                        column: x => x.reporter_member_id,
                        principalSchema: "groups",
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_content_reports_created_at",
                schema: "groups",
                table: "content_reports",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "ix_content_reports_reported",
                schema: "groups",
                table: "content_reports",
                column: "reported_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_content_reports_reporter",
                schema: "groups",
                table: "content_reports",
                column: "reporter_member_id");

            migrationBuilder.CreateIndex(
                name: "ux_content_reports_once",
                schema: "groups",
                table: "content_reports",
                columns: new[] { "group_id", "reporter_member_id", "reported_member_id", "reason" },
                unique: true)
                .Annotation("Npgsql:NullsDistinct", false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "content_reports",
                schema: "groups");
        }
    }
}
