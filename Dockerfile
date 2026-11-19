# API image for Cloud Run (ADR 0068, D1). Context: the repository root, narrowed by .dockerignore.
# Both images are pinned by digest (ADR 0020): updating one is a deliberate change, never a pull.
# The SDK matches global.json; the runtime is the one that SDK ships (10.0.14).

FROM mcr.microsoft.com/dotnet/sdk:10.0.403-noble@sha256:212fe4cb74627d5adf9817a4088906ae3edff1bd853bb27565d4b46731efe61e AS build
WORKDIR /source

# Only what the API build reads. --locked-mode fails when a packages.lock.json is out of date.
COPY global.json nuget.config Directory.Build.props Directory.Build.targets Directory.Packages.props CodeMetricsConfig.txt .editorconfig ./
COPY apps/api/src/ apps/api/src/
# The modules embed the formations and settings catalogs and the rating parameters at build time (ADR 0025, ADR 0071).
COPY packages/volley-rules/src/formations/formations.json packages/volley-rules/src/formations/
COPY packages/match-engine/src/settings/settings-catalog.json packages/match-engine/src/settings/
COPY packages/rating/src/rating-params.json packages/rating/src/
ENV CI=true
RUN dotnet restore apps/api/src/Sacou.Api/Sacou.Api.csproj --locked-mode
RUN dotnet publish apps/api/src/Sacou.Api/Sacou.Api.csproj --configuration Release --no-restore --output /app

# Chiseled: no shell, no package manager, a non-root user (APP_UID) already in the image. The -extra variant adds
# tzdata and ICU: rounds live in America/Sao_Paulo (SessionsTime), which the plain chiseled image cannot resolve.
FROM mcr.microsoft.com/dotnet/aspnet:10.0.14-noble-chiseled-extra@sha256:a9298ccc39c6258ae71228479e2f3f8d2ceb6639a9927262a4b0ff7d319a0e7e AS runtime
WORKDIR /app
COPY --from=build /app ./
# Cloud Run sends traffic to 8080 by default; Kestrel listens on every interface.
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "Sacou.Api.dll"]
