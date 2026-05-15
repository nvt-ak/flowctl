# GitNexus: intro & CLI reference

> Lazy reference — [SKILL.md](../SKILL.md)

# Kỹ Năng Tích Hợp GitNexus
# Skill: GitNexus Git Intelligence Integration | Version: 1.0.0

## 1. Giới Thiệu GitNexus

GitNexus là công cụ git intelligence được sử dụng để enhance tất cả git operations với AI-powered intelligence. GitNexus cung cấp:
- **Smart commits**: Tự động generate descriptive commit messages từ diff
- **Branch strategy**: Intelligent branch naming và management
- **PR automation**: Generate PR descriptions, detect breaking changes
- **Code review**: Automated code analysis, security scanning, complexity check
- **Merge intelligence**: Conflict resolution suggestions, merge strategy recommendations
- **Repository insights**: Code health metrics, contribution analytics

## 2. GitNexus CLI Reference

### 2.1 Branch Operations

```bash
# Tạo branch mới với smart naming
gitnexus branch create "<description>" --from "<base-branch>"
# → Tự động suggest: feature/us-001-user-authentication

# List branches với context
gitnexus branch list --status
# → Shows: branch name, last commit, days since last commit, open PRs

# Analyze branch health
gitnexus branch health "<branch-name>"
# → Shows: divergence from base, conflicts risk, stale status

# Clean up merged branches
gitnexus branch cleanup --merged --older-than "30d"

# Get branch naming suggestion
gitnexus branch suggest "<ticket-id>" "<description>"
# → Outputs: feature/us-001-add-user-profile
```

### 2.2 Commit Operations

```bash
# Smart commit (analyzes diff to generate message)
gitnexus commit
# → Analyzes staged changes, suggests commit message following conventional commits

# Commit với specific type
gitnexus commit --type "feat" --scope "api" \
  --message "add user profile endpoint with avatar upload"

# Commit với breaking change notice
gitnexus commit --type "feat" --scope "api" \
  --message "change user ID format from integer to UUID" \
  --breaking "User ID format changed from int to UUID, requires migration"

# Batch commit (commit multiple logical changes separately)
gitnexus commit --batch
# → Interactive: groups related changes into separate commits

# Validate commit message before committing
gitnexus commit validate "<message>"
# → Returns: valid/invalid with feedback

# Show commit history in smart format
gitnexus log --format "smart" --since "1 week ago"
```

### 2.3 Pull Request Operations

```bash
# Create PR với smart description
gitnexus pr create \
  --title "<title>" \
  --base "<base-branch>" \
  --reviewers "<comma,separated,usernames>" \
  --labels "<comma,separated,labels>"

# Auto-generate PR description từ commit history
gitnexus pr describe --pr "<pr-number>"
gitnexus pr describe --auto  # Generate for current branch's pending PR

# Analyze PR before creation
gitnexus pr analyze --base "<base-branch>"
# → Shows: files changed, breaking changes, security findings, test coverage delta

# Update PR description
gitnexus pr update --pr "<pr-number>" --description "<new-description>"

# Check PR status
gitnexus pr status --pr "<pr-number>"
# → Shows: CI status, review status, conflicts, merge readiness

# List PRs with smart filtering
gitnexus pr list --status "open|review-needed|approved|blocked"

# Merge PR với strategy
gitnexus merge --pr "<pr-number>" --strategy "squash|rebase|merge"

# Close PR without merging
gitnexus pr close --pr "<pr-number>" --reason "<reason>"
```

### 2.4 Code Review Operations

```bash
# Automated review của PR
gitnexus review --pr "<pr-number>"
# → Full analysis: style, security, performance, complexity

# Review specific files
gitnexus review --files "src/api/*.ts" \
  --focus "security,performance"

# Review với specific criteria
gitnexus review --pr "<pr-number>" \
  --check "conventional-commits,test-coverage,security,performance"

# Add review comment
gitnexus review comment --pr "<pr-number>" \
  --file "<file-path>" \
  --line "<line-number>" \
  --comment "<review comment>" \
  --type "BLOCKER|IMPORTANT|SUGGESTION|NITPICK"

# Approve PR
gitnexus review approve --pr "<pr-number>" \
  --comment "<optional approval message>"

# Request changes
gitnexus review request-changes --pr "<pr-number>" \
  --comment "<what needs to change>"

# Get review summary
gitnexus review summary --pr "<pr-number>"
# → Shows: all comments grouped by file and severity
```

### 2.5 Repository Intelligence

```bash
# Code health metrics
gitnexus health
# → Shows: test coverage, complexity, duplication, dependency health

# Security scan
gitnexus security scan
# → SAST analysis: vulnerabilities, hardcoded secrets, dependency CVEs

gitnexus security scan --type "sast|dast|dependency|secrets"

# Performance analysis
gitnexus perf analyze --file "<file-path>"
# → Identifies potential performance issues

# Detect breaking changes
gitnexus breaking-changes --base "<branch>" --head "<branch>"
# → Lists: API changes, removed exports, signature changes

# Dependency analysis
gitnexus deps analyze
# → Shows: dependency tree, unused deps, outdated deps, security issues

gitnexus deps update --type "patch|minor|major" --dry-run

# Git blame intelligence
gitnexus blame "<file-path>" --lines "<start>-<end>"
# → Shows: who changed what, linked to PRs and issues

# Contribution analytics
gitnexus stats --period "sprint|month|quarter"
# → Per-agent/author: commits, PRs, reviews, code added/removed
```

### 2.6 Merge & Conflict Operations

```bash
# Smart merge với conflict suggestions
gitnexus merge "<branch>" --smart
# → Analyzes conflicts, suggests resolution strategies

# Check merge feasibility before merging
gitnexus merge check "<source>" --into "<target>"
# → Shows: conflict risk, test impact, breaking changes

# Resolve conflicts with AI assistance
gitnexus conflict resolve "<file>"
# → Suggests resolution based on intent of both changes

# Cherry-pick với context
gitnexus cherry-pick "<commit-sha>" --context
# → Explains what the commit does, confirms before applying

# Rebase với smart handling
gitnexus rebase "<base-branch>" --smart
# → Handles conflicts intelligently, maintains commit history integrity
```

