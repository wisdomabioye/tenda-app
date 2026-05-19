const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getSentryExpoConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

// Node-builtin shims for @metamask/connect-multichain. The library was built
// browser-first; on RN we map most Node built-ins to an empty stub (the code
// paths aren't actually reached) and `stream` to its userland reimplementation.
// If a real runtime call ever hits one of these stubs we'll see a clear error
// and can swap in the proper shim then.
const emptyModule = path.resolve(projectRoot, "shims/empty-module.js");
const nodeBuiltins = {
  assert: emptyModule,
  crypto: emptyModule,
  dns: emptyModule,
  fs: emptyModule,
  http: emptyModule,
  https: emptyModule,
  net: emptyModule,
  os: emptyModule,
  path: emptyModule,
  stream: require.resolve("readable-stream"),
  tls: emptyModule,
  url: emptyModule,
  zlib: emptyModule,
};

config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-dom": path.resolve(projectRoot, "node_modules/react-dom"),
  "react-native": path.resolve(projectRoot, "node_modules/react-native"),
  ...nodeBuiltins,
};

module.exports = config;
