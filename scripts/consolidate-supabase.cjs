// Run locally as the project administrator, never from a browser or Vercel route.
const fs=require('node:fs'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {buildPlan,applyPlan,publicPlan,quote}=require('./lib/consolidation.cjs');
const stop=message=>Object.assign(Error(message),{migration:true});
function argument(name){const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];}
function required(name){const value=process.env[name];if(!value)throw stop('Set '+name+' locally. Never paste database secrets in chat.');return value;}
function encryptedBackup(payload,password,file){if(password.length<20)throw stop('Use a migration backup passphrase of at least 20 characters.');const salt=crypto.randomBytes(16),iv=crypto.randomBytes(12),key=crypto.scryptSync(password,salt,32),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);const data=Buffer.concat([cipher.update(zlib.gzipSync(Buffer.from(JSON.stringify(payload)))),cipher.final()]);fs.writeFileSync(file,Buffer.concat([Buffer.from('SOUL-MIGRATION-1\n'),salt,iv,cipher.getAuthTag(),data]),{flag:'wx',mode:0o600});}
(async()=>{
 const {Client}=require('pg');
 const sourceUrl=required('MIGRATION_SOURCE_DATABASE_URL'),targetUrl=required('MIGRATION_TARGET_DATABASE_URL');
 // Avoid writing credentials to console, process arguments or repository files.
 const a=new URL(sourceUrl),b=new URL(targetUrl);if(!['postgres:','postgresql:'].includes(a.protocol)||!['postgres:','postgresql:'].includes(b.protocol))throw stop('Use PostgreSQL connection strings.');
 if(a.hostname===b.hostname&&a.port===b.port&&a.pathname===b.pathname&&a.username===b.username)throw stop('Source and target are the same database.');
 const connectionConfig=value=>{const u=new URL(value);for(const name of ['sslmode','sslcert','sslkey','sslrootcert'])u.searchParams.delete(name);return {connectionString:u.toString(),ssl:{rejectUnauthorized:true,...(process.env.MIGRATION_CA_FILE?{ca:fs.readFileSync(process.env.MIGRATION_CA_FILE,'utf8')}:{})},connectionTimeoutMillis:15000,statement_timeout:60000};};
 const source=new Client(connectionConfig(sourceUrl)),target=new Client(connectionConfig(targetUrl));
 const apply=process.argv.includes('--apply'),mappingFile=argument('--mapping');if(!mappingFile)throw stop('Supply --mapping owner-map.json. Both accounts must already exist and have verified emails.');
 const mappings=JSON.parse(fs.readFileSync(mappingFile,'utf8')),keys={source:process.env.MIGRATION_SOURCE_ENCRYPTION_KEY,target:process.env.MIGRATION_TARGET_ENCRYPTION_KEY};
 let sourceOpen=false,targetOpen=false;
 try{
  await source.connect();await target.connect();
  await source.query(apply?'begin isolation level read committed read only':'begin isolation level repeatable read read only');sourceOpen=true;
  if(apply){await source.query("set local lock_timeout='20s'");const tables=(await source.query("select distinct table_name from information_schema.columns where table_schema='public' and (column_name='owner_id' or table_name='profiles') and table_name in (select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE') order by table_name")).rows;await source.query('lock table auth.users in share mode');for(const t of tables)await source.query('lock table public.'+quote(t.table_name)+' in share mode');}
  await target.query(apply?'begin isolation level serializable':'begin isolation level repeatable read read only');targetOpen=true;
  // Lock all destination owner tables before the apply preflight, preventing
  // app writes from invalidating the reviewed conflict and row-count checks.
  if(apply){await target.query("set local lock_timeout='20s'");const tables=(await target.query("select distinct table_name from information_schema.columns where table_schema='public' and (column_name='owner_id' or table_name='profiles') and table_name in (select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE') order by table_name")).rows;for(const t of tables)await target.query('lock table public.'+quote(t.table_name)+' in share row exclusive mode');}
  const plan=await buildPlan(source,target,mappings,keys),safe=publicPlan(plan);
  if(apply){
   const reviewedFile=argument('--reviewed-plan'),backupFile=argument('--backup');if(!reviewedFile||!backupFile)throw stop('--apply requires --reviewed-plan and a NEW encrypted --backup file.');
   const reviewed=JSON.parse(fs.readFileSync(reviewedFile,'utf8'));
   const fingerprint=value=>crypto.createHash('sha256').update(value).digest('hex');
   if(reviewed.source!==fingerprint(a.hostname+a.port+a.pathname+a.username)||reviewed.target!==fingerprint(b.hostname+b.port+b.pathname+b.username)||reviewed.digest!==safe.digest)throw stop('The databases or records changed since the preview. Generate and review a fresh plan.');
   if(plan.conflicts)throw stop('Resolve every conflict before transfer. Nothing was overwritten.');
   if(plan.hasEncryptedData&&!plan.targetKeyVerified&&!process.argv.includes('--confirm-new-target-key'))throw stop('The target has no encrypted credentials to verify its key. Review the target key configuration and explicitly use --confirm-new-target-key only for a genuinely new target.');
   encryptedBackup({createdAt:new Date().toISOString(),plan:safe,snapshot:plan.backup},required('MIGRATION_BACKUP_PASSPHRASE'),backupFile);
   await applyPlan(target,plan,keys);await target.query('commit');targetOpen=false;
   console.log('Transfer committed and inserted records verified. No existing destination record was overwritten.');
   console.log('Imported automatic jobs remain disabled. Verify per-user totals before re-enabling jobs on the main site.');
  }else{
   const out=argument('--plan')||'migration-plan.json',fingerprint=value=>crypto.createHash('sha256').update(value).digest('hex');
   fs.writeFileSync(out,JSON.stringify({...safe,source:fingerprint(a.hostname+a.port+a.pathname+a.username),target:fingerprint(b.hostname+b.port+b.pathname+b.username)},null,2),{flag:'wx',mode:0o600});
   console.log('READ-ONLY preview saved. Tables: '+safe.tables.length+'; pending rows: '+safe.tables.reduce((n,t)=>n+t.insertRows,0)+'; conflicts: '+safe.conflicts+'. Review the plan before applying.');
   console.log('Auth accounts/passwords, global schedulers, OAuth sessions and server environment variables are not copied.');
  }
 }finally{if(targetOpen)await target.query('rollback').catch(()=>{});if(sourceOpen)await source.query('rollback').catch(()=>{});await source.end().catch(()=>{});await target.end().catch(()=>{});}
})().catch(error=>{console.error('Migration stopped. No uncommitted target changes were retained. '+(error.migration?error.message:'Database connection or query failed; provider details are suppressed to protect secrets.'));process.exitCode=1;});
