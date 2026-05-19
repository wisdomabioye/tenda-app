// Order matters. `react-native-get-random-values` installs the global
// `crypto.getRandomValues` shim that web3 libs (including
// `@metamask/connect-multichain`) read on first import. `./shims/polyfills`
// then layers in Buffer/window globals. Both must run before any code that
// could transitively touch crypto/Buffer/window — which `expo-router/entry`
// does as soon as it loads route modules.
import 'react-native-get-random-values'
import './shims/polyfills'
import 'expo-router/entry'
import './theme'
