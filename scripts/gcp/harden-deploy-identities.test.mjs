// Keeps scripts/gcp/harden-deploy-identities.sh and .github/workflows/deploy-api.yml telling the same story
// (ADR 0068, D3): the provider takes only the deploy workflow, each account trusts one OIDC subject, and no
// account has a role on the whole project. A text alarm, like the architecture rules of the workflow.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const ROOT = resolve(import.meta.dirname, "../..");
const script = readFileSync(resolve(ROOT, "scripts/gcp/harden-deploy-identities.sh"), "utf8");
const workflow = readFileSync(resolve(ROOT, ".github/workflows/deploy-api.yml"), "utf8");

const variableOf = (name) => script.match(new RegExp(`^${name}="([^"]*)"$`, "m"))?.[1];

// Any role granted on the project as a whole.
const PROJECT_GRANT = /gcloud projects add-iam-policy-binding/;

describe("deploy identities", () => {
  it("lets the provider take only the deploy workflow on main", () => {
    assert.equal(
      variableOf("DEPLOY_WORKFLOW_REF"),
      "${GITHUB_REPO}/.github/workflows/deploy-api.yml@refs/heads/main",
    );
    assert.match(
      script,
      /--attribute-condition="assertion\.repository_id == '\$\{GITHUB_REPO_ID\}' && assertion\.ref == 'refs\/heads\/main' && assertion\.workflow_ref == '\$\{DEPLOY_WORKFLOW_REF\}'"/,
    );
  });

  it("binds each account to one subject: build to the main ref, each deployer to its environment", () => {
    assert.equal(
      variableOf("SUBJECT_PREFIX"),
      "repo:${GITHUB_REPO%%/*}@${GITHUB_OWNER_ID}/${GITHUB_REPO#*/}@${GITHUB_REPO_ID}",
    );
    assert.equal(variableOf("GITHUB_OWNER_ID"), "5855069");
    assert.equal(variableOf("SUBJECT_BUILD"), "${SUBJECT_PREFIX}:ref:refs/heads/main");
    assert.equal(variableOf("SUBJECT_TEST"), "${SUBJECT_PREFIX}:environment:test");
    assert.equal(variableOf("SUBJECT_PROD"), "${SUBJECT_PREFIX}:environment:production");
    assert.match(
      script,
      /grant_deployer "\$DEPLOYER_TEST" "\$SERVICE_TEST" "\$RUNNER_TEST" "\$SUBJECT_TEST"/,
    );
    assert.match(
      script,
      /grant_deployer "\$DEPLOYER_PROD" "\$SERVICE_PROD" "\$RUNNER_PROD" "\$SUBJECT_PROD"/,
    );
    assert.doesNotMatch(script, /principalSet:\/\//);
  });

  it("matches the environments and the accounts of the workflow", () => {
    assert.match(workflow, /^ {6}name: test$/m);
    assert.match(workflow, /^ {6}name: production$/m);
    assert.match(
      workflow,
      /service: sacou-api-test\n(?:.*\n)*? {10}deployer: \$\{\{ vars\.GCP_DEPLOYER_TEST_SA \}\}/,
    );
    assert.match(
      workflow,
      /service: sacou-api\n(?:.*\n)*? {10}deployer: \$\{\{ vars\.GCP_DEPLOYER_PROD_SA \}\}/,
    );
    for (const variable of ["GCP_BUILDER_SA", "GCP_DEPLOYER_TEST_SA", "GCP_DEPLOYER_PROD_SA"]) {
      assert.match(script, new RegExp(`Create: ${variable}=`));
    }
    assert.match(script, /Delete: GCP_DEPLOYER_SA"$/m);
  });

  it("grants nothing on the whole project and retires the shared deployer", () => {
    assert.doesNotMatch(script, PROJECT_GRANT);
    assert.equal(variableOf("OLD_DEPLOYER"), "sacou-deployer");
    assert.match(
      script,
      /gcloud iam service-accounts delete "\$\(sa_email "\$OLD_DEPLOYER"\)" --quiet/,
    );
    assert.match(
      script,
      /gcloud run services add-iam-policy-binding "\$service" --region="\$REGION" \\\n\s+--member="serviceAccount:\$\(sa_email "\$deployer"\)" --role=roles\/run\.developer/,
    );
  });

  it("lets each deployer read the images of the sacou repository, never write them", () => {
    assert.match(
      script,
      /gcloud artifacts repositories add-iam-policy-binding "\$ARTIFACT_REPO" --location="\$REGION" \\\n\s+--member="serviceAccount:\$\(sa_email "\$deployer"\)" --role=roles\/artifactregistry\.reader/,
    );
    assert.doesNotMatch(script, /sa_email "\$deployer"\)" --role=roles\/artifactregistry\.writer/);
  });
});
