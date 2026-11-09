namespace Sacou.Modules.Identity.Domain.Users;

/// <summary>
/// A person with an account. Only what login needs (ADR 0036, D5): no e-mail, name, photo,
/// provider or last login. A new field changes docs/seguranca/dados-pessoais.md and a test.
/// </summary>
internal sealed record User(UserId Id, AuthSubject Subject, DateTimeOffset CreatedAt)
{
    public static User Create(AuthSubject subject, DateTimeOffset now) => new(UserId.New(now), subject, now);
}
