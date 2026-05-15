# Security review — authentication and I/O boundaries

> Lazy reference — [SKILL.md](../SKILL.md)

## 2. Authentication review notes

- Passwords: Argon2id or bcrypt with work factor appropriate to hardware.
- Sessions: secure, HttpOnly, SameSite; rotation on privilege change.
- JWTs: short-lived access; refresh handling; reject `none` alg; validate `aud` / `iss`.
- API keys: store hashed; scope minimally; revoke path documented.
- MFA: policy for privileged roles; recovery codes stored safely.

## 3. Input and output handling

- Validate type, length, format, and allow-lists at trust boundaries.
- Encode output by context (HTML, JS, URL, CSS).
- File uploads: content-type sniffing vs extension, size caps, virus scan if required, storage outside web root.
- Redirects: allow-list hosts; reject `javascript:` and odd schemes.
