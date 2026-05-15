# Code review — Philosophy & comment taxonomy

> **Lazy reference** — load only when you need mindset, `[BLOCKER]` / `[IMPORTANT]` taxonomy, or comment templates. Hub: [../SKILL.md](../SKILL.md).

# Kỹ Năng Code Review
# Skill: Code Review | Used by: Tech Lead, all developers | Version: 1.0.0

## 1. Triết Lý Code Review

Code review không chỉ là tìm bugs - đây là quá trình collaborative learning, knowledge sharing, và maintaining collective code ownership. Mục tiêu:
- **Quality**: Bắt defects sớm trước khi reach production
- **Knowledge sharing**: Spread domain và technical knowledge
- **Consistency**: Maintain codebase style và patterns
- **Mentoring**: Help junior developers grow
- **Security**: Catch security vulnerabilities

## 2. Review Mindset

### 2.1 Reviewer Mindset
- **Collaborative, not adversarial**: "We" not "you" - chúng ta cùng improve code
- **Specific, not vague**: "Line 45 has N+1 query" not "performance is bad"
- **Constructive**: Always suggest alternative nếu có thể
- **Kind và respectful**: Critique code, not the person
- **Thorough but timely**: Review kỹ nhưng trong SLA

### 2.2 Author Mindset
- **Grateful, not defensive**: Reviews make code better
- **Understand before responding**: Read carefully, ask clarification nếu unclear
- **Explain your reasoning**: Context helps reviewers understand decisions
- **Small PRs are better**: Easier to review, faster feedback

## 3. Review Comment Categories

### 3.1 Comment Severity Levels
```
[BLOCKER]  - Phải fix TRƯỚC KHI merge. Security issues, correctness bugs,
             breaking changes không documented. Stops PR.

[IMPORTANT] - Strong recommendation. Should fix unless có valid reason.
              Discuss before proceeding. May delay merge.

[SUGGESTION] - Nice to have. Author decides. Won't block merge.
               Good for future consideration.

[NITPICK]  - Minor style/formatting. Author's call. Encouraged to fix
             but won't block.

[QUESTION] - Cần giải thích. Không nhất thiết có vấn đề.
             Phải trả lời.

[PRAISE]   - Positive feedback. Acknowledge good work.
             No action needed.

[INFO]     - Educational note. Sharing knowledge.
             No action needed.
```

### 3.2 Comment Format
```markdown
**[BLOCKER] Security: SQL Injection vulnerability**

The query on line 47 directly interpolates user input:
```sql
SELECT * FROM users WHERE name = '${userName}'
```

This is vulnerable to SQL injection. Use parameterized queries:
```sql
SELECT * FROM users WHERE name = $1
// With: [userName]
```

Ref: OWASP SQL Injection Prevention Cheat Sheet
```
