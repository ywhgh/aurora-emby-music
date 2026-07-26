# Release Guide

Releases are automated. `npm run release` tags and pushes; the
`.github/workflows/release.yml` workflow re-runs the checks on a clean
checkout and publishes the GitHub Release from `RELEASE_NOTES.md`.

## 1. Bump The Version

The version string is duplicated in several places so the service worker,
app shell and cache-busting query params stay in step. All of them must
match, and the workflow refuses to publish a tag that disagrees with
`package.json`.

| File | What carries the version |
| --- | --- |
| `package.json` | `version` |
| `manifest.webmanifest` | `version` |
| `src/config.js` | `APP_VERSION` |
| `src/login-fallback.js` | `const version` |
| `sw.js` | `CACHE_NAME`, `ASSET_VERSION` |
| `index.html` | login page labels and every `?v=` query param |
| `main.js` | the `./app.js?v=` dynamic import |

Check nothing was missed:

```bash
grep -rn "<old-version>" --include="*.js" --include="*.json" \
  --include="*.html" --include="*.webmanifest" . | grep -v node_modules
```

Only `RELEASE_NOTES.md` should still mention older versions.

## 2. Write The Release Notes

Add a `## <version>` section at the top of `RELEASE_NOTES.md`. This is
required: both `scripts/release.js` and the workflow abort when the
section is missing, and its body becomes the GitHub Release description.

Preview exactly what will be published:

```bash
npm run release:notes
```

`RELEASE_NOTES.md` is the single place changes are listed — do not repeat
them in `README.md` or a changelog.

## 3. Verify Locally

```bash
npm run check
git status --short
```

`npm run check` runs the smoke, lyrics, bridge and browser-smoke suites
plus `node --check` over every script. The browser smoke test needs
Chrome; set `CHROME_PATH` if it is not in a default location.

For mobile UI work, screenshot the logged-in app against the mock server
before releasing:

```bash
npm run mock:emby &          # Emby stand-in on :8096
python -m http.server 5173 & # or `npm run serve`
npm run ui:capture           # PNGs land in ./.ui-capture (git-ignored)
```

## 4. Release

Commit everything first — `scripts/release.js` refuses to run against a
dirty working tree.

```bash
npm run release -- --dry-run   # prints the tag, branch and notes preview
npm run release
```

`npm run release` tags `v<version>`, pushes the current branch to
`origin`, then pushes the tag. Pushing a `v*` tag triggers the Release
workflow, which verifies the tag matches `package.json`, runs
`npm run check` again, extracts the notes and publishes the release.

Watch it finish:

```bash
gh run watch
gh release view v<version>
```

## Recovering From A Bad Tag

A published release is outward-facing; prefer shipping a follow-up patch
version. If a tag has to be withdrawn before the workflow published it:

```bash
git push --delete origin v<version>
git tag -d v<version>
```

If the release was already published, delete it in the GitHub UI or with
`gh release delete v<version>` before deleting the tag.
