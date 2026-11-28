/** Opens the Yawmiyati assistant from anywhere on the page, optionally with a first question. */
export const ASSISTANT_EVENT="yawmiyati:assistant";
export function openAssistant(question?:string){
 if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent(ASSISTANT_EVENT,{detail:{question:question??""}}));
}
