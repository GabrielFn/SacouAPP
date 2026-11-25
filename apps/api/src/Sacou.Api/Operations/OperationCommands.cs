namespace Sacou.Api.Operations;

/// <summary>
/// A one-off operation the API's own binary runs instead of the server (E6.3, door 1): the services are built, the
/// command runs and the process exits with its code. No port is opened and no route is mapped.
/// </summary>
public interface IOperationCommand
{
    /// <summary>The process exit code. <paramref name="output"/> gets one line, only numbers and codes.</summary>
    Task<int> RunAsync(IServiceProvider services, TextWriter output, CancellationToken cancellationToken);
}

/// <summary>
/// Picks the command from the container's arguments. The Cloud Run service passes none, so it always starts the server;
/// only someone who runs the image by hand, with both database URLs, reaches a command.
/// </summary>
public static class OperationCommands
{
    public static IOperationCommand? TryMatch(IReadOnlyList<string> args)
    {
        ArgumentNullException.ThrowIfNull(args);
        return args.Count > 0 && string.Equals(args[0], ReapplyDeletionsCommand.Name, StringComparison.Ordinal)
            ? new ReapplyDeletionsCommand([.. args.Skip(1)])
            : null;
    }
}
