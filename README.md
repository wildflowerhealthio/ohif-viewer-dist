# ohif-viewer-dist

A build of the [OHIF Viewer](https://ohif.org) with the
[FHIR Viewer mode](https://ohif.org/modes/fhir-viewer) linked in, set up for
SMART on FHIR launches. This repository does the slow part once: it pins the
upstream commits, builds OHIF from source, and publishes the result twice.

- **As a GitHub Release.** Each build on `main` becomes a release tagged
  `v<date>-<viewers commit>-<extension commit>` carrying `ohif-viewer.tar.gz`
  (the built viewer, contents at the archive root) and
  `ohif-viewer.tar.gz.sha256`. Consumers pin a release by URL and digest.
  [`wildflowerhealthio/wildflower`](https://github.com/wildflowerhealthio/wildflower)
  does this in `apps/ohif-viewer/prebuilt.json` and publishes the viewer at
  <https://wildflowerhealth.io/ohif-viewer>.
- **As this repository's GitHub Pages site.** The same build, with the
  standalone `config/app-config.js`, for trying the viewer on its own.

## What is built

`upstream.json` pins two source trees by commit:

| Key          | Repository                                                                     | Role                                                |
| ------------ | ------------------------------------------------------------------------------ | --------------------------------------------------- |
| `viewers`    | [OHIF/Viewers](https://github.com/OHIF/Viewers)                                | The viewer itself                                   |
| `fhirViewer` | [node-on-fhir/ohif-fhir-viewer](https://github.com/node-on-fhir/ohif-fhir-viewer) | The `@ohif/fhir-viewer` extension and its `mode/` |

`scripts/build.mjs` follows the extension's quick start with two deliberate
differences. The extension and its bundled `fhir-viewer` mode are registered
by writing `directory` entries into OHIF's `platform/app/pluginConfig.json`,
the out-of-tree plugin mechanism OHIF's build supports, rather than by the
yarn-based `cli link-*` commands. And the production build runs with
`PUBLIC_URL=./`, so one bundle serves from any path; `app-config.js` derives
the router basename from its own script URL.

Steps, in order:

1. Shallow-fetch both pinned commits into `upstream/` (gitignored).
2. `pnpm install --frozen-lockfile` in the OHIF workspace, then in the extension
   with `--config.auto-install-peers=false` (its peers, such as `@ohif/core`,
   must resolve from the OHIF build, not its own `node_modules`).
3. Register the extension and mode in `pluginConfig.json`.
4. Copy `config/app-config.js` in as the build's `APP_CONFIG` and run OHIF's
   production build.
5. Drop the source maps (about 100 MB of the build), then write
   `out/ohif-viewer.tar.gz`, its `.sha256`, and `out/site/`.

## Running it locally

Node 24+ and `git` on `PATH`; pnpm is fetched by `npx` at the version
`upstream.json` names.

```bash
node scripts/build.mjs   # ~10 minutes the first time
npm run serve            # serves out/site at http://localhost:3000
```

## SMART launch

The worklist at the site's basename is the launch entry point. Launch it as

```text
<basename>?iss=<FHIR base URL>&launch=<launch id>
```

The FHIR data source discovers the server's SMART configuration, redirects to
authorize, and the server returns to the same path with the code. GitHub
Pages serves real files only, so a fresh load of a mode URL such as
`<basename>fhir-viewer?…` is a 404: launch at the worklist. The SMART client
ID comes from `?client_id=` on the launch URL or the viewer's SMART
Preferences panel; a deployment that has settled on one sets `smartClientId`
in its own `app-config.js`.

## Updating

1. Edit the commits in `upstream.json`.
2. Open a PR: the workflow builds it and uploads the result as a workflow
   artifact for inspection.
3. Merge: the `main` run publishes the release and redeploys the Pages site.
4. Point consumers at the new release URL and digest.
