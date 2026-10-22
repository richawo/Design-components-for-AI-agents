export function gitBlobSha(bytes:Buffer):string;
export function snapshotPath(root:string,relative:string):string;
export function writeConnectedBlob(root:string,entry:{mode:string;type:string;path:string;sha:string},blob:{encoding:string;content:string;sha?:string;size?:number}):number;
export function verifyConnectedSnapshot(root:string):{repository:string;commit:string;complete:boolean;files:Array<{path:string;sha:string}>};
