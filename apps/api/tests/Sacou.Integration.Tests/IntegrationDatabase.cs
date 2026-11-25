using System.Security.Cryptography;
using Docker.DotNet.Models;
using Testcontainers.PostgreSql;
using Xunit;

[assembly: AssemblyFixture(typeof(Sacou.Integration.Tests.IntegrationDatabase))]

namespace Sacou.Integration.Tests;

/// <summary>
/// One throwaway Postgres per test run. Docker is required: a missing Docker fails the run, never skips it.
/// The image is the one in docker-compose.yml (a guard in Sacou.Architecture.Tests keeps them equal).
/// </summary>
public sealed class IntegrationDatabase : IAsyncLifetime
{
    internal const string Image = "postgres:18.6@sha256:3a4264520e121176619f54ff867d12774bc81e95e7b84db58d63bccdb6144b81";

    private const int PasswordByteCount = 24;
    private const string LoopbackAddress = "127.0.0.1";
    private const string RunbookPath = "docs/operacao/postgres-local.md";

    private PostgreSqlContainer? container;

    public string ConnectionString =>
        container?.GetConnectionString() ?? throw new InvalidOperationException("The database has not started.");

    /// <summary>The server's container, whose network a tools container joins to reach it on localhost (the backup tests).</summary>
    internal string ContainerId =>
        container?.Id ?? throw new InvalidOperationException("The database has not started.");

    public async ValueTask InitializeAsync()
    {
        try
        {
            container = new PostgreSqlBuilder(Image)
                .WithPassword(Convert.ToHexString(RandomNumberGenerator.GetBytes(PasswordByteCount)))
                .WithCreateParameterModifier(BindPortsToLoopback)
                .Build();
            await container.StartAsync();
        }
        catch (Exception exception)
        {
            // Only the exception type is reported: the message may carry the connection string.
            throw new InvalidOperationException(
                $"Could not start Postgres in Docker ({exception.GetType().Name}). Check that Docker is running and can pull the image. See {RunbookPath}.");
        }
    }

    /// <summary>The module publishes the port on every interface by default; the password is not the only barrier.</summary>
    private static void BindPortsToLoopback(CreateContainerParameters parameters)
    {
        var bindings = parameters.HostConfig?.PortBindings?.Values.SelectMany(published => published) ?? [];
        foreach (var binding in bindings)
        {
            binding.HostIP = LoopbackAddress;
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (container is not null)
        {
            await container.DisposeAsync();
        }
    }
}
