# Code review — Frontend & test checklists

> **Lazy reference** — load when reviewing UI components or tests. Hub: [../SKILL.md](../SKILL.md).

### 4.4 Frontend Components

```markdown
## Component Review Checklist

### React/Vue/Angular Specifics
- [ ] Props/inputs có proper TypeScript types
- [ ] Default props defined cho optional props
- [ ] Event handlers cleanup trong useEffect/onUnmounted
- [ ] Không có memory leaks (subscriptions, timers, event listeners)
- [ ] React: Keys trong lists (không use index khi avoidable)
- [ ] React: Dependencies array trong useEffect complete

### Rendering Performance
- [ ] Unnecessary re-renders avoided (memo, useMemo, useCallback khi cần)
- [ ] Large lists virtualized (react-virtuoso, tanstack-virtual)
- [ ] Images lazy loaded khi ngoài viewport
- [ ] Heavy components lazy loaded với dynamic import

### Accessibility
- [ ] Semantic HTML elements (button không phải div với onClick)
- [ ] ARIA labels cho icon-only buttons
- [ ] Form inputs có associated labels
- [ ] Error messages linked với aria-describedby
- [ ] Tab order logical
- [ ] Focus management sau modal/dialog close

### State Management
- [ ] State minimal (không over-state)
- [ ] Server state managed với React Query/SWR (không local state)
- [ ] Loading, error, empty states đều handled
- [ ] Optimistic updates với proper rollback

### Styling
- [ ] Design tokens used (không hardcoded colors/spacing)
- [ ] Responsive - tested tất cả breakpoints
- [ ] Dark mode support nếu applicable
```

### 4.5 Test Files

```markdown
## Test Review Checklist

### Test Quality
- [ ] Tests có descriptive names (describes behavior, not implementation)
- [ ] Single assertion per test concept (AAA pattern: Arrange, Act, Assert)
- [ ] Tests independent (không order-dependent)
- [ ] Edge cases và error paths covered
- [ ] No test logic errors (asserting wrong thing)

### Mocking
- [ ] Mocks match actual interfaces
- [ ] Không over-mock (integration tests với real dependencies khi có thể)
- [ ] Mock cleanup in afterEach

### Coverage
- [ ] Happy path covered
- [ ] Error paths covered (exceptions, network errors, invalid input)
- [ ] Boundary conditions tested
- [ ] Critical business logic >= 90% coverage

### E2E Tests
- [ ] Tests stable (không flaky với timeouts/race conditions)
- [ ] Test data isolated (cleanup after test)
- [ ] Selectors accessible-friendly (role > label > testid > CSS)
```
