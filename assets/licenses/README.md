# Supplemental license notices

These files supplement upstream npm packages that omit license text, and document the
MIT icon set used by the renderer. Original upstream text is retained without editing.

Retrieved on 2026-10-13:

| File                                 | Upstream source                                                                          |
| ------------------------------------ | ---------------------------------------------------------------------------------------- |
| `tabler-icons.txt`                   | https://github.com/tabler/tabler-icons/blob/main/LICENSE                                 |
| `agent-base.txt`                     | https://github.com/TooTallNate/proxy-agents/blob/main/packages/agent-base/LICENSE        |
| `https-proxy-agent.txt`              | https://github.com/TooTallNate/proxy-agents/blob/main/packages/https-proxy-agent/LICENSE |
| `cookie-signature.txt`               | https://github.com/tj/node-cookie-signature/blob/master/LICENSE                          |
| `@rollup__rollup-win32-x64-gnu.txt`  | https://github.com/rollup/rollup/blob/master/LICENSE.md                                  |
| `@rollup__rollup-win32-x64-msvc.txt` | https://github.com/rollup/rollup/blob/master/LICENSE.md                                  |

`mit-template.txt` contains the standard MIT permission and disclaimer text. It is used
only with a visible review warning for packages that declare MIT but do not supply
their own license/copyright notice. It does not invent or replace a copyright holder.
Currently `@epic-web/invariant@1.0.0` requires that confirmation.

`jy-headless.txt` supplies the existing MIT license with attribution to `jiyoon`, the
author identified in package metadata. Ownership was confirmed by the author on
2026-10-13. This supplements Groomi's distribution; the upstream package is unchanged.

`scripts/generate-license-notices.mjs` regenerates the offline notice index at build time
from installed production dependencies, supplemental files, SUIT and Electron notices.
Review supplemental notices when updating the associated dependencies.
