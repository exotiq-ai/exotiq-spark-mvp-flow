/** Compile-time declaration for existing edge helpers; no runtime polyfill. */
declare namespace Deno {const env:{get(name:string):string|undefined};}
