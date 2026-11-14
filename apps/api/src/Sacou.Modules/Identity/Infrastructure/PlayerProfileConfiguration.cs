using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sacou.Modules.Identity.Domain.Profiles;
using Sacou.Modules.Identity.Domain.Users;
using Sacou.Shared.Levels;

namespace Sacou.Modules.Identity.Infrastructure;

/// <summary>
/// <c>identity.player_profiles</c>: six columns and nothing else (ADR 0051, D1). Its own table, not columns of
/// <c>identity.users</c>, which is the row of the login. Deleted with the user (same module, so the foreign key
/// is allowed). A new column changes docs/seguranca/dados-pessoais.md and the model test.
/// </summary>
internal sealed class PlayerProfileConfiguration : IEntityTypeConfiguration<PlayerProfileRow>
{
    public const string Table = "player_profiles";
    public const string UserIdColumn = "user_id";
    public const string NicknameColumn = "nickname";
    public const string PrimaryPositionColumn = "primary_position";
    public const string OtherPositionsColumn = "other_positions";
    public const string SuggestedLevelColumn = "suggested_level_tenths";
    public const string UpdatedAtColumn = "updated_at";

    private const string EmptyTextArray = "'{}'";

    public void Configure(EntityTypeBuilder<PlayerProfileRow> builder)
    {
        builder.ToTable(Table, table =>
        {
            table.HasCheckConstraint("ck_player_profiles_nickname_length", $"char_length({NicknameColumn}) BETWEEN 1 AND {Nickname.MaxCodePoints}");
            table.HasCheckConstraint(
                "ck_player_profiles_primary_position",
                $"{PrimaryPositionColumn} IS NULL OR {PrimaryPositionColumn} IN ({ProfileColumnValues.SqlList(ProfileColumnValues.PrimaryPositions.Values)})");
            table.HasCheckConstraint(
                "ck_player_profiles_other_positions",
                $"{OtherPositionsColumn} <@ ARRAY[{ProfileColumnValues.SqlList(ProfileColumnValues.Positions.Values)}]::text[]");
            table.HasCheckConstraint(
                "ck_player_profiles_other_positions_count", $"cardinality({OtherPositionsColumn}) <= {PlayerPositions.MaxOtherPositions}");
            table.HasCheckConstraint(
                "ck_player_profiles_suggested_level",
                $"{SuggestedLevelColumn} IS NULL OR ({SuggestedLevelColumn} BETWEEN {SkillLevel.MinTenths} AND {SkillLevel.MaxTenths} AND {SuggestedLevelColumn} % {SkillLevel.StepTenths} = 0)");
        });
        builder.HasKey(profile => profile.UserId).HasName("pk_player_profiles");
        builder.Property(profile => profile.UserId).HasColumnName(UserIdColumn)
            .HasConversion(id => id.Value, value => new UserId(value)).ValueGeneratedNever();
        builder.Property(profile => profile.Nickname).HasColumnName(NicknameColumn).HasColumnType("text");
        builder.Property(profile => profile.PrimaryPosition).HasColumnName(PrimaryPositionColumn).HasColumnType("text");
        builder.Property(profile => profile.OtherPositions).HasColumnName(OtherPositionsColumn).HasColumnType("text[]").HasDefaultValueSql(EmptyTextArray);
        builder.Property(profile => profile.SuggestedLevelTenths).HasColumnName(SuggestedLevelColumn).HasColumnType("smallint");
        builder.Property(profile => profile.UpdatedAt).HasColumnName(UpdatedAtColumn).HasColumnType("timestamp with time zone");

        builder.HasOne<User>().WithOne().HasForeignKey<PlayerProfileRow>(profile => profile.UserId)
            .HasConstraintName("fk_player_profiles_users").OnDelete(DeleteBehavior.Cascade);
    }
}
