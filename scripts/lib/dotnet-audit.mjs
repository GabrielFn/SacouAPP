// Fail-closed reading of the `dotnet list package --vulnerable --format json` report.
// Any severity outside the tolerated list blocks, so an unknown value cannot pass.
import { parseExceptions, parseJson } from "./audit-exceptions.mjs";

const TOLERATED_SEVERITIES = new Set(["low", "moderate"]);
// An exception is a dated decision, never a standing one: at most 90 days ahead (E5.3, SEC-M1).
export const MAX_EXCEPTION_DAYS = 90;
const MILLISECONDS_PER_DAY = 86_400_000;
const ISO_DATE_LENGTH = 10;

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

function latestAllowedExpiry(today) {
  const limit = Date.parse(`${today}T00:00:00Z`) + MAX_EXCEPTION_DAYS * MILLISECONDS_PER_DAY;
  return new Date(limit).toISOString().slice(0, ISO_DATE_LENGTH);
}

function findCeilingFailures(exceptions, today) {
  return exceptions
    .filter(({ expires }) => expires > latestAllowedExpiry(today))
    .map(
      ({ advisory, expires }) =>
        `Exception for ${advisory} expires on ${expires}, over ${MAX_EXCEPTION_DAYS} days from today.`,
    );
}

/** Returns the reasons to fail; an empty list means the audit passed. */
export function findAuditFailures({ rawReport, rawExceptions, today }) {
  const exceptions = parseExceptions(rawExceptions);
  if (exceptions === undefined) {
    return ["Exceptions file is invalid: each entry needs advisory, reason and expires."];
  }

  const tooLong = findCeilingFailures(exceptions, today);
  if (tooLong.length > 0) {
    return tooLong;
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
