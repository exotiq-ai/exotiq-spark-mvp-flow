import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRuntimeConfig } from './runtime.ts';
import { createMcpApplication } from './server.ts';
import { createNodeServer } from './node-http.ts';

export function start(env:Record<string,string|undefined>=process.env) {
  const config=readRuntimeConfig(env);
  const server=createNodeServer(createMcpApplication(config.application),config.application.auth.resource);
  server.listen(config.port,'127.0.0.1');
  return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const server=start();
    server.on('error',()=>{process.stderr.write('MCP listener unavailable.\n');process.exitCode=1;});
    for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>server.close());
  } catch {process.stderr.write('MCP configuration unavailable.\n');process.exitCode=1;}
}
