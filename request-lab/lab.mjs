import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const lab=path.dirname(fileURLToPath(import.meta.url));
const manifestPath=path.join(lab,'resources.json');
if(process.env.DOCKER_HOST && !process.env.DOCKER_HOST.startsWith('unix://'))throw Error('Refuse remote Docker daemon');
const context=spawnSync('docker',['context','inspect','--format','{{.Endpoints.docker.Host}}'],{encoding:'utf8'});
if(context.status!==0||!context.stdout.trim().startsWith('unix://'))throw Error('Require local Unix-socket Docker context');
const docker=(args,options={})=>{
 const r=spawnSync('docker',args,{encoding:'utf8',...options});
 if(options.capturePath)fs.writeFileSync(options.capturePath,r.stdout+'\n'+r.stderr);
 if(r.status!==0)throw Error(`Docker operation failed: ${args[0]}: ${r.stderr}`);
 return r.stdout.trim();
};
const read=()=>JSON.parse(fs.readFileSync(manifestPath,'utf8'));
function guard(m){
 if(!/^exotiq-agent-test-[a-f0-9]{12}-db$/.test(m.container))throw Error('Invalid container name');
 const c=JSON.parse(docker(['inspect',m.container]))[0];
 if(c.Id!==m.containerId || c.Config.Labels['exotiq.agent-test.owner']!==m.owner)throw Error('Ownership mismatch');
 const nets=Object.keys(c.NetworkSettings.Networks);
 if(nets.length!==1||nets[0]!==m.network)throw Error('Unexpected network');
 const n=JSON.parse(docker(['network','inspect',m.network]))[0];
 if(!n.Internal||n.Labels['exotiq.agent-test.owner']!==m.owner)throw Error('Network isolation mismatch');
 const binding=c.NetworkSettings.Ports['5432/tcp']??[];
 if(binding.length!==0)throw Error('Unexpected host port; this internal lab requires docker-exec-only access');
 if(m.port!==null)throw Error('Unexpected manifest port');
 if(c.Mounts.length!==1||c.Mounts[0].Type!=='volume'||c.Mounts[0].Name!==m.volume)throw Error('Unexpected filesystem mount');
 const v=JSON.parse(docker(['volume','inspect',m.volume]))[0];
 if(v.Labels['exotiq.agent-test.owner']!==m.owner)throw Error('Volume ownership mismatch');
 if(c.Image!==m.imageId)throw Error('Image drift');
}
const action=process.argv[2];
if(action==='start'){
 if(fs.existsSync(manifestPath))throw Error('Existing manifest; use status, never replace resources');
 const owner=crypto.randomBytes(6).toString('hex'), prefix=`exotiq-agent-test-${owner}`;
 const image='public.ecr.aws/supabase/postgres:17.6.1.155';
 const imageId=docker(['image','inspect',image,'--format','{{.Id}}']);
 const m={owner,container:prefix+'-db',network:prefix+'-network',volume:prefix+'-data',image,imageId,partialSchema:true,providerParity:false,created:new Date().toISOString()};
 const label=`exotiq.agent-test.owner=${owner}`;
 docker(['network','create','--internal','--label',label,m.network]);
 docker(['volume','create','--label',label,m.volume]);
 const envPath=path.join(lab,'local-container.env');
 fs.writeFileSync(envPath,`POSTGRES_PASSWORD=${crypto.randomBytes(32).toString('hex')}\nPOSTGRES_DB=agent_test\nPOSTGRES_USER=postgres\n`,{mode:0o600});
 // Explicit initdb excludes Supabase image's automatic migration scripts entirely.
 const boot='umask 077; printf "%s" "$POSTGRES_PASSWORD" > /tmp/lab-pw; initdb -D /var/lib/postgresql/data --username=postgres --pwfile=/tmp/lab-pw --auth-host=scram-sha-256 --auth-local=trust >/tmp/initdb.log; rm /tmp/lab-pw; exec postgres -D /var/lib/postgresql/data -c listen_addresses=*';
 m.containerId=docker(['run','--pull','never','-d','--name',m.container,'--label',label,'--network',m.network,'--mount',`type=volume,source=${m.volume},target=/var/lib/postgresql/data`,'--env-file',envPath,'--user','postgres','--entrypoint','sh',m.imageId,'-ec',boot]);
 fs.writeFileSync(manifestPath,JSON.stringify(m,null,2)+'\n');
 let ready=false;
 for(let i=0;i<40;i++){
  const r=spawnSync('docker',['exec',m.container,'pg_isready','-U','postgres','-d','postgres'],{encoding:'utf8'});
  if(r.status===0){ready=true;break;}
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 if(!ready)throw Error('Database failed readiness; resources recorded for diagnosis, no schema applied');
 docker(['exec',m.container,'createdb','-U','postgres','agent_test']);
 const c=JSON.parse(docker(['inspect',m.container]))[0];
 m.port=null; m.access='docker-exec-only; internal network has no reachable host port';
 fs.writeFileSync(manifestPath,JSON.stringify(m,null,2)+'\n');
 guard(m); console.log(JSON.stringify(m,null,2));
}else if(action==='status'){
 const m=read();guard(m);console.log(JSON.stringify(m,null,2));
}else if(action==='recover'){
 const m=read();m.port=null;m.access='docker-exec-only; internal network has no reachable host port';guard(m);
 fs.writeFileSync(manifestPath,JSON.stringify(m,null,2)+'\n');console.log('Recovered owned runtime manifest.');
}else if(action==='sql'){
 const m=read();guard(m);
 const file=fs.realpathSync(process.argv[3]);
 if(!file.startsWith(lab+path.sep)||!file.endsWith('.sql'))throw Error('SQL must be reviewed artifact inside staging-lab');
 const identity=docker(['exec',m.container,'psql','-U','postgres','-d','agent_test','-Atc',"SELECT current_database()"]);
 if(identity!=='agent_test')throw Error('Wrong database');
 console.log(docker(['exec','-i',m.container,'psql','-v','ON_ERROR_STOP=1','--single-transaction','-U','postgres','-d','agent_test'],{input:fs.readFileSync(file,'utf8'),capturePath:path.join(lab,path.basename(file,'.sql')+'-evidence.txt')}));
}else if(action==='stop'){
 const m=read();guard(m);docker(['stop',m.container]);console.log('Stopped owned container. Persistent volume retained.');
}else throw Error('Usage: node lab.mjs start|status|sql reviewed-local-file.sql|stop');
