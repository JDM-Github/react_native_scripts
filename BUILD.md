# Windows Build Hardening Roadmap

A backlog, not a specification. Every item below is scoped to what **this** repo
is: a scaffold tool whose `config.build` action wraps somebody else's Expo Web
export in the Electron shell under `scripts/electron/`. Nothing here is
implemented yet.

Items are numbered so they can be referenced in commits and issues. Pick one,
read its steps, do it. They are grouped by what it costs to start:

- **Tier 1 (items 1-12)** — free, local, no certificate, no account, no server.
- **Tier 2 (item 13)** — costs money; the only thing that establishes publisher identity.
- **Tier 3 (items 14-17)** — needs infrastructure that does not exist here, and mostly belongs in the *generated* project rather than this repo.
- **Tier 4** — impossible or pointless. Documented so nobody spends a week on it.

## The one fact that governs all of this

If someone has the source, they can compile their own copy. That cannot be
prevented. ASAR, minification, obfuscation, matching filenames, and published
SHA-256 hashes establish **nothing** about who published a build.

The only real boundary is the **private code-signing key**. Anyone can produce
an unofficial build; only a controlled signing system can produce one whose
Windows Authenticode signature names the company. Everything in Tier 1 is
defense of the *running app*; only Tier 2 defends the *identity*.

## What this repo currently does

Facts, from `scripts/electron/main.cjs`, `scripts/electron/package.json`, and
`scripts/build-platform.mjs`:

| Area | State |
| --- | --- |
| Renderer isolation | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Good. |
| Preload / IPC | **None at all.** No preload script, no `ipcMain` handlers, no `contextBridge`. This is the strongest possible position — do not add a preload API to satisfy a checklist. |
| Asset delivery | A real HTTP server on `127.0.0.1:<random port>`. See item 5 — this is the weakest part of the design. |
| Path traversal | `resolveAssetPath` resolves and checks a `sep`-terminated prefix. Correct already. |
| Navigation guard | `url.startsWith(appOrigin)` — see item 1. |
| External URLs | Allows `http:` as well as `https:`, no allowlist, unguarded `new URL()` — see item 2. |
| Permissions | `setPermissionRequestHandler` denies everything. Good. |
| CSP | Absent. |
| Electron fuses | Not configured. `RunAsNode` is therefore enabled. |
| App identity | Hardcoded: `appId com.react.name.desktop`, `productName "React Native Structure"`, `version 1.0.0` — for *every* project built. See item 6. |
| Signing | None. Installers ship as `Unknown Publisher`. |
| Updater | None. |
| CI | None. No `.github`, no test runner, no linter, no type-checker. |

## Two products, two threat models

Do not conflate them:

- **This tool.** It writes files into a caller-supplied `--project-root` — a real
  codebase. Its threat model is a stray write, and its mitigation is the path
  containment already in `scripts/finalize-scaffold-template.mjs`. Largely
  solved; keep it that way.
- **The generated app's installer.** Everything below.

---

# Tier 1 — Free and local

Suggested order: 1-4 are an afternoon. 5 and 6 are the real work and unlock
everything downstream. 7-12 follow cheaply.

## 1. Replace the prefix-based navigation guard

- **Benefits:** `url.startsWith(appOrigin)` is bypassable. With `appOrigin` of
  `http://127.0.0.1:53211`, the URL `http://127.0.0.1:53211.evil.com/` passes
  the check and loads a remote page *inside the app window*, keeping the app's
  window and any privileges attached to it. Comparing parsed origins closes it
  outright, and a single helper stops the same mistake reappearing.
- **How?**
-- Step 1: Add a helper to `scripts/electron/main.cjs`:
   ```javascript
   function isAppUrl(candidate) {
     try {
       return new URL(candidate).origin === appOrigin;
     } catch {
       return false;
     }
   }
   ```
