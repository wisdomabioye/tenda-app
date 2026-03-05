const Sentry = require("@sentry/node");
// Ensure to call this before requiring any other modules!
Sentry.init({
  dsn: "https://c0f414d35ac9c437ad28a841df2b0a53@o4509884634300416.ingest.de.sentry.io/4510994023907408",
  // Adds request headers and IP for users, for more info visit:
  // https://docs.sentry.io/platforms/javascript/guides/node/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
});