import { beforeAll, vi } from 'vitest';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';

beforeAll(() => {
  const deny = () => { throw new Error('Offline agent tests must not contact network services'); };
  vi.stubGlobal('fetch', deny);
  vi.spyOn(http, 'request').mockImplementation(deny);
  vi.spyOn(http, 'get').mockImplementation(deny);
  vi.spyOn(https, 'request').mockImplementation(deny);
  vi.spyOn(https, 'get').mockImplementation(deny);
  vi.spyOn(net, 'connect').mockImplementation(deny);
  vi.spyOn(net, 'createConnection').mockImplementation(deny);
  vi.spyOn(tls, 'connect').mockImplementation(deny);
});
