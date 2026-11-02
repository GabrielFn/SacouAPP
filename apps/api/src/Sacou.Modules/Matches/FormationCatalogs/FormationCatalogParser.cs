using System.Collections.Immutable;
using System.Globalization;
using System.Text.Json;
using Sacou.Modules.Matches.Domain.Formations;

namespace Sacou.Modules.Matches.FormationCatalogs;

/// <summary>
/// Port of parse-catalog.ts, with the same paths in its errors. A corrupt catalog is a programming
/// error rather than a business rule, so it throws while loading, naming the offending field. It
/// walks fixed lists rather than the file, so the order of the keys in the JSON cannot matter.
/// </summary>
internal static class FormationCatalogParser
{
    private const int BasePositionLength = 2;

    /// <summary>Unlike JavaScript, which keeps the last one, a repeated key fails here (ADR 0025).</summary>
    private static readonly JsonDocumentOptions StrictOptions = new() { AllowDuplicateProperties = false };

    private delegate T Reader<out T>(JsonElement? raw, string path);

    public static FormationCatalog Parse(Stream json)
    {
        using var document = JsonDocument.Parse(json, StrictOptions);
        var root = ReadObject(document.RootElement, "root");
        var coordinateSystem = ReadObject(Member(root, "coordinateSystem"), "coordinateSystem");

        // Not part of the catalog, but a role without a description means the data drifted.
        ReadCompleteEntries(Member(root, "roles"), "roles", PlayerRole.All, role => role.Code, ReadString);

        return new FormationCatalog(
            ReadCompleteEntries(
                Member(coordinateSystem, "basePositions"),
                "coordinateSystem.basePositions",
                RotationSlot.All,
                SlotKey,
                ReadBasePosition),
            ReadCompleteEntries(Member(root, "systems"), "systems", FormationSystem.All, system => system.Code, ReadSystem));
    }

    private static string SlotKey(RotationSlot slot) => slot.Value.ToString(CultureInfo.InvariantCulture);

    private static string RotationKeyText(RotationKey key) => key.Value.ToString(CultureInfo.InvariantCulture);

    private static InvalidDataException Fail(string path, string expected) =>
        new($"Invalid formation catalog at \"{path}\": expected {expected}.");

    /// <summary>An absent member is <c>null</c>, which every reader refuses, like <c>undefined</c> in the TS port.</summary>
    private static JsonElement? Member(JsonElement record, string name) =>
        record.TryGetProperty(name, out var value) ? value : null;

    private static JsonElement ReadObject(JsonElement? raw, string path) =>
        raw is { ValueKind: JsonValueKind.Object } record ? record : throw Fail(path, "an object");

    private static JsonElement ReadArray(JsonElement? raw, string path) =>
        raw is { ValueKind: JsonValueKind.Array } items ? items : throw Fail(path, "an array");

    /// <summary>A huge exponent either fails TryGetDouble or gives Infinity, depending on its size.</summary>
    private static double? FiniteNumber(JsonElement? raw) =>
        raw is { ValueKind: JsonValueKind.Number } number
            && number.TryGetDouble(out var value)
            && double.IsFinite(value)
                ? value
                : null;

    private static double ReadNumber(JsonElement? raw, string path) =>
        FiniteNumber(raw) ?? throw Fail(path, "a number");

    private static string ReadString(JsonElement? raw, string path) =>
        raw is { ValueKind: JsonValueKind.String } text ? text.GetString()! : throw Fail(path, "a string");

    private static PlayerRole ReadRole(JsonElement? raw, string path)
    {
        var code = raw is { ValueKind: JsonValueKind.String } text ? text.GetString() : null;
        return PlayerRole.All.FirstOrDefault(role => role.Code == code)
            ?? throw Fail(path, $"one of {string.Join(", ", PlayerRole.All.Select(role => role.Code))}");
    }

    /// <summary>Compares as a number, like JavaScript, because <c>1.0</c> and <c>1e0</c> are the key 1.</summary>
    private static RotationKey ReadRotationKey(JsonElement? raw, string path)
    {
        var number = FiniteNumber(raw);
        return RotationKey.All.FirstOrDefault(key => key.Value == number)
            ?? throw Fail(path, $"one of {string.Join(", ", RotationKey.All.Select(RotationKeyText))}");
    }

