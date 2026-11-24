// Keeps the backup job (E5.3, ADR 0082) telling one story across scripts/backup/backup.sh, deploy/backup/,
// scripts/gcp/setup-backups.sh, the integration test of the round trip and the CI areas. A text alarm, like the
// architecture rules: the script embedded in the job is the file, the image is one digest, the database URL is only a
// secret reference, and no deploy identity gets a role on a backup.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import yaml from "js-yaml";

import { ciAreas } from "../lib/ci-areas.mjs";

const ROOT = resolve(import.meta.dirname, "../..");
const read = (path) => readFileSync(resolve(ROOT, path), "utf8");

const script = read("scripts/backup/backup.sh");
const template = read("deploy/backup/job.yaml");
const setup = read("scripts/gcp/setup-backups.sh");
const workflow = yaml.load(read("deploy/backup/workflow.yaml"));
const alert = JSON.parse(read("deploy/backup/alert-policy.json"));
const lifecycle = JSON.parse(read("deploy/backup/lifecycle.json"));
const backupTools = read("apps/api/tests/Sacou.Integration.Tests/Backup/BackupTools.cs");

const RETENTION_DAYS = 30;
const DELETE_AFTER_DAYS = 31;
const TASK_TIMEOUT_SECONDS = "600";

const withoutComments = (source) =>
  source
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");
const variableOf = (name) => setup.match(new RegExp(`^${name}="([^"]*)"$`, "m"))?.[1];
const arrayOf = (name) =>
  [
    ...(setup.match(new RegExp(`^${name}=\\(([^)]*)\\)$`, "m"))?.[1] ?? "").matchAll(/"([^"]*)"/g),
  ].map((match) => match[1]);

// The same rendering as render_job in setup-backups.sh: envsubst of the listed names, and backup.sh with every line
// after the first indented like the ${BACKUP_SCRIPT} placeholder.
function renderJob(values) {
  const indent = template.match(/^( *)\$\{BACKUP_SCRIPT\}$/m)?.[1];
  assert.ok(indent, "job.yaml has a ${BACKUP_SCRIPT} line of its own");
  const lines = script.replace(/\n$/, "").split("\n");
  const embedded = lines.map((line, index) => (index === 0 ? line : `${indent}${line}`)).join("\n");
  const all = { ...values, BACKUP_SCRIPT: embedded };
  return template.replace(/\$\{([A-Z_]+)\}/g, (whole, name) => all[name] ?? whole);
}

const rendered = yaml.load(
  renderJob({
    JOB_NAME: "sacou-backup",
    BACKUP_ENVIRONMENT: "production",
    RUNTIME_ACCOUNT: "sacou-backup-run@sacou-api.iam.gserviceaccount.com",
    DATABASE_SECRET: "sacou-backup-database-url-prod",
    BUCKET: "sacou-api-backups-prod",
    IMAGE: "postgres@sha256:x",
  }),
);
const task = rendered.spec.template.spec.template.spec;
const [container] = task.containers;
const envNamed = (name) => container.env.find((entry) => entry.name === name);

describe("backup job", () => {
  it("embeds backup.sh exactly and runs its dump command", () => {
    assert.deepEqual(container.command, ["/bin/sh", "-c"]);
    assert.equal(container.args[0], script);
    assert.deepEqual(container.args.slice(1), ["backup.sh", "dump"]);
  });

  it("lists every placeholder of the template in the envsubst of setup-backups.sh", () => {
    const names = [...new Set([...template.matchAll(/\$\{([A-Z_]+)\}/g)].map((match) => match[1]))];
    const listed = setup.match(/envsubst '([^']*)'/)?.[1] ?? "";
    for (const name of names)
      assert.ok(listed.includes(`\${${name}}`), `${name} is not substituted`);
  });

  it("reads the database URL only by secret reference", () => {
    const url = envNamed("SACOU_BACKUP_DATABASE_URL");
    assert.equal(url.value, undefined);
    assert.deepEqual(url.valueFrom, {
      secretKeyRef: { name: "sacou-backup-database-url-prod", key: "latest" },
    });
    assert.equal(envNamed("SACOU_BACKUP_DIR").value, container.volumeMounts[0].mountPath);
  });

  it("retries once, stops after ten minutes and writes to the bucket's mount", () => {
    assert.equal(task.maxRetries, 1);
    assert.equal(task.timeoutSeconds, TASK_TIMEOUT_SECONDS);
    assert.equal(task.volumes[0].csi.driver, "gcsfuse.run.googleapis.com");
    assert.equal(task.volumes[0].csi.volumeAttributes.bucketName, "sacou-api-backups-prod");
  });

  it("uses one image by digest, the same as the round trip test", () => {
    const image = variableOf("IMAGE");
    assert.match(image, /^docker\.io\/library\/postgres:18\.\d+-alpine@sha256:[0-9a-f]{64}$/);
    const tested = backupTools.match(/const string BackupImage = "([^"]*)"/)?.[1];
    assert.equal(`docker.io/library/${tested}`, image);
  });
});

