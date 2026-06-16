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

// Redirect the Node-only `whatwg-url`/`webidl-conversions` to the RN-safe
// versions Expo already ships and runs on Hermes (whatwg-url-without-unicode +
// webidl-conversions@5).
//
// Why: the admin app's test tooling (vitest + jsdom@28) drags whatwg-url@16 ->
// webidl-conversions@8 into the workspace-root node_modules. Because mobile's
// resolver is flat (disableHierarchicalLookup + nodeModulesPaths above), Metro
// resolves EVERY `require('whatwg-url')` to that hoisted v16 — even though
// mobile's real importers (node-fetch via @solana/web3.js, MetaMask) declare
// whatwg-url@5. v16/webidl-conversions@8 use ES2024 APIs Hermes lacks
// (SharedArrayBuffer, resizable buffers, String.prototype.toWellFormed) and
// crash at bundle evaluation. Pinning to the Hermes-proven pair fixes the
// mis-resolution at its seam instead of polyfilling each missing feature.
const safeUrlRedirects = {
  "whatwg-url": require.resolve("whatwg-url-without-unicode"),
  "webidl-conversions": require.resolve("webidl-conversions", {
    paths: [path.dirname(require.resolve("whatwg-url-without-unicode/package.json"))],
  }),
};
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const redirected = safeUrlRedirects[moduleName];
  if (redirected) {
    return { type: "sourceFile", filePath: redirected };
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