-- Step 2: Change the `will-navigate` handler to use `if (!isAppUrl(url))`.
-- Step 3: Also handle `will-frame-navigate` and `will-redirect`, which
   `will-navigate` does not cover.
-- Step 4: Verify by hand — build, open devtools, and set
   `location = "http://127.0.0.1:<port>.example.com"`. It must not navigate.

## 2. Restrict external URL opening

- **Benefits:** Today any `http:` URL is handed to the OS, so a compromised or
  malicious page can drive the user to a plaintext origin. Worse, `new URL()`
  throws on a malformed string and the call sits inside
  `setWindowOpenHandler`, so a crafted `window.open()` argument raises inside a
  handler that has no catch. https-only plus a guard makes the failure mode
  "nothing happens" instead of "unhandled exception".
- **How?**
-- Step 1: Wrap the body of `openExternalUrl` in `try/catch` and return on parse failure.
-- Step 2: Allow only `parsedUrl.protocol === "https:"`. Drop `http:`.
-- Step 3: Reject `file:`, `javascript:`, `data:`, and any custom scheme by
   virtue of that allowlist being positive, not negative.
-- Step 4: A hostname allowlist is *not* achievable in a generic shell — this
   shell serves an unknown app. Note that in a comment so the gap is a decision
   rather than an oversight, and revisit it if per-project config lands (item 6).

## 3. Serve a Content Security Policy

- **Benefits:** The app is an arbitrary Expo Web export. A CSP is what keeps an
  XSS in that export from loading remote script, and the asset server already
  writes headers, so this is a few lines rather than a refactor. It also means
  `connect-src` documents which backends the desktop build may talk to.
- **How?**
-- Step 1: Add a `Content-Security-Policy` header alongside the existing
   `X-Content-Type-Options` in `startAssetServer`.
-- Step 2: Start from:
   ```text
   default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
   img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self';
   object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'
   ```
-- Step 3: Keep `'unsafe-inline'` for `style-src` only. React Native Web injects
   inline styles, so removing it breaks the app; do **not** grant it to
   `script-src`, and never add `'unsafe-eval'`.
-- Step 4: `connect-src` has to be per-project, because the API host differs per
   app. Until item 6 lands, leave it `'self'` and let the build fail loudly in
   testing rather than pre-widening it.
-- Step 5: If item 5 is done first, set this in the `protocol.handle` response
   headers instead.

## 4. Make the security-relevant `webPreferences` explicit

- **Benefits:** The current defaults are safe, but they are *defaults* — a future
  Electron major can change one, and nothing in the file records the intent.
  Writing them down converts "safe by accident" into "safe on purpose" and gives
  item 11 something to assert against.
- **How?**
-- Step 1: In `createWindow`, add `webSecurity: true`,
   `allowRunningInsecureContent: false`, `experimentalFeatures: false`,
   `nodeIntegrationInWorker: false`, `webviewTag: false`.
-- Step 2: Add a comment stating that none of these may be weakened to fix an
   integration problem.
-- Step 3: Do **not** add a preload script. There is no IPC in this shell and
   none is needed; a preload is new attack surface, not a hardening step.

## 5. Replace the loopback HTTP server with a custom protocol

- **Benefits:** This is the highest-value change in the document. Today every
  packaged asset is readable by any process — or any page — that can reach
  `127.0.0.1:<port>`, the port is discoverable by scanning, and because the
  origin is `http:` the renderer is a **non-secure context**: no `crypto.subtle`,
  no service workers, and it shares localhost origin space with anything else
  listening. A privileged custom scheme fixes the port exposure, the origin
  check in item 1, CSP delivery, and the secure-context problem in one move, and
  removes an entire HTTP server from the app.
- **How?**
-- Step 1: Before `app.whenReady()`, register the scheme:
   ```javascript
   protocol.registerSchemesAsPrivileged([
     {
       scheme: "app",
       privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
     },
   ]);
   ```
   `standard: true` is required for the origin to parse; `secure: true` is what
   grants secure-context status.
