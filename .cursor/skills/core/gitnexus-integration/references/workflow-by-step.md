# GitNexus: workflow per flowctl step

> Lazy reference — [SKILL.md](../SKILL.md)

## 3. GitNexus Workflow Per Step

### Step 1: Requirements Analysis

```bash
# Setup project repository nếu chưa có
gitnexus init --project-type "web-app|api|fullstack" \
  --team-size "{n}" \
  --flowctl "gitflow"

# Tạo branch cho requirements docs
gitnexus branch create "requirements analysis PRD and user stories" \
  --from "main"
# → Creates: docs/requirements-analysis-prd-and-user-stories

# Commit requirements documents
gitnexus commit --type "docs" --scope "requirements" \
  --message "add PRD v1.0 with 25 user stories"

# Commit user story updates
gitnexus commit --type "docs" --scope "requirements" \
  --message "update acceptance criteria for US-001 through US-010"

# Create PR cho review
gitnexus pr create \
  --title "docs(requirements): add PRD and user stories for {project}" \
  --base "main" \
  --reviewers "pm,tech-lead" \
  --labels "documentation,requirements,needs-review"

# Generate PR description
gitnexus pr describe --auto
```

### Step 2: System Design

```bash
# Branch cho architecture docs
gitnexus branch create "system design architecture and ADRs" \
  --from "develop"

# Commit architecture docs
gitnexus commit --type "docs" --scope "architecture" \
  --message "add system architecture design v1.0"

gitnexus commit --type "docs" --scope "adr" \
  --message "add ADR-001: choose PostgreSQL as primary database"

gitnexus commit --type "docs" --scope "api" \
  --message "add OpenAPI specification draft for all endpoints"

# Security check on design docs (check for sensitive info)
gitnexus security scan --type "secrets"

# PR
gitnexus pr create \
  --title "docs(architecture): system design and ADRs" \
  --base "develop" \
  --reviewers "tech-lead,pm" \
  --labels "architecture,design,needs-review"
```

### Step 3: UI/UX Design

```bash
# Branch cho design assets
gitnexus branch create "UI UX design system and component specs" \
  --from "develop"

# Commit design tokens
gitnexus commit --type "feat" --scope "design" \
  --message "add design tokens for colors, typography, spacing"

# Commit component specs
gitnexus commit --type "docs" --scope "design" \
  --message "add component specification for Button, Input, Modal, Table"

# PR
gitnexus pr create \
  --title "feat(design): add design system v1.0" \
  --base "develop" \
  --reviewers "ui-ux,frontend-dev,pm" \
  --labels "design,ui-ux,needs-review"
```

### Step 4: Backend Development

```bash
# Feature branches từ develop
gitnexus branch create "user authentication API endpoints" \
  --from "develop"
# → Creates: feature/user-authentication-api-endpoints

# Smart commits trong development
gitnexus commit  # Let GitNexus analyze và suggest message

# Hoặc manual commit
gitnexus commit --type "feat" --scope "auth" \
  --message "implement JWT authentication with refresh token rotation"

gitnexus commit --type "feat" --scope "api" \
  --message "add POST /api/v1/auth/login endpoint"

gitnexus commit --type "feat" --scope "api" \
  --message "add POST /api/v1/auth/logout with token blacklisting"

gitnexus commit --type "test" --scope "auth" \
  --message "add unit tests for auth service, 95% coverage"

gitnexus commit --type "feat" --scope "db" \
  --message "add migration for users and refresh_tokens tables"

# Trước khi tạo PR - analyze changes
gitnexus pr analyze --base "develop"
# → Check breaking changes, security, test coverage

# Security scan
gitnexus security scan
# → Must pass before creating PR

# Kiểm tra code quality
gitnexus health
# → Check complexity, duplication

# Tạo PR
gitnexus pr create \
  --title "feat(auth): implement JWT authentication system" \
  --base "develop" \
  --reviewers "tech-lead" \
  --labels "backend,feature,needs-review"

gitnexus pr describe --auto
# → Auto-generate description từ commit history và diff
```

### Step 5: Frontend Development

