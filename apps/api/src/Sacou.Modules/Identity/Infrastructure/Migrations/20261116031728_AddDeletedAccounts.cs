using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sacou.Modules.Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    internal partial class AddDeletedAccounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "deleted_accounts",
                schema: "identity",
                columns: table => new
                {
                    subject_hash = table.Column<byte[]>(type: "bytea", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_deleted_accounts", x => x.subject_hash);
                    table.CheckConstraint("ck_deleted_accounts_subject_hash_length", "octet_length(subject_hash) = 32");
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "deleted_accounts",
                schema: "identity");
        }
    }
}