-- Step 2: Inside `whenReady`, call `protocol.handle("app", ...)` and return a
   `Response` built from the resolved file. Keep the existing containment logic
   from `resolveAssetPath` verbatim — it is already correct — and keep the
   index.html fallback for client-side routing.
-- Step 3: Set `Content-Type` from the existing `MIME_TYPES` map and attach the
   CSP from item 3 to the response headers.
-- Step 4: Load `app://bundle/index.html` and set `appOrigin = "app://bundle"`.
   Note that the host segment is part of the origin.
-- Step 5: Delete `startAssetServer`, the `node:http` import, the
   `before-quit` close handler, and `assetServer`.
-- Step 6: Test the traversal case explicitly — `app://bundle/../../secret` must
   403, not resolve.

## 6. Derive app identity and version from the target project

- **Benefits:** Right now every installer this tool produces, for every project,
  is stamped `version 1.0.0`, `productName "React Native Structure"`,
  `appId com.react.name.desktop`. `scripts/build-platform.mjs` already computes
  the real `versionTag` from the project's Expo config but spends it only on
  folder and artifact names. Until this is fixed, nothing downstream can be
  correct: two different apps collide on one `appId` in the registry and install
  path, Add/Remove Programs shows the wrong product, no update or downgrade check
  is meaningful, and there is no coherent answer to "whose certificate signs
  this?"
- **How?**
-- Step 1: In the `windows` branch of `scripts/build-platform.mjs`, read the
   already-loaded `expoConfig` for name, slug, version, and an Android/iOS
   bundle identifier to base `appId` on.
-- Step 2: Pass them as electron-builder CLI overrides rather than editing the
   committed `scripts/electron/package.json`:
   `-c.appId=...`, `-c.productName=...`, `-c.extraMetadata.version=<version>`.
   Version comes from `package.json`, so `extraMetadata` is the mechanism that
   changes it. Confirm the exact flags against the installed
   `electron-builder` (`^26.15.3`) before relying on them.
-- Step 3: Do **not** move `directories.output` or `extraResources`. Those two
   paths are deliberately coupled — `../../.build-temp/windows-web` and
   `../../.build-temp/windows-installer` are relative to `scripts/electron/`, and
   moving one requires moving the other. CLI overrides avoid touching them at all.
-- Step 4: Fail the build with a sentence if the project's Expo config has no
   version or no usable identifier, rather than silently falling back to `1.0.0`.
-- Step 5: Feed the resolved API origin into the `connect-src` left open in item 3.

## 7. Configure Electron fuses

- **Benefits:** With `RunAsNode` enabled, the shipped executable doubles as a
  general-purpose Node interpreter — and once item 13 lands, a *signed* one,
  which is exactly the primitive an attacker wants for living-off-the-land
  execution under your publisher name. ASAR integrity additionally makes
  swapping the app bundle inside an installed copy fail closed.
- **How?**
-- Step 1: `npm install --save-dev @electron/fuses --prefix scripts/electron`.
   Only `@electron/get` is present today.
-- Step 2: Add an `afterPack` hook script and reference it from the build config.
-- Step 3: In the hook, `flipFuses` on the packaged executable with
   `RunAsNode: false`, `EnableNodeOptionsEnvironmentVariable: false`,
   `EnableNodeCliInspectArguments: false`, `OnlyLoadAppFromAsar: true`,
   `EnableEmbeddedAsarIntegrityValidation: true`.
-- Step 4: Do not guess fuse names or values — read `@electron/fuses` for the
   set supported by Electron 43.
-- Step 5: Order matters. Flipping fuses rewrites the binary and invalidates any
   existing signature, so it must happen before signing. `afterPack` runs before
   electron-builder signs, which is why the hook belongs there and not in
   `afterSign`.
