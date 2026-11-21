using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sacou.Modules.Sessions.Infrastructure.Migrations
{
    /// <inheritdoc />
    internal partial class AddOutboxSetAside : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_outbox_messages_unprocessed",
                schema: "sessions",
                table: "outbox_messages");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "set_aside_at",
                schema: "sessions",
                table: "outbox_messages",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_outbox_messages_unprocessed",
                schema: "sessions",
                table: "outbox_messages",
                columns: new[] { "occurred_at", "id" },
                filter: "processed_at IS NULL AND set_aside_at IS NULL");

            migrationBuilder.AddCheckConstraint(
                name: "ck_outbox_messages_one_end",
                schema: "sessions",
                table: "outbox_messages",
                sql: "processed_at IS NULL OR set_aside_at IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_outbox_messages_unprocessed",
                schema: "sessions",
                table: "outbox_messages");

            migrationBuilder.DropCheckConstraint(
                name: "ck_outbox_messages_one_end",
                schema: "sessions",
                table: "outbox_messages");

            migrationBuilder.DropColumn(
                name: "set_aside_at",
                schema: "sessions",
                table: "outbox_messages");

            migrationBuilder.CreateIndex(
                name: "ix_outbox_messages_unprocessed",
                schema: "sessions",
                table: "outbox_messages",
                columns: new[] { "occurred_at", "id" },
                filter: "processed_at IS NULL");
        }
    }
}
