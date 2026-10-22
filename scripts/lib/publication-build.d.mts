export const BUILD_CHECKS:string[];
export function publicationBuildIdentity(root:string):{publicCommit:string;privateCommit:string;sourceInputsSha256:string;rulebookSha256:string;requestSha256:string|null};
export function validatePublicationBuildReceipt(receipt:any,identity:any):any;
export function assertPublicationBuildReceipt(root:string):any;