-- Step 6: Add a post-package assertion that reads the fuse wire back off the
   built exe, so a toolchain change cannot silently drop it.

## 8. Emit checksums and a release manifest

- **Benefits:** Gives anyone receiving an installer something to check, and gives
  future CI something to verify against. A hash proves the bytes did not change
  in transit; it does *not* prove who built them, so this supplements item 13
  rather than substituting for it.
- **How?**
-- Step 1: After `publishDirectory` in `scripts/build-platform.mjs`, hash each
   published artifact with SHA-256. Hash **after** signing, or the digest is of a
   file nobody will ever download.
-- Step 2: Write `<artifact>.sha256` beside each artifact.
-- Step 3: Write one `manifest.json` per publish directory containing product,
   version, `versionCode`, git commit of this tool, git commit of the project if
   available, build timestamp, and an array of `{ file, sha256, size }`.
-- Step 4: Keep the timestamp in the manifest, not compiled into the app.
-- Step 5: Note in the manifest whether the artifact was signed and by which
   subject, so an unsigned dev build is never mistaken for a release.

## 9. Verify signatures as a build gate

- **Benefits:** Writing this before there is a certificate is the point — it
  turns item 13 from a configuration change into a *verified* one, and it catches
  the failure that matters most: a build that silently produced an unsigned or
  wrongly-signed installer and published it anyway. Windows will happily ship
  `Unknown Publisher` without complaint from the toolchain.
- **How?**
-- Step 1: Add a script that enumerates every `.exe` and `.dll` in the publish
   directory — not one hardcoded path.
-- Step 2: For each, run `Get-AuthenticodeSignature` and require `Status` of
   `Valid`, a non-null `TimeStamperCertificate`, and the expected signer.
-- Step 3: Compare the signer by **thumbprint**, or by the `CN=` component
   specifically. Do not string-equal the whole Subject DN — component order and
   spacing vary by CA and by how PowerShell renders it, and the check will fail
   spuriously.
-- Step 4: Add `signtool verify /pa /all /v` as a second, independent check when
   signtool is on the machine.
-- Step 5: While no certificate exists, have it warn and exit 0 behind an
   explicit `--require-signature` flag that exits 1. Flip the default when item 13 lands.
-- Step 6: Never disable timestamping to make this pass.

## 10. Add a self-signed test identity for local verification

- **Benefits:** Lets the whole sign → verify → publish path be exercised today,
  at zero cost, so items 9 and 13 are not both untested on the day a real
  certificate arrives. It also gives developers a way to test installer
  behaviour without touching production signing material.
- **How?**
-- Step 1: Document `New-SelfSignedCertificate` for generating a local test cert,
   as a documented command — never a committed artifact.
-- Step 2: Read the certificate location and password from environment
   variables only, and document them in a `.env.example`-style file with
   obviously-fake placeholder values.
-- Step 3: Gate it behind an explicit `--dev-sign` flag on the build script so it
   can never be reached by a default invocation.
-- Step 4: Have the build print, loudly, that the artifact is test-signed and not
   for distribution, and record that in the item 8 manifest.
-- Step 5: State plainly in the docs that a self-signed certificate is acceptable
   only for local testing or machines where IT deploys the trust root
   deliberately. It is not a release path.

## 11. Add a hardening regression check

- **Benefits:** There is no test runner, linter, or type-checker in this repo, so
  every item above can be silently undone by one edit. A single script that
  asserts the invariants is the cheapest possible guard, and it gives
  `CLAUDE.md`'s "there is nothing to run but the thing itself" an answer.
- **How?**
-- Step 1: Write `scripts/verify-electron-hardening.mjs` that parses
   `scripts/electron/main.cjs` and the build config.
-- Step 2: Assert: `nodeIntegration` false, `contextIsolation` true, `sandbox`
   true, `webSecurity` not disabled, no `startsWith(` in a navigation guard, no
   `http:` in the external-URL allowlist, a CSP is present, no preload registered
   unless deliberately added, `asar` true, the fuses hook is wired.
