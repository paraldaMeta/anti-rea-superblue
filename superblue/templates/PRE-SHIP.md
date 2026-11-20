# Pre-ship checklist (releaseguard / antirea mindset)

- [ ] Private source, keys, and `.env` live **outside** the directory you ship (`dist/`, `out/`).
- [ ] `superblue scan <ship-tree> --block-level high` → exit 0
- [ ] `superblue strip-dist <ship-tree>` (no `.map`, no `sourceMappingURL` comments)
- [ ] Production bundle: `superblue run … --no-tarpit` (scanner-clean)
- [ ] Valuable logic + authorization on **your server** (`../server-lock/` reference)
- [ ] Agent/client constitution shipped (`CLIENT-CONSTITUTION.md`)