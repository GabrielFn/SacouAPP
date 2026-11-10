using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sacou.Modules.Groups.Infrastructure.Migrations
{
    /// <inheritdoc />
    internal partial class AddGroupSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "group_settings",
                schema: "groups",
                columns: table => new
                {
                    group_id = table.Column<Guid>(type: "uuid", nullable: false),
                    schema_version = table.Column<short>(type: "smallint", nullable: false),
                    settings = table.Column<string>(type: "jsonb", nullable: false),
                    template_key = table.Column<string>(type: "text", nullable: true),
                    saved_template_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_by_member_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_group_settings", x => x.group_id);
                    table.CheckConstraint("ck_group_settings_document", "jsonb_typeof(settings) = 'object' AND octet_length(settings::text) <= 8192");
                    table.CheckConstraint("ck_group_settings_one_template", "NOT (template_key IS NOT NULL AND saved_template_id IS NOT NULL)");
                    table.CheckConstraint("ck_group_settings_schema_version", "schema_version = 1");
                    table.CheckConstraint("ck_group_settings_template_key", "template_key IN ('pelada', 'racha-organizado', 'treino', 'areia-rei-da-quadra', 'do-zero')");
                    table.ForeignKey(
                        name: "fk_group_settings_groups",
                        column: x => x.group_id,
                        principalSchema: "groups",
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_group_settings_members",
                        column: x => x.updated_by_member_id,
                        principalSchema: "groups",
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "saved_templates",
                schema: "groups",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    group_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    schema_version = table.Column<short>(type: "smallint", nullable: false),
                    settings = table.Column<string>(type: "jsonb", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_by_member_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_saved_templates", x => x.id);
                    table.CheckConstraint("ck_saved_templates_document", "jsonb_typeof(settings) = 'object' AND octet_length(settings::text) <= 8192");
                    table.CheckConstraint("ck_saved_templates_name_length", "char_length(name) BETWEEN 1 AND 160");
                    table.CheckConstraint("ck_saved_templates_schema_version", "schema_version = 1");
                    table.ForeignKey(
                        name: "fk_saved_templates_groups",
                        column: x => x.group_id,
                        principalSchema: "groups",
                        principalTable: "groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_saved_templates_members",
                        column: x => x.created_by_member_id,
                        principalSchema: "groups",
                        principalTable: "members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_group_settings_updated_by_member_id",
                schema: "groups",
                table: "group_settings",
                column: "updated_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_saved_templates_created_by_member_id",
                schema: "groups",
                table: "saved_templates",
                column: "created_by_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_saved_templates_group",
                schema: "groups",
                table: "saved_templates",
                column: "group_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "group_settings",
                schema: "groups");

            migrationBuilder.DropTable(
                name: "saved_templates",
                schema: "groups");
        }
    }
}