-- Step 3: Exit 1 with the specific failing invariant named, one per line.
-- Step 4: Run it from `scripts/build-platform.mjs` before packaging, so a Windows
   build cannot complete with a regression in place.
-- Step 5: Document it in `CLAUDE.md` under "Verifying a change".

## 12. Ignore certificate and secret material

- **Benefits:** One line of prevention against the failure that is unrecoverable
  by editing — a committed private key. `.gitignore` currently covers only
  `.build-temp/`, `.changes/`, `build/`, and `node_modules/`.
- **How?**
-- Step 1: Add `*.pfx`, `*.p12`, `*.pem`, `*.key`, `*.cer`, `*.crt`, `.env`,
   `.env.*`, and `!.env.example`.
-- Step 2: Review the certificate patterns before committing them — a *public*
   trust certificate may legitimately need to be versioned. Adapt rather than
   blanket-ignore.
-- Step 3: Remember `.gitignore` does not remove what is already committed.
-- Step 4: Write down the response for a leaked key while it is still
   hypothetical: stop publishing, revoke and rotate the certificate, purge it
   from the working tree and where appropriate from history, audit the signing
   logs — and assume the exposed key is permanently untrustworthy regardless of
   any history rewrite.

---

# Tier 2 — Costs money

## 13. Obtain a publicly trusted code-signing identity

- **Benefits:** The only item that makes a build verifiably *ours*. It is what
  removes `Unknown Publisher`, what lets enterprise policy allowlist the app by
  publisher, and what any future updater checks before installing. Nothing in
  Tier 1 substitutes for it, and no amount of hashing or packaging approximates it.
- **How?**
-- Step 1: Choose a path. **Azure Trusted Signing** is the cheapest credible
   option and keeps the key out of reach entirely; an OV/EV certificate from
   DigiCert, Sectigo, or GlobalSign in an HSM or managed signing service is the
   alternative. MSIX/Microsoft Store is worth considering if distribution allows.
-- Step 2: Configure it. The current electron-builder shape is a nested
   `win.sign` object — confirm against the installed `^26.15.3`, since the older
   API put these keys flat on `win`:
   ```jsonc
   { "win": { "sign": { "type": "azure",
       "publisherName": "CN=<VERIFIED LEGAL NAME>, O=…, C=…",
       "endpoint": "https://<region>.codesigning.azure.net/",
       "codeSigningAccountName": "…", "certificateProfileName": "…" } } }
   ```
   The `signtool` type with a `certificateFile`/`certificatePassword` also works
   but is the option you least want anywhere near shared CI.
-- Step 3: The certificate subject must match the verified legal entity. Record
   the expected identity as non-secret configuration and wire it into item 9.
-- Step 4: Require an RFC 3161 timestamp on every signature, so artifacts stay
   verifiable after the certificate expires.
-- Step 5: Sign the app executable and relevant PE binaries, not only the outer
   installer, and the uninstaller where the packager supports it.
-- Step 6: Never commit a PFX, password, or token; keep signing material out of
   `.env`, build output, logs, tickets, and chat; keep developers' ordinary local
   builds unsigned or on the item 10 test identity.
-- Step 7: Understand what this does **not** buy: SmartScreen. A freshly issued
   certificate still triggers "Windows protected your PC" until download
   reputation accrues. EV certificates and Azure Trusted Signing warm up faster.
   Plan for the warning being visible to early users regardless.
-- Step 8: Before the first public release, write down the certificate serial,
   issuer, expiry, approved subject, named owners, how to suspend releases, how
   to revoke, and how to rotate. Do not auto-trust a new subject or thumbprint
   after rotation — update the approved identity through reviewed config.

---

# Tier 3 — Needs infrastructure, and mostly belongs elsewhere

