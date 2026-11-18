# API image for Cloud Run (ADR 0068, D1). Context: the repository root, narrowed by .dockerignore.
# Both images are pinned by digest (ADR 0020): updating one is a deliberate change, never a pull.
# The SDK matches global.json; the runtime is the one that SDK ships (10.0.14).

FROM mcr.microsoft.com/dotnet/sdk:10.0.403-noble@sha256:212fe4cb74627d5adf9817a4088906ae3edff1bd853bb27565d4b46731efe61e AS build
WORKDIR /source

# Only what the API build reads. --locked-mode fails when a packages.lock.json is out of date.
COPY global.json nuget.config Directory.Build.props Directory.Build.targets Directory.Packages.props CodeMetricsConfig.txt .editorconfig ./
COPY apps/api/src/ apps/api/src/
# The modules embed the formations and settings catalogs at build time (ADR 0025).
COPY packages/volley-rules/src/formations/formations.json packages/volley-rules/src/formations/
COPY packages/match-engine/src/settings/settings-catalog.json packages/match-engine/src/settings/
ENV CI=true
RUN dotnet restore apps/api/src/Sacou.Api/Sacou.Api.csproj --locked-mode
RUN dotnet publish apps/api/src/Sacou.Api/Sacou.Api.csproj --configuration Release --no-restore --output /app

# Chiseled: no shell, no package manager, a non-root user (APP_UID) already in the image.
FROM mcr.microsoft.com/dotnet/aspnet:10.0.14-noble-chiseled@sha256:f2557fb81b1cfcfdfcde9d3bf247ed60b2cd38f00a88153f61e34737fab8ade7 AS runtime
WORKDIR /app
COPY --from=build /app ./
# Cloud Run sends traffic to 8080 by default; Kestrel listens on every interface.
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "Sacou.Api.dll"]
