export function publicationInputsFromGitTree(tree:{truncated?:boolean;tree:Array<{path:string;type:string;mode:string;sha:string}>}):{sha256:string;files:string[][]};
export function publicationInputs(root: string): {sha256:string;files:string[][]};
export function londonDay(iso: string): string;
export function assertPublicationDay(request: {requestedAt:string;mode:string;articleSlugs:string[]},posts: Array<{data:{draft?:boolean;date:string|Date}}>): {day:string;newArticlesOnDay:number};
export function verifyPublicationRequest(root: string,posts: unknown[],providedRequest?:unknown): null|{requestId:string;sourceInputsSha256:string;privateContentCommit:string;day:string;newArticlesOnDay:number;articleSlugs:string[]};
