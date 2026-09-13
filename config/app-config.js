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