The structural point: **a release pipeline in this repo would sign nothing
useful.** This repo is a scaffold tool. The artifact is somebody else's app,
built on a developer's machine by the TUI. Protected tags, CI signing, an
updater, and a download origin are properties of the *generated project*.

So the natural form for most of Tier 3 is the one thing this repo is already
good at: writing files into other people's codebases. Ship the pipeline as a
scaffold kind, not as local infrastructure.

## 14. Scaffold a signed-release workflow into generated projects

- **Benefits:** Every project scaffolded by the tool inherits a correct release
  pipeline instead of each one reinventing it, and the pipeline lives where the
  signing identity and the version actually belong. It also means improvements
  to the pipeline propagate through the template, the same way any other
  convention in this repo does.
- **How?**
-- Step 1: Follow the five-step checklist in `CLAUDE.md` under "Adding a scaffold
   kind" — template, `SCAFFOLD_DEFINITIONS`, `primaryPath`/`companions`,
   `ikaika.script.json`, and the catalog in `templates/README.md`. Touch all of
   them or it half-works.
-- Step 2: The template is a CI workflow, wrapped per the template convention
   with `__NAME__`/`__KEBAB_NAME__`/`__TITLE__` placeholders only.
-- Step 3: The workflow it generates should: trigger on a protected `v*` tag;
   verify the tag points at the protected branch and matches the app version;
   check out the exact commit; install from the lockfile with a frozen install;
   build in a clean ephemeral environment; sign; verify (item 9); emit checksums,
   manifest, SBOM, and provenance (items 8, 17); gate publication on an
   environment approval; then publish the *already verified* bytes.
-- Step 4: Never rebuild between verification and publication. The artifact that
   was hashed and verified must be the file that ships.
-- Step 5: Keep production signing secrets unreachable from pull-request and fork
   builds, and never run PR-controlled scripts in a job holding them.

## 15. Auto-updates

- **Benefits:** Currently there is no updater at all, which is not a security
  hole — it is an absence. Adding one creates a remote code-delivery channel into
  every installed copy, so it is the single most privileged component you could
  add, and it must not be added casually. The benefit is patch delivery; the cost
  is that channel.
- **How?**
-- Step 1: Do item 6 first. Downgrade protection is meaningless while every build
   is version `1.0.0`.
-- Step 2: Use the updater the packager officially supports. Do not invent
   custom cryptography or a bespoke download-and-exec path.
-- Step 3: Accept metadata and artifacts only from one exact allowlisted HTTPS
   origin. Never disable TLS validation. Never fetch an arbitrary URL supplied by
   renderer or server content.
-- Step 4: Require a valid signature with the expected publisher, plus a digest
   match against authenticated metadata, *before* install.
-- Step 5: Enforce monotonic versions, reject downgrades, and separate stable,
   beta, and dev channels.
-- Step 6: Make published versioned objects immutable and scope the publishing
   credential to that one location.
-- Step 7: Note the dead weight until this exists: the build currently collects
   `.exe.blockmap`, which is only useful for differential updates. Either wire up
   the updater or stop shipping it.

## 16. Download page and API

- **Benefits:** Where a user's trust decision actually happens. Publishing the
  publisher name, version, SHA-256, and verification instructions is what lets a
  cautious user confirm they have an official build. Also the place a compromise
  is most visible, so it needs logging.
- **How?**
-- Step 1: Serve releases from a company-controlled HTTPS origin; redirect HTTP;
   add HSTS once every subdomain is ready.
-- Step 2: Restrictive CSP, `X-Content-Type-Options: nosniff`, a sane
   `Referrer-Policy`, `frame-ancestors` to prevent framing.
-- Step 3: Make versioned release objects immutable; log and alert on changes to
   them; never allow uploaded HTML/JS to execute on the release origin.
-- Step 4: Show the publisher name, version, SHA-256, and how to verify.
-- Step 5: Protect DNS, hosting, CDN, and registrar accounts with MFA and least
   privilege.
