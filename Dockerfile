# API image for Cloud Run (ADR 0068, D1). Context: the repository root, narrowed by .dockerignore.
# Both images are pinned by digest (ADR 0020): updating one is a deliberate change, never a pull.
# The SDK matches global.json; the runtime is the one that SDK ships (10.0.14). Node matches .nvmrc.

# The round page's script, styles and fonts (E3.12, ADR 0070, D7): only the @sacou/web package and what its build
# reads, installed from the lockfile. The output lands in the API's wwwroot before the publish.
FROM node:22.20.0-bookworm-slim@sha256:b21fe589dfbe5cc39365d0544b9be3f1f33f55f3c86c87a76ff65a02f8f5848e AS web
WORKDIR /source
ENV CI=true
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
COPY packages/volley-rules/package.json packages/volley-rules/
COPY packages/match-engine/package.json packages/match-engine/
# The pnpm of packageManager, from npm: the corepack of Node 22 cannot start the pnpm 12 launcher.
RUN npm install --global --no-audit --no-fund pnpm@12.16.1 && pnpm install --frozen-lockfile --filter @sacou/web
COPY apps/web/ apps/web/
RUN pnpm --filter @sacou/web build

FROM mcr.microsoft.com/dotnet/sdk:10.0.403-noble@sha256:212fe4cb74627d5adf9817a4088906ae3edff1bd853bb27565d4b46731efe61e AS build
WORKDIR /source

# Only what the API build reads. --locked-mode fails when a packages.lock.json is out of date.
COPY global.json nuget.config Directory.Build.props Directory.Build.targets Directory.Packages.props CodeMetricsConfig.txt .editorconfig ./
COPY apps/api/src/ apps/api/src/
# The modules embed the formations and settings catalogs and the rating parameters at build time (ADR 0025, ADR 0071).
COPY packages/volley-rules/src/formations/formations.json packages/volley-rules/src/formations/
COPY packages/match-engine/src/settings/settings-catalog.json packages/match-engine/src/settings/
COPY packages/rating/src/rating-params.json packages/rating/src/
# The API embeds the terms of use and the privacy policy it publishes at /termos and /privacidade (E6.1, ADR 0083).
COPY docs/legal/ docs/legal/
# The manifest the round page reads: without it the page would have no script (ManifestWebAssets).
COPY --from=web /source/apps/api/src/Sacou.Api/wwwroot/web/ apps/api/src/Sacou.Api/wwwroot/web/
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
