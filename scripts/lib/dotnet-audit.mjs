// Fail-closed reading of the `dotnet list package --vulnerable --format json` report.
// Any severity outside the tolerated list blocks, so an unknown value cannot pass.
const TOLERATED_SEVERITIES = new Set(["low", "moderate"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function isValidException(exception) {
  return (
    typeof exception?.advisory === "string" &&
    exception.advisory.length > 0 &&
    typeof exception.reason === "string" &&
    exception.reason.length > 0 &&
    typeof exception.expires === "string" &&
    ISO_DATE.test(exception.expires)
  );
}

function findReportProblem(report) {
  if (!Array.isArray(report?.projects) || report.projects.length === 0) {
    return "Audit report is invalid or lists no projects.";
  }
  if (report.problems !== undefined && report.problems.length > 0) {
    return `Audit report has problems: ${JSON.stringify(report.problems)}`;
  }
  return null;
}

function listFindings(report) {
  return report.projects.flatMap(({ path, frameworks = [] }) =>
    frameworks.flatMap(({ topLevelPackages = [], transitivePackages = [] }) =>
      [...topLevelPackages, ...transitivePackages].flatMap(
        ({ id, resolvedVersion, vulnerabilities = [] }) =>
          vulnerabilities.map(({ severity, advisoryurl }) => ({
            project: path,
            id,
            resolvedVersion,
            severity,
            advisoryurl,
          })),
      ),
    ),
  );
}

function isExcepted(finding, exceptions, today) {
  return exceptions.some(
    ({ advisory, expires }) => advisory === finding.advisoryurl && expires >= today,
  );
}

function isBlocking(finding, exceptions, today) {
  const tolerated = TOLERATED_SEVERITIES.has(String(finding.severity).toLowerCase());
  return !tolerated && !isExcepted(finding, exceptions, today);
}

function describeFinding({ project, id, resolvedVersion, severity, advisoryurl }) {
  return `${severity} ${id} ${resolvedVersion} in ${project}: ${advisoryurl}`;
}

/** Returns the reasons to fail; an empty list means the audit passed. */
export function findAuditFailures({ rawReport, rawExceptions, today }) {
  const exceptions = parseJson(rawExceptions);
  if (!Array.isArray(exceptions) || !exceptions.every(isValidException)) {
    return ["Exceptions file is invalid: each entry needs advisory, reason and expires."];
  }

  const report = parseJson(rawReport);
  const problem = findReportProblem(report);
  if (problem !== null) {
    return [problem];
  }

  return listFindings(report)
    .filter((finding) => isBlocking(finding, exceptions, today))
    .map(describeFinding);
}