describe("backup script", () => {
  it("stops on any error and never traces its commands", () => {
    assert.match(script, /^set -eu$/m);
    for (const source of [script, setup]) {
      assert.doesNotMatch(
        withoutComments(source),
        /\bset\s+-[a-z]*x|\bset\s+-o\s+xtrace|\bxtrace\b/,
      );
    }
  });

  it("never prints a database URL", () => {
    const printing = script.split("\n").filter((line) => /\b(echo|printf)\b/.test(line));
    for (const line of printing) {
      assert.doesNotMatch(
        line,
        /\$\{?(url|secret|SACOU_BACKUP_DATABASE_URL|SACOU_RESTORE_DATABASE_URL)\b/,
        line,
      );
    }
  });

  it("restores only with --exit-on-error into one transaction, without owners or privileges", () => {
    assert.match(
      script,
      /pg_restore --no-owner --no-privileges --exit-on-error --single-transaction/,
    );
    assert.match(script, /pg_dump --format=custom --no-owner --no-privileges --snapshot=/);
    assert.match(script, /sslmode=verify-full&sslrootcert=system/);
  });
});

describe("backup setup", () => {
  it("keeps the environments apart: one job, account, secret and bucket each", () => {
    assert.deepEqual(arrayOf("ENVIRONMENTS"), ["test", "production"]);
    assert.deepEqual(arrayOf("JOBS"), ["sacou-backup-test", "sacou-backup"]);
    assert.deepEqual(arrayOf("RUNNERS"), ["sacou-backup-test-run", "sacou-backup-run"]);
    assert.deepEqual(arrayOf("SECRETS"), [
      "sacou-backup-database-url-test",
      "sacou-backup-database-url-prod",
    ]);
    assert.deepEqual(arrayOf("BUCKETS"), ["sacou-api-backups-test", "sacou-api-backups-prod"]);
  });

  it("grants nothing to the deploy, build or API identities", () => {
    assert.doesNotMatch(setup, /sacou-deployer|sacou-builder|sacou-api-test-run|sacou-api-run\b/);
    const members = [...setup.matchAll(/--member="serviceAccount:\$\{(\w+)\}"/g)].map(
      (match) => match[1],
    );
    assert.deepEqual([...new Set(members)].sort(), ["runner", "trigger"]);
  });

  it("gives the runner only its own secret and bucket, and the trigger only the start of jobs and workflows", () => {
    const roles = [...setup.matchAll(/--member="serviceAccount:\$\{(\w+)\}" --role=(\S+)/g)].map(
      (match) => `${match[1]} ${match[2]}`,
    );
    assert.deepEqual(roles.sort(), [
      "runner roles/secretmanager.secretAccessor",
      "runner roles/storage.objectUser",
      "trigger roles/run.invoker",
      "trigger roles/workflows.invoker",
    ]);
  });

  it("keeps each backup 30 days and deletes it at 31, with no public access and no soft delete", () => {
    assert.equal(variableOf("RETENTION"), `${RETENTION_DAYS}d`);
    assert.deepEqual(lifecycle.rule, [
      { action: { type: "Delete" }, condition: { age: DELETE_AFTER_DAYS } },
    ]);
    assert.match(
      setup,
      /--uniform-bucket-level-access --public-access-prevention --retention-period="\$RETENTION" --soft-delete-duration=0/,
    );
    assert.match(variableOf("BUCKET_REGION"), /^us-(east1|west1|central1)$/);
  });

  it("starts the jobs the setup creates from one workflow, and alerts on their failure", () => {
    const init = workflow.main.steps[0].init.assign.find((entry) => "jobs" in entry);
    assert.deepEqual(init.jobs, arrayOf("JOBS"));
    assert.match(
      setup,
      new RegExp(
        `WORKFLOW="${alert.conditions[1].conditionThreshold.filter.match(/workflow_id = "([^"]+)"/)[1]}"`,
      ),
    );
    assert.match(alert.conditions[0].conditionThreshold.filter, /sacou-backup\(-test\)\?/);
    assert.equal(alert.displayName, variableOf("ALERT_POLICY_NAME"));
  });
});

describe("CI areas of the backup", () => {
  it("runs the API job (with the round trip) when the script, the job or a migration changes", () => {
    for (const file of [
      "scripts/backup/backup.sh",
      "deploy/backup/job.yaml",
      "apps/api/src/Sacou.Modules/Groups/Infrastructure/Migrations/20990101000000_Next.cs",
    ]) {
      assert.equal(ciAreas([file]).api, true, file);
    }
  });
});
