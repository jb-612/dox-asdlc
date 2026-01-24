# User Stories: P07-F01 Plane CE Kubernetes Deployment

## US-01: Deploy Plane CE to Kubernetes

**As a** developer
**I want** to deploy Plane CE with a single command
**So that** I can use it for project and task management alongside aSDLC

### Acceptance Criteria

The command `./scripts/k8s/deploy-plane.sh` deploys Plane CE to the `plane-ce` namespace. All required Plane CE pods become ready within a reasonable timeout. The web UI is accessible via NodePort on minikube. Default admin credentials allow initial login.

### Test Scenarios

**Scenario 1: Fresh deployment**
Given a running minikube cluster with no Plane CE installed, when I run `./scripts/k8s/deploy-plane.sh`, then Plane CE is deployed to the `plane-ce` namespace and the web UI is accessible.

**Scenario 2: Upgrade deployment**
Given an existing Plane CE deployment, when I run `./scripts/k8s/deploy-plane.sh`, then the release is upgraded without data loss.

---

## US-02: Add Plane Helm Repository

**As a** developer
**I want** to add the Plane Helm repository with a script
**So that** I can install Plane CE charts

### Acceptance Criteria

The command `./scripts/k8s/add-plane-repo.sh` adds the `makeplane` Helm repository. The script is idempotent and can be run multiple times. The `plane-ce` chart is available after running the script.

### Test Scenarios

**Scenario 1: Add repository**
Given Helm is installed without the Plane repository, when I run `./scripts/k8s/add-plane-repo.sh`, then `helm search repo makeplane/plane-ce` returns results.

**Scenario 2: Idempotent execution**
Given the Plane repository is already added, when I run `./scripts/k8s/add-plane-repo.sh`, then the script completes without error.

---

## US-03: Remove Plane CE Deployment

**As a** developer
**I want** to cleanly remove the Plane CE deployment
**So that** I can free up resources or start fresh

### Acceptance Criteria

The command `./scripts/k8s/teardown-plane.sh` removes the Plane CE Helm release. An optional `--delete-namespace` flag also removes the namespace. PersistentVolumeClaims are preserved by default unless `--delete-data` is specified.

### Test Scenarios

**Scenario 1: Remove deployment only**
Given a running Plane CE deployment, when I run `./scripts/k8s/teardown-plane.sh`, then the Helm release is removed but PVCs persist for potential redeployment.

**Scenario 2: Full cleanup**
Given a running Plane CE deployment, when I run `./scripts/k8s/teardown-plane.sh --delete-namespace --delete-data`, then all resources including PVCs and namespace are removed.

---

## US-04: Deploy aSDLC with Plane CE Together

**As a** developer
**I want** to deploy both aSDLC and Plane CE with one command
**So that** I can quickly set up the complete development environment

### Acceptance Criteria

The command `./scripts/k8s/deploy.sh --with-plane` deploys both the aSDLC system and Plane CE. The aSDLC deployment succeeds first, then Plane CE is deployed. Both systems are accessible after deployment.

### Test Scenarios

**Scenario 1: Combined deployment**
Given a running minikube cluster, when I run `./scripts/k8s/deploy.sh --with-plane`, then both dox-asdlc and plane-ce namespaces contain running pods.

**Scenario 2: Plane deployment skipped without flag**
Given a running minikube cluster, when I run `./scripts/k8s/deploy.sh` (without --with-plane), then only dox-asdlc is deployed.

---

## US-05: Access Plane CE Web UI

**As a** developer
**I want** to access the Plane CE web interface
**So that** I can create projects and manage work items

### Acceptance Criteria

After deployment, the Plane CE web UI is accessible via minikube service URL. The deployment script prints the access URL on completion. The web UI loads and allows user registration/login.

### Test Scenarios

**Scenario 1: Access via minikube service**
Given Plane CE is deployed, when I run `minikube service plane-app-web -n plane-ce --url`, then I receive a URL that loads the Plane CE login page in a browser.

**Scenario 2: URL printed after deployment**
Given I run `./scripts/k8s/deploy-plane.sh`, when deployment completes, then the access URL is printed to stdout.
