# Release Guide

## Before Publishing

Run the local checks:

```powershell
npm run check
```

Confirm the working tree only contains intentional changes:

```powershell
git status --short
```

## Push To GitHub

Create an empty GitHub repository, then add it as `origin`:

```powershell
git remote add origin https://github.com/<owner>/<repo>.git
git push -u origin master
git push origin v0.92.85
```

If the tag was moved locally before publishing, force-push the tag intentionally:

```powershell
git push --force origin v0.92.85
```

## Create A GitHub Release

If GitHub CLI is available and logged in:

```powershell
gh release create v0.92.85 --title "v0.92.85" --notes-file RELEASE_NOTES.md
```

Without GitHub CLI:

1. Open the repository on GitHub.
2. Go to `Releases`.
3. Choose `Draft a new release`.
4. Select tag `v0.92.85`.
5. Use `v0.92.85` as the title.
6. Paste the contents of `RELEASE_NOTES.md`.
7. Publish the release.
