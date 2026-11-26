import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// No data-fetching cache library in the storefront bundle: pages load their own
// release-gated data, so react-query only added ~24 KB of unused JavaScript.
export const getRouter = () =>
  createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });
