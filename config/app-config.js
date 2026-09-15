// Runtime configuration for the standalone build served from this repository's
// own GitHub Pages site. Consumers of the release archive (Wildflower's
// apps/ohif-viewer) overwrite this file with their own: OHIF reads it at page
// load, so configuration never needs a rebuild.
;(function () {
  // This script is loaded as `./app-config.js` next to index.html, so its own
  // URL says where the viewer is served from. Deriving the router basename
  // from it keeps the bundle path-agnostic (Pages serves it under the
  // repository name; a local `npx serve` serves it at the root).
  var script = document.currentScript
  var basename = '/'
  if (script && script.src) {
    var pathname = new URL(script.src).pathname
    basename = pathname.slice(0, pathname.lastIndexOf('/') + 1)
  }

  // SPA redirect: if we arrived via a 404.html redirect (this repo's own or
  // a parent project's), restore the original route so the router picks it up.
  var params = new URLSearchParams(window.location.search)
  var redirectPath = params.get('redirect')
  if (redirectPath) {
    params.delete('redirect')
    // Strip the basename prefix when the redirect value is an absolute path
    // that includes it (a parent project's 404.html may pass the full path).
    if (redirectPath.indexOf(basename) === 0) {
      redirectPath = redirectPath.slice(basename.length)
    }
    // Ensure a single leading slash for the route portion.
    redirectPath = redirectPath.replace(/^\/+/, '/')
    var remaining = params.toString()
    var target = basename + redirectPath.replace(/^\//, '')
    window.history.replaceState(
      null,
      '',
      target + (remaining ? '?' + remaining : '') + window.location.hash
    )
  }

  window.config = {
    name: 'ohif-viewer-dist/app-config.js',
    routerBasename: basename,
    extensions: [],
    modes: [],
    customizationService: {},
    // The worklist at the basename is the SMART launch entry point: launch it
    // as `<basename>?iss=<fhir base>&launch=<id>`. The OAuth redirect returns
    // to the same path, the only route GitHub Pages serves natively.
    showStudyList: true,
    maxNumberOfWebWorkers: 3,
    showWarningMessageForCrossOrigin: true,
    showCPUFallbackMessage: true,
    showLoadingIndicator: true,
    strictZSpacingForVolumeViewport: true,
    showErrorDetails: 'always',
    investigationalUseDialog: { option: 'never' },
    defaultDataSourceName: 'fhir',
    dataSources: [
      {
        namespace: '@ohif/fhir-viewer.dataSourcesModule.fhir',
        sourceName: 'fhir',
        configuration: {
          friendlyName: 'FHIR R4 server (SMART on FHIR)',
          // No server and no client ID baked in: `?iss=` names the server,
          // `?client_id=` or the SMART Preferences panel supplies the client.
          smartClientId: '',
        },
      },
    ],
  }
})()
