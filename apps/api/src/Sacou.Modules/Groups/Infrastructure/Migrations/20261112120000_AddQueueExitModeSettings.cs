using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sacou.Modules.Groups.Infrastructure.Migrations
{
    /// <summary>
    /// The queue modes of E2.12 (ADR 0050) add four leaves to the <c>queue</c> block of the catalog. A document
    /// saved before them would be refused as <c>settings.missing-field</c>, so each one gets the defaults of the
    /// catalog, keeping any leaf it already has. The <c>schemaVersion</c> does not change: the leaves are new.
    /// Data only, so there is no target model: the schema and the model snapshot stay as they were.
    /// </summary>
    [DbContext(typeof(GroupsDbContext))]
    [Migration("20261112120000_AddQueueExitModeSettings")]
    internal sealed class AddQueueExitModeSettings : Migration
    {
        private const string QueueDefaults =
            "'{\"exitMode\": \"automatic\", \"fixedExitCount\": 2, \"winnerExitEnabled\": false, \"winnerExitWins\": 3}'::jsonb";

        private const string QueueLeaves = "ARRAY['exitMode', 'fixedExitCount', 'winnerExitEnabled', 'winnerExitWins']";

        private static readonly string[] Tables = ["group_settings", "saved_templates"];

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            foreach (var table in Tables)
            {
                migrationBuilder.Sql(
                    $"UPDATE groups.{table} SET settings = jsonb_set(settings, '{{queue}}', {QueueDefaults} || (settings -> 'queue')) "
                    + "WHERE jsonb_typeof(settings -> 'queue') = 'object';");
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            foreach (var table in Tables)
            {
                migrationBuilder.Sql(
                    $"UPDATE groups.{table} SET settings = jsonb_set(settings, '{{queue}}', (settings -> 'queue') - {QueueLeaves}) "
                    + "WHERE jsonb_typeof(settings -> 'queue') = 'object';");
            }
        }
    }
}