```bash
# Branch từ develop
gitnexus branch create "login page and authentication flow" \
  --from "develop"
# → Creates: feature/login-page-and-authentication-flow

# Commits
gitnexus commit --type "feat" --scope "ui" \
  --message "add LoginPage component with form validation"

gitnexus commit --type "feat" --scope "api" \
  --message "integrate auth API service with token management"

gitnexus commit --type "feat" --scope "store" \
  --message "add auth store with persist and session handling"

gitnexus commit --type "test" --scope "ui" \
  --message "add component tests for LoginPage and AuthForm"

gitnexus commit --type "perf" --scope "ui" \
  --message "optimize bundle size with code splitting for auth routes"

# Check performance impact
gitnexus perf analyze --file "src/pages/auth/"

# PR
gitnexus pr create \
  --title "feat(ui): implement login page and auth flow" \
  --base "develop" \
  --reviewers "tech-lead,ui-ux" \
  --labels "frontend,feature,needs-review,needs-design-review"
```

### Step 6: Integration Testing

```bash
# Branch cho integration fixes
gitnexus branch create "integration fixes post-testing" \
  --from "develop"

# Commit fixes tìm thấy trong integration
gitnexus commit --type "fix" --scope "api" \
  --message "fix CORS configuration for frontend origin"

gitnexus commit --type "fix" --scope "auth" \
  --message "fix token expiry timing mismatch between frontend and backend"

# Track integration test results
gitnexus commit --type "test" --scope "integration" \
  --message "add E2E tests for complete user registration flow"

# Breaking changes detection
gitnexus breaking-changes --base "main" --head "develop"
# → List any API changes that might affect frontend
```

### Step 7: QA Testing

```bash
# Branches cho bug fixes từ QA
gitnexus branch create "fix BUG-042 user profile image not saving" \
  --from "develop"
# → Creates: fix/bug-042-user-profile-image-not-saving

gitnexus commit --type "fix" --scope "api" \
  --message "fix image upload path handling for user profiles"

gitnexus commit --type "test" --scope "api" \
  --message "add regression test for image upload bug BUG-042"

# PR cho bug fixes - link đến bug report
gitnexus pr create \
  --title "fix(api): resolve user profile image upload failure" \
  --base "develop" \
  --reviewers "tech-lead,qa" \
  --labels "bug,backend,qa-verified"

# Sau khi QA verify fix
gitnexus review approve --pr "<pr-number>" \
  --comment "QA verified: BUG-042 resolved. Test TC-089 passing on staging."
```

### Step 8: DevOps Deployment

```bash
# Infrastructure branch
gitnexus branch create "setup production infrastructure" \
  --from "main"

# IaC commits
gitnexus commit --type "feat" --scope "infra" \
  --message "provision EKS cluster with 3 node groups"

gitnexus commit --type "ci" --scope "pipeline" \
  --message "add complete CI/CD pipeline with 6 stages"

gitnexus commit --type "feat" --scope "infra" \
  --message "configure monitoring stack: Prometheus, Grafana, Loki"

# Release branch preparation
gitnexus branch create "release/v1.0.0" --from "develop"

# Version bump
gitnexus commit --type "chore" --scope "release" \
  --message "bump version to 1.0.0 and update changelog"

# Production deployment PR
gitnexus pr create \
  --title "deploy: release v1.0.0 to production" \
  --base "main" \
  --reviewers "tech-lead,pm,devops" \
  --labels "deployment,production,release"

gitnexus pr describe --auto
# → Include deployment checklist, rollback plan
```

### Step 9: Review & Release

```bash
# Final merge
gitnexus merge --pr "<release-pr-number>" \
  --strategy "merge"  # Keep full history for release

# Tag release
gitnexus tag create "v1.0.0" \
  --message "Release v1.0.0: {brief description}"

# Generate release notes
gitnexus release notes \
  --from "v0.9.0" \
  --to "v1.0.0" \
  --format "markdown|github-release"

# Post-release: merge back to develop
gitnexus branch create "sync main to develop after release" \
  --from "main"
gitnexus merge "main" --into "develop" --strategy "merge"
```

