using System.Globalization;

namespace Sacou.Api.Web;

/// <summary>
/// The pt-BR texts the server renders on the round page (screens 01 and 02 of <c>design/mvp</c>). The texts the
/// script writes live in <c>apps/web/src/strings.pt-BR.ts</c>.
/// </summary>
internal static class WebTexts
{
    public const string Brand = "Sacou";
    public const string BrandTag = "Convite do grupo";
    public const string Confirmed = "confirmados";
    public const string Regulars = "Mensalistas";
    public const string DropIns = "Avulsos";
    public const string Everyone = "Confirmados";
    public const string Vacant = "vaga aberta";
    public const string NoNickname = "Sem apelido";
    public const string Going = "VOU";
    public const string LeaveTitle = "Sair da lista?";
    public const string LeaveBody = "Se mudar de ideia, é só tocar em VOU de novo enquanto houver vaga.";
    public const string LeaveConfirm = "NÃO VOU MAIS";
    public const string LeaveKeep = "CONTINUAR NA LISTA";
    public const string NotGoing = "NÃO VOU";
    public const string SignOut = "Sair";
    public const string NoScript = "Ative o JavaScript para confirmar.";
    public const string Canceled = "Rodada cancelada.";
    public const string Started = "Essa rodada já começou.";
    public const string Ended = "Essa rodada já terminou.";

    // Question 238 (E6.7): in place of the list, 7 days after the round's start.
    public const string ListExpired = "A lista de quem foi sai da página 7 dias depois da rodada.";
    public const string LinkInvalidTitle = "Link inválido";
    public const string LinkInvalid = "Link inválido ou desativado. Peça um novo para quem organiza.";
    public const string TooManyRequests = "Muitas tentativas. Tente de novo em alguns segundos.";
    public const string LoserLeaves = "quem perde sai";
    public const string NoLimit = "sem limite";

    public const string SheetTitle = "Entrar pra confirmar";
    public const string SheetBody = "É só uma vez. Depois você confirma qualquer rodada com um toque.";
    public const string Close = "Fechar";
    public const string Google = "Entrar com Google";
    public const string GoogleMark = "G";
    public const string Email = "Usar e-mail e senha";
    public const string Embedded = "Para entrar com Google, abra este link no navegador (Chrome ou Safari). Ou use e-mail e senha.";
    public const string SignInTab = "Entrar";
    public const string SignUpTab = "Criar conta";
    public const string EmailLabel = "E-mail";
    public const string PasswordLabel = "Senha";
    public const string PasswordRule = "Pelo menos 6 caracteres";
    public const string Forgot = "Esqueci a senha";
    public const string Back = "Voltar";
    public const string NicknameLabel = "Apelido na quadra";
    public const string NicknameSubmit = "Confirmar";

    // Question 126, option 2 (19/11/2026): the first names show on the page to whoever has the link.
    public const string Privacy = "Seu apelido aparece na lista da rodada para quem tem o link.";
    public const string LegalBefore = "Ao entrar você aceita os ";
    public const string Terms = "Termos";
    public const string LegalBetween = " e a ";
    public const string PrivacyPolicy = "Política de Privacidade";
    public const string LegalAfter = ".";

    // The invite page (E3.12 Part 3, ADR 0070, D8): the server has no group, so only the Sacou's own words.
    public const string InviteTitle = "Convite para um grupo no Sacou";
    public const string InvitePreview = "Toque para ver o grupo de vôlei e entrar.";
    public const string InviteSignInHint = "Entre para ver o grupo do convite.";
    public const string InviteUnavailable = "O convite pela web não está disponível agora. Abra o link no app Sacou.";
    public const string InviteSignIn = "ENTRAR PRA VER O CONVITE";
    public const string InviteJoin = "ENTRAR NO GRUPO";
    public const string InviteNoScript = "Ative o JavaScript para ver o convite.";
    public const string InviteSheetTitle = "Entrar pra ver o convite";
    public const string InviteSheetBody = "É só uma vez. Depois você confirma as rodadas do grupo com um toque.";

    // The operator's dashboard (E7.2, ADR 0085): the server renders only these words, never a number.
    public const string OpsTitle = "Painel do Sacou";
    public const string OpsTag = "Operador";
    public const string OpsDetail = "Só contagens, sem dado de ninguém.";
    public const string OpsUnavailable = "O painel não está disponível agora: falta a configuração do login.";
    public const string OpsNoScript = "Ative o JavaScript para ver o painel.";
    public const string OpsSignIn = "ENTRAR";
    public const string OpsRefresh = "Atualizar";
    public const string OpsSheetTitle = "Entrar no painel";
    public const string OpsSheetBody = "Só a conta do operador vê os números.";

    // The legal pages (E6.1, ADR 0083): their own text comes from docs/legal/, only the frame is here.
    public const string TermsOfUse = "Termos de Uso";
    public const string SeeAlso = "Veja também: ";

