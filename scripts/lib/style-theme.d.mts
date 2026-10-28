export function selectStyleTheme<T extends {code:string;prompt:string;promptJson:string;styleCss:string}>(source:T,theme:"light"|"dark"):T;
