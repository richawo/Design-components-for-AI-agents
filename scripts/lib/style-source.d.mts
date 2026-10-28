export type StyleSourcePin = {repository:string;commit:string;files:{path:string;sha256:string}[]};
export function styleSourcePin(root:string):StyleSourcePin|null;
export function materializeStyleSource(root:string,privateRoot:string,pin:StyleSourcePin):string;
export function loadStylePack(root:string):Record<string,unknown>|null;
export function styleSourceIdentity(root:string):{commit:string;pinSha256:string;available:boolean}|null;
