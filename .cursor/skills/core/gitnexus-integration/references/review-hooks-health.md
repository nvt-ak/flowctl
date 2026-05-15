# GitNexus: review, commits, hooks, health, tips

> Lazy reference — [SKILL.md](../SKILL.md)

## 4. Code Review Workflow với GitNexus

### 4.1 Reviewer Workflow
```bash
# 1. Get PR context
gitnexus pr status --pr "<pr-number>"
gitnexus pr describe --pr "<pr-number>"

# 2. Automated analysis
gitnexus review --pr "<pr-number>"
# → Full automated review report

# 3. Manual review nếu cần focus vào specific areas
gitnexus review --pr "<pr-number>" \
  --focus "security,performance,architecture"

# 4. Add targeted comments
gitnexus review comment --pr "<pr-number>" \
  --file "src/api/auth.service.ts" \
  --line "45" \
  --comment "[BLOCKER] This token comparison is vulnerable to timing attacks. Use crypto.timingSafeEqual() instead." \
  --type "BLOCKER"

gitnexus review comment --pr "<pr-number>" \
  --file "src/api/user.service.ts" \
  --line "123" \
  --comment "[SUGGESTION] Consider caching this user lookup since it's called frequently." \
  --type "SUGGESTION"

# 5. Final review decision
# If everything looks good:
gitnexus review approve --pr "<pr-number>" \
  --comment "LGTM. Well-structured code with good test coverage. One nitpick resolved."

# If changes needed:
gitnexus review request-changes --pr "<pr-number>" \
  --comment "Please address the BLOCKER comments before re-review."

# 6. After changes are made, re-review
gitnexus review --pr "<pr-number>" --only-changed
# → Review only changed files since last review
```

### 4.2 Author Response Workflow
```bash
# Check review comments
gitnexus review summary --pr "<pr-number>"

# Address each comment
# Make changes locally...
gitnexus commit --type "fix" --scope "<scope>" \
  --message "address review: use timingSafeEqual for token comparison"

# Push updates
git push

# Mark comments as resolved (hoặc respond)
gitnexus review resolve --pr "<pr-number>" \
  --comment-id "<id>" \
  --response "Fixed by using crypto.timingSafeEqual() in commit abc1234"

# Request re-review
gitnexus pr update --pr "<pr-number>" \
  --ready-for-review \
  --comment "All BLOCKER and IMPORTANT comments addressed. Ready for re-review."
```

## 5. Smart Commit Message Examples

### feat commits
```bash
# Backend feature
gitnexus commit --type "feat" --scope "api" \
  --message "add user profile management endpoints

Implements CRUD operations for user profiles:
- GET /api/v1/users/profile - get current user profile
- PUT /api/v1/users/profile - update profile fields
- POST /api/v1/users/profile/avatar - upload avatar image

Closes US-023"

# Frontend feature
gitnexus commit --type "feat" --scope "ui" \
  --message "implement dashboard analytics widgets

Add 4 real-time analytics widgets:
- Active users counter
- Revenue chart (7-day sparkline)
- Recent activity feed
- System health indicators

All widgets use React Query for data fetching with 30s refresh."
```

### fix commits
```bash
gitnexus commit --type "fix" --scope "auth" \
  --message "fix refresh token not invalidated on logout

Previously, refresh tokens were stored but not blacklisted on logout,
allowing reuse of expired sessions.

Fix: Add token to Redis blacklist on logout with TTL matching token expiry.

Fixes BUG-031"
```

### Breaking changes
```bash
gitnexus commit --type "feat" --scope "api" \
  --message "change pagination from page/limit to cursor-based

BREAKING CHANGE: The pagination API has changed from page/limit model
to cursor-based pagination for better performance with large datasets.

Before: GET /api/v1/items?page=2&limit=20
After:  GET /api/v1/items?cursor=<base64>&limit=20

Response now includes 'nextCursor' instead of 'totalPages'.
Frontend must be updated to use new cursor pagination model.

Implements ADR-007"
```

## 6. GitNexus Hooks và Automation

### 6.1 Pre-commit Hooks (Auto-configured by GitNexus)
```bash
# GitNexus tự động cài đặt:
# - Commit message linting (conventional commits)
# - Secret scanning (block commits với secrets)
# - Large file detection (> 10MB)

# Cấu hình
gitnexus hooks configure \
  --commit-msg "conventional-commits" \
  --pre-commit "lint-staged,secret-scan" \
  --pre-push "tests"
```

### 6.2 GitNexus CI Integration
```yaml
# GitHub Actions với GitNexus
- name: GitNexus Analysis
  uses: gitnexus/action@v2
  with:
    token: ${{ secrets.GITNEXUS_TOKEN }}
    checks: |
      conventional-commits
      breaking-changes
      security
      test-coverage
    comment-on-pr: true
    fail-on: "BLOCKER"
```

## 7. Repository Health Monitoring

```bash
# Weekly health check
gitnexus health --full-report

# Output bao gồm:
# - Test coverage trend (last 4 weeks)
# - Complexity trend
# - Dependency health
# - Open PR age (identify stale PRs)
# - Security findings
# - Code duplication trend

# Technical debt report
gitnexus debt report --period "sprint"
# → Shows technical debt items, estimated fix effort

# Security dashboard
gitnexus security dashboard
# → All open security findings với severity và age

# Dependency update suggestions
gitnexus deps update --dry-run
# → Safe updates (patch level): auto-approve candidates
# → Minor/major updates: require manual review
```

## 8. GitNexus Tips và Best Practices

### 8.1 Atomic Commits
```bash
# GOOD: Một commit, một logical change
gitnexus commit --type "feat" --scope "api" \
  --message "add email validation to user registration"

# BAD: Nhiều unrelated changes trong một commit
# → Use gitnexus commit --batch để tách ra
```

### 8.2 Informative PR Titles
```bash
# GOOD: Clear type, scope, và description
"feat(auth): implement OAuth 2.0 Google login integration"
"fix(api): resolve N+1 query in user profile endpoint"
"perf(db): add composite index for order search queries"

# BAD: Vague titles
"fix bug"
"update code"
"WIP"
```

### 8.3 Branch Hygiene
```bash
# Check stale branches regularly
gitnexus branch list --stale --older-than "14d"

# Clean up after PR merge
gitnexus branch cleanup --merged --dry-run
gitnexus branch cleanup --merged  # Actually delete after review
```

### 8.4 Tag Strategy
```bash
# Semantic versioning tags
gitnexus tag create "v{major}.{minor}.{patch}"
# v1.0.0 = major release
# v1.1.0 = new feature(s)
# v1.1.1 = bug fix(es)
# v1.1.1-beta.1 = pre-release
```
