using Sacou.Api.Observability;
using Xunit;

namespace Sacou.Api.Tests.Observability;

/// <summary>Case 6 of the plan: the patterns that become <c>[filtrado]</c> wherever they hide in a text.</summary>
public sealed class SensitiveTextTests
{
    [Theory]
    [InlineData("Conta de pessoa.teste+1@example.com.br removida", "Conta de [filtrado] removida")]
    [InlineData("Authorization: Bearer abc.def-ghi", "Authorization: [filtrado]")]
    [InlineData("token eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.c2ln fim", "token [filtrado] fim")]
    [InlineData("pix 00020126580014br.gov.bcb.pix0136chave fim", "pix [filtrado] fim")]
    [InlineData("Rodada sem dado pessoal", "Rodada sem dado pessoal")]
    public void Redact_ReplacesEachPattern(string text, string expected) =>
        Assert.Equal(expected, SensitiveText.Redact(text));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void Redact_KeepsAnEmptyText(string? text) =>
        Assert.Equal(text, SensitiveText.Redact(text));
}
