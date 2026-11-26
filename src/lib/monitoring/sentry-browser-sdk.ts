// Named imports only, so the bundler tree-shakes the SDK down to what we use.
// Loaded with import() after page load — never part of the initial bundle.
export {init,captureException,setTag} from "@sentry/browser";