-- Step 6: For the API: secrets server-side only; server-side authorization on
   every protected action; server-side input validation; Secure/HttpOnly/SameSite
   cookies with CSRF protection where sessions are cookie-based; exact-origin
   CORS; rate limits on auth and sensitive endpoints. The web TLS certificate and
   the code-signing certificate are different credentials and must never share a key.
-- Step 7: Do not trust a request because it came from the Electron app. Clients
   are modifiable and imitable.

## 17. SBOM and build provenance

- **Benefits:** Turns "which vulnerable dependency shipped in 1.4.0?" from an
  investigation into a lookup, and binds an artifact to the commit and workflow
  that produced it. Provenance supplements Authenticode — it identifies the
  build, not the publisher — so it is worth doing only after item 13.
- **How?**
-- Step 1: Generate an SPDX or CycloneDX SBOM per release and archive it with the
   artifacts.
-- Step 2: Scan the SBOM and make vulnerability review part of release approval,
   against a written policy for what severity blocks a release.
-- Step 3: Generate signed provenance through the CI platform's mechanism,
   preferably SLSA-aligned, binding repository, commit, tag, workflow identity,
   build parameters, and artifact digests.
-- Step 4: Pin CI actions to immutable versions or commit SHAs, minimize install
   scripts, and never run `npm audit fix --force` in release CI.

---

# Tier 4 — Not possible, do not attempt

- **Preventing recompilation of accessible source.** Not technically possible.
  The signature is the boundary; that is the whole reason item 13 exists.
- **Protecting any secret shipped inside the app.** ASAR is an archive, not
  encryption, and users can extract it. Move privileged operations and
  secret-bearing actions behind an authenticated backend with server-side
  authorization.
- **Obfuscation as a security control.** Raises effort, proves nothing, and
  complicates debugging a build you cannot reproduce.
- **Signing on an end client's behalf from this tool.** Requires their
  certificate and their verified legal identity. Item 14 hands them the pipeline;
  it cannot hand them an identity.
- **Reproducible builds**, given an Expo export plus a downloaded Electron
  binary. Not worth the effort here.

---

# Working agreements

- An installer being produced is not evidence of anything. Completion means
  verification output, or an explicit statement of which externally provisioned
  controls remain pending.
- Do not weaken a setting to fix an integration problem. Fix the integration.
- Do not add a subsystem — a preload, an updater, a CI directory — merely because
  a checklist mentions it. Absence is frequently the correct state, and this
  document says so where it applies.
- After any code edit here, run `graphify update .`, and update
  `templates/README.md` and `.serena/memories/` when a documented convention
  actually moves.

# References

- Electron security checklist: <https://www.electronjs.org/docs/latest/tutorial/security>
- Electron `protocol.handle`: <https://www.electronjs.org/docs/latest/api/protocol>
- Electron fuses: <https://www.electronjs.org/docs/latest/tutorial/fuses>
- Electron application distribution: <https://www.electronjs.org/docs/latest/tutorial/application-distribution>
- Electron application updates: <https://www.electronjs.org/docs/latest/tutorial/updates>
- electron-builder Windows signing: <https://www.electron.build/code-signing-win>
- Azure Trusted Signing: <https://learn.microsoft.com/azure/trusted-signing/>
- Windows code-signing options: <https://learn.microsoft.com/windows/apps/package-and-deploy/code-signing-options>
- SignTool: <https://learn.microsoft.com/windows/win32/seccrypto/signtool>
- SLSA: <https://slsa.dev/spec/> · SPDX: <https://spdx.dev/> · CycloneDX: <https://cyclonedx.org/>
- OWASP Electron cheat sheet: <https://cheatsheetseries.owasp.org/cheatsheets/Electron_Security_Cheat_Sheet.html>

Where tooling has changed and these snippets are stale, follow the current
official documentation, keep the stated objective, and note the difference.
