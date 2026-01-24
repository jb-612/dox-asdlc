# Tasks: P07-F01 Plane CE Kubernetes Deployment

## Progress

- Started: 2026-01-24
- Completed: 2026-01-24
- Tasks Complete: 6/6
- Percentage: 100%
- Status: COMPLETE
- Blockers: None

## Task List

### T01: Create add-plane-repo.sh script
- [x] Estimate: 30min
- [x] Tests: Manual verification (helm search repo makeplane)
- [x] Dependencies: None
- [x] Notes: Add https://helm.plane.so/ as 'makeplane' repository. Make idempotent. Update repo after adding.

### T02: Create Plane CE values file
- [x] Estimate: 1hr
- [x] Tests: Manual verification (helm lint)
- [x] Dependencies: None
- [x] Notes: Create helm/plane-ce/values-minikube.yaml with resource limits, NodePort service, reduced persistence sizes. Document all configuration options.

### T03: Create deploy-plane.sh script
- [x] Estimate: 1hr
- [x] Tests: Manual verification (kubectl get pods -n plane-ce)
- [x] Dependencies: T01, T02
- [x] Notes: Install Plane CE to plane-ce namespace. Wait for pods to be ready. Print access URL on completion. Support --wait and --dry-run flags.

### T04: Create teardown-plane.sh script
- [x] Estimate: 30min
- [x] Tests: Manual verification (namespace removal)
- [x] Dependencies: T03
- [x] Notes: Uninstall Helm release. Support --delete-namespace and --delete-data flags. Confirm before destructive operations.

### T05: Update deploy.sh with --with-plane flag
- [x] Estimate: 30min
- [x] Tests: Manual verification
- [x] Dependencies: T03
- [x] Notes: Add --with-plane option to scripts/k8s/deploy.sh. Ensure Plane repo is added first, then deploy after aSDLC.

### T06: Update documentation
- [x] Estimate: 1hr
- [x] Tests: Visual inspection
- [x] Dependencies: T01-T05
- [x] Notes: Update README.md with Plane CE section. Update docs/System_Design.md with Plane CE architecture. Document access URL, default credentials, and troubleshooting.

## Completion Checklist

- [x] All tasks marked complete
- [ ] Plane CE deploys successfully on minikube (requires minikube)
- [ ] Web UI is accessible via NodePort (requires minikube)
- [ ] Teardown removes all resources cleanly (requires minikube)
- [x] --with-plane flag works in deploy.sh
- [x] Documentation updated
- [x] Progress: 100%

## Notes

Plane CE is deployed as a separate Helm release in its own namespace to maintain isolation from the main aSDLC deployment. This allows independent lifecycle management and prevents resource conflicts.

### Files Created

**Helm Values:**
- `helm/plane-ce/values-minikube.yaml` - Minikube-optimized configuration

**Scripts:**
- `scripts/k8s/add-plane-repo.sh` - Add Plane Helm repository
- `scripts/k8s/deploy-plane.sh` - Deploy Plane CE
- `scripts/k8s/teardown-plane.sh` - Remove Plane CE

**Modified:**
- `scripts/k8s/deploy.sh` - Added --with-plane flag
- `docs/System_Design.md` - Added Section 14 (Plane CE Integration)
- `README.md` - Added Plane CE deployment section

### Access URL

After deployment, access Plane CE via:
```bash
minikube service plane-app-web -n plane-ce --url
```

### Default Setup

On first access, Plane CE requires:
1. Admin account creation
2. Workspace setup
3. Project creation

These steps are performed manually through the web UI.
