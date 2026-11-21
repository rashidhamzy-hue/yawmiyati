import {QueryClient} from "@tanstack/react-query";
import {createRouter,rootRouteId} from "@tanstack/react-router";
import {it,expect} from "vitest";
import {routeTree} from "@/routeTree.gen";
it("registers preview and details for all five market codes",()=>{
 const router=createRouter({routeTree,context:{queryClient:new QueryClient()}});
 for(const market of ["sa","ae","om","eg","iq"]){
  expect(router.matchRoutes("/"+market).at(-1)?.routeId).not.toBe(rootRouteId);
  expect(router.matchRoutes("/"+market+"/p/demo").at(-1)?.routeId).not.toBe(rootRouteId);
  expect(router.matchRoutes("/"+market+"/search").at(-1)?.routeId).not.toBe(rootRouteId);
  expect(router.matchRoutes("/"+market+"/c/home").at(-1)?.routeId).not.toBe(rootRouteId);
  expect(router.matchRoutes("/"+market+"/info/help").at(-1)?.routeId).not.toBe(rootRouteId);
  // Every market must be safely routable even while real checkout is disabled.
  for(const suffix of ["/cart","/checkout","/order/test-receipt"]){
   const route=router.matchRoutes("/"+market+suffix).at(-1)?.routeId;
   expect(route).not.toBe(rootRouteId);
   expect(route).toContain("/"+market+"/");
  }
 }
});