    /// <summary>Refuses unknown keys. Only maps do: other objects ignore extra members, as in the TS port.</summary>
    private static ImmutableDictionary<TKey, TValue> ReadEntries<TKey, TValue>(
        JsonElement? raw,
        string path,
        ImmutableArray<TKey> allowed,
        Func<TKey, string> keyText,
        Reader<TValue> read)
        where TKey : notnull
    {
        var record = ReadObject(raw, path);
        var unknownKey = record.EnumerateObject()
            .Select(member => member.Name)
            .FirstOrDefault(name => !allowed.Any(key => keyText(key) == name));
        if (unknownKey is not null)
        {
            throw Fail($"{path}.{unknownKey}", $"a key among {string.Join(", ", allowed.Select(keyText))}");
        }

        return allowed
            .Where(key => record.TryGetProperty(keyText(key), out _))
            .ToImmutableDictionary(key => key, key => read(Member(record, keyText(key)), $"{path}.{keyText(key)}"));
    }

    private static ImmutableDictionary<TKey, TValue> ReadCompleteEntries<TKey, TValue>(
        JsonElement? raw,
        string path,
        ImmutableArray<TKey> keys,
        Func<TKey, string> keyText,
        Reader<TValue> read)
        where TKey : notnull
    {
        var entries = ReadEntries(raw, path, keys, keyText, read);
        var missing = keys.Where(key => !entries.ContainsKey(key)).Select(keyText).FirstOrDefault();
        return missing is null ? entries : throw Fail($"{path}.{missing}", "a value");
    }

    private static CourtPoint ReadBasePosition(JsonElement? raw, string path)
    {
        var items = ReadArray(raw, path);
        if (items.GetArrayLength() != BasePositionLength)
        {
            throw Fail(path, "an [x, y] pair");
        }

        return new CourtPoint(ReadNumber(items[0], $"{path}.x"), ReadNumber(items[1], $"{path}.y"));
    }

    private static ReceivePosition ReadReceivePosition(JsonElement? raw, string path)
    {
        var record = ReadObject(raw, path);
        var role = ReadRole(Member(record, "role"), $"{path}.role");
        var x = ReadNumber(Member(record, "x"), $"{path}.x");
        var y = ReadNumber(Member(record, "y"), $"{path}.y");
        return new ReceivePosition(role, new CourtPoint(x, y));
    }

    private static PlayerRole? ReadLiberoReplaces(JsonElement? raw, string path) =>
        raw is { ValueKind: JsonValueKind.Null } ? null : ReadRole(raw, path);

    private static ImmutableDictionary<RotationSlot, PlayerRole>? ReadServeSubstitution(JsonElement? raw, string path) =>
        raw is { ValueKind: JsonValueKind.Null } ? null : ReadEntries(raw, path, RotationSlot.All, SlotKey, ReadRole);

    private static FormationTemplate ReadTemplate(JsonElement? raw, string path)
    {
        var record = ReadObject(raw, path);
        var receive = ReadCompleteEntries(
            Member(record, "receive"),
            $"{path}.receive",
            RotationSlot.All,
            SlotKey,
            ReadReceivePosition);
        var liberoReplaces = ReadLiberoReplaces(Member(record, "liberoReplaces"), $"{path}.liberoReplaces");
        var serveSubstitution = ReadServeSubstitution(Member(record, "serveSubstitution"), $"{path}.serveSubstitution");
        var note = ReadString(Member(record, "note"), $"{path}.note");
        return new FormationTemplate(receive, liberoReplaces, serveSubstitution, note);
    }

    private static ImmutableArray<RotationKey> ReadRotationOrder(
        JsonElement? raw,
        string path,
        ImmutableDictionary<RotationKey, FormationTemplate> rotations)
    {
        ImmutableArray<RotationKey> order =
            [.. ReadArray(raw, path).EnumerateArray().Select((key, index) => ReadRotationKey(key, $"{path}.{index}"))];
        var keys = RotationKey.All.Where(rotations.ContainsKey).ToList();
        var matchesRotations = order.Length == keys.Count && keys.All(order.Contains);
        return matchesRotations
            ? order
            : throw Fail(path, $"exactly the rotations {string.Join(", ", keys.Select(RotationKeyText))}");
    }

    private static FormationSystemTemplate ReadSystem(JsonElement? raw, string path)
    {
        var record = ReadObject(raw, path);
        var rotations = ReadEntries(
            Member(record, "rotations"),
            $"{path}.rotations",
            RotationKey.All,
            RotationKeyText,
            ReadTemplate);
        var label = ReadString(Member(record, "label"), $"{path}.label");
        var rotationOrder = ReadRotationOrder(Member(record, "rotationOrder"), $"{path}.rotationOrder", rotations);
        return new FormationSystemTemplate(label, rotationOrder, rotations);
    }
}
