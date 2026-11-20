/** Public browser configuration for the dedicated Yawmiyati STAGING project.
 * A publishable key is not a secret. Auth and RLS enforce all private access.
 * Do not replace with a service-role JWT, Anthropic key or supplier credentials.
 * Production deployments must provide their own VITE_ values.
 */
export const stagingPublicConfig={
 origin:"https://skhtunkknshvolturqlm.supabase.co",
 publishableKey:"sb_publishable_pY8OCg8z2wqr612lDrCbDA_b8WhnBMq",
} as const;
export function publicBrowserConfig(envOrigin?:string,envKey?:string){
 return {origin:envOrigin?.trim()||stagingPublicConfig.origin,key:envKey?.trim()||stagingPublicConfig.publishableKey};
}