    // The account deletion page (E6.4): the block to ask without the app, above the text of docs/legal/exclusao-de-conta.md.
    public const string DeletionRequestTitle = "Pedir sem o app";
    public const string DeletionRequestUnavailable = "O pedido por e-mail ainda não está disponível. Por enquanto, exclua pelo app.";
    public const string DeletionRequestIntro = "Sem o app instalado, peça a exclusão por e-mail ao encarregado de dados do Sacou:";

    // Question 251: only a request from the account's own e-mail; question 252: an answer within 15 days.
    public static readonly IReadOnlyList<string> DeletionRequestSteps =
    [
        "Envie do mesmo e-mail que você usa para entrar no Sacou.",
        "Diga o seu apelido no Sacou.",
        "A exclusão é feita em até 15 dias, e você recebe a confirmação por e-mail.",
        "Um pedido de outro endereço recebe uma resposta pedindo que você escreva do e-mail da conta.",
    ];

    /// <summary>The subject of the <c>mailto:</c>, already percent-encoded: "Excluir minha conta do Sacou".</summary>
    public const string DeletionRequestSubject = "Excluir%20minha%20conta%20do%20Sacou";

    private static readonly CultureInfo Invariant = CultureInfo.InvariantCulture;

    private static readonly string[] WeekdaysWithArticle =
        ["no domingo", "na segunda", "na terça", "na quarta", "na quinta", "na sexta", "no sábado"];

    /// <summary>"Versão 0.1 (rascunho) · atualizada em 24/11/2026".</summary>
    public static string LegalVersion(string version, DateOnly updatedOn) =>
        string.Create(Invariant, $"Versão {version} · atualizada em {updatedOn:dd/MM/yyyy}");

    private static readonly string[] Weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    /// <summary>"A lista dos avulsos abre hoje, às 20h." (the line under the count).</summary>
    public static string DropInWindow(string phrase) => "A lista dos avulsos abre " + phrase + ".";

    /// <summary>
    /// "hoje, às 20h", "amanhã, às 20h" or "na terça, 24/11, às 20h": the day in the round's own time zone, "today" by
    /// the server's clock (the page is no-store). The date always follows the weekday: the window can be a week away.
    /// </summary>
    public static string DropInPhrase(DateTimeOffset opensAt, string timeZoneId, DateTimeOffset now)
    {
        var zone = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
        var opens = TimeZoneInfo.ConvertTime(opensAt, zone);
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(now, zone).DateTime);
        var day = DateOnly.FromDateTime(opens.DateTime);
        var hour = Hour(TimeOnly.FromDateTime(opens.DateTime));
        if (day == today)
        {
            return $"hoje, às {hour}";
        }

        return day == today.AddDays(1)
            ? $"amanhã, às {hour}"
            : string.Create(Invariant, $"{WeekdaysWithArticle[(int)day.DayOfWeek]}, {day.Day}/{day.Month}, às {hour}");
    }

    public static string Missing(int count) => string.Create(Invariant, $"Faltam {count}. Chama o pessoal!");

    public static string MissingSpots(int count) => count == 1
        ? "Falta 1 vaga. Se lotar, você entra na espera."
        : string.Create(Invariant, $"Faltam {count} vagas. Se lotar, você entra na espera.");

    public static string Full(bool waitlist) => waitlist ? "Lotou. Se você for, entra na espera." : "Lotou.";

    public static string Waiting(int count) => count == 1 ? "1 na espera" : string.Create(Invariant, $"{count} na espera");

    public static string OfCapacity(int count, int capacity) => string.Create(Invariant, $"{count} de {capacity}");

    public static string SpotsOf(int count, int spots) => string.Create(Invariant, $"{count} de {spots} vagas");

    public static string Format(int playersPerTeam, int? pointsPerSet, bool loserLeaves)
    {
        var parts = new List<string> { string.Create(Invariant, $"{playersPerTeam}x{playersPerTeam}") };
        if (pointsPerSet is { } points)
        {
            parts.Add(string.Create(Invariant, $"{points} pts"));
        }

        if (loserLeaves)
        {
            parts.Add(LoserLeaves);
        }

        return string.Join(" · ", parts);
    }

    /// <summary>"Qui, 5/11": the round's own local date, never converted (the date is already of its time zone).</summary>
    public static string Day(DateOnly date) =>
        string.Create(Invariant, $"{Weekdays[(int)date.DayOfWeek]}, {date.Day}/{date.Month}");

    /// <summary>"19h" or "20h30".</summary>
    public static string Hour(TimeOnly time) => time.Minute == 0
        ? string.Create(Invariant, $"{time.Hour}h")
        : string.Create(Invariant, $"{time.Hour}h{time.Minute:00}");

    public static string Confirmations(int going, int? capacity) => capacity is { } limit
        ? string.Create(Invariant, $"{going}/{limit} confirmados")
        : string.Create(Invariant, $"{going} confirmados");
}
