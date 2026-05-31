# @zobr/scaffold

The canonical ZS-library scaffold the server **materializes** into a ZS library
folder (doc 08 §2, doc 09 §8), plus tests proving it enforces what the spec says.

`lib-template/` — single source of truth for ZS authoring:
- `zs.cognitive.d.ts` / `zs.server.d.ts` — canonical operation signatures (doc 02 / 09 §1)
- `tsconfig.*.json` — two TS environments split by `*.cog.ts` / `*.srv.ts` (doc 09 §3)

`test/` — fixtures + a Vitest suite that runs `tsc` against them and asserts:
- a valid script (cross-script `run` contract) **typechecks**,
- a cross-script contract mismatch is **rejected** (doc 09 §4),
- a server module using `fetch` is **rejected** (capability-as-types, doc 09 §5).

The structural AST fence (eval/Function, uncapped loops, catch-then-retry on
refusal — doc 09 §6) is **slice 3**; slice 1 covers the type-level fence above.
