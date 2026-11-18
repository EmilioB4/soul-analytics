// Administrator-only offline migration. No application route imports this module.
const crypto=require('node:crypto');
const excluded=new Set(['profiles','payout_platform_owners','ebay_oauth_states']);
const pauseTables=new Set(['order_auto_syncs','payout_alert_settings','walmart_sale_alert_settings','walmart_daily_webhooks']);
const deliveryTables=new Set(['payout_alert_events','walmart_sale_alert_events','walmart_daily_summary_events']);
const ignored=new Set(['id','updated_at','synced_at','last_attempt_at','last_success_at','last_error','locked_until','lock_token','refresh_lock','refresh_locked_until','sync_lock','sync_locked_until']);
const stop=message=>Object.assign(Error(message),{migration:true});
const quote=name=>'"'+name.replaceAll('"','""')+'"';
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function canonical(value){if(value instanceof Date)return value.toISOString();if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));return value;}
function keyBuffer(value){if(!/^[a-fA-F0-9]{64}$/.test(value||''))throw stop('Both migration encryption keys must be 64 hex characters when encrypted fields exist.');return Buffer.from(value,'hex');}
function decrypt(value,key){const bytes=Buffer.from(value,'base64');if(bytes.length<29)throw stop('Stored encrypted field is invalid.');const decipher=crypto.createDecipheriv('aes-256-gcm',keyBuffer(key),bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(12,28));return Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8');}
function encrypt(value,key){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',keyBuffer(key),iv);return Buffer.concat([iv,...(()=>{const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return [cipher.getAuthTag(),encrypted];})()]).toString('base64');}
function transformRow(row,ownerMap,sourceKey,targetKey,generated=[],tableName=''){
 const out={...row,owner_id:ownerMap.get(row.owner_id)};if(!out.owner_id)throw stop('An owner is missing from the reviewed mapping.');
 for(const column of generated)delete out[column];
 if(pauseTables.has(tableName)&&Object.hasOwn(out,'enabled'))out.enabled=false;
 if(deliveryTables.has(tableName)&&out.state==='sending')out.state='uncertain';
 for(const [key,value] of Object.entries(out)){
  if(key.endsWith('_encrypted')&&value!=null)out[key]=encrypt(decrypt(value,sourceKey),targetKey);
  if(['lock_token','locked_until','refresh_lock','refresh_locked_until','sync_lock','sync_locked_until'].includes(key))out[key]=null;
 }
 return out;
}
function comparable(row,key,generated=[],columns=null){const result={};for(const [name,value] of Object.entries(row)){if(generated.includes(name)||ignored.has(name)||(columns&&!columns.includes(name)))continue;result[name]=name.endsWith('_encrypted')&&value!=null?hash(decrypt(value,key)):canonical(value);}return canonical(result);}
async function describe(client){
 const columns=(await client.query("select table_name,column_name,data_type,udt_name,is_identity,is_generated from information_schema.columns where table_schema='public' and table_name in (select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE') order by table_name,ordinal_position")).rows;
 const pks=(await client.query("select tc.table_name,k.column_name,k.ordinal_position from information_schema.table_constraints tc join information_schema.key_column_usage k on tc.constraint_name=k.constraint_name and tc.table_schema=k.table_schema and tc.table_name=k.table_name where tc.table_schema='public' and tc.constraint_type='PRIMARY KEY' order by tc.table_name,k.ordinal_position")).rows;
 const fks=(await client.query("select tc.table_name,ccu.table_name as parent_table from information_schema.table_constraints tc join information_schema.constraint_column_usage ccu on ccu.constraint_name=tc.constraint_name and ccu.constraint_schema=tc.constraint_schema where tc.table_schema='public' and ccu.table_schema='public' and tc.constraint_type='FOREIGN KEY'")).rows;
 const tables=new Map();for(const c of columns){if(!tables.has(c.table_name))tables.set(c.table_name,{name:c.table_name,columns:[],pk:[],generated:[]});const t=tables.get(c.table_name);t.columns.push(c);if(c.is_identity==='YES'||c.is_generated!=='NEVER')t.generated.push(c.column_name);}
 for(const p of pks)tables.get(p.table_name)?.pk.push(p.column_name);
 return {tables,fks};
}
function sortedTables(names,fks){const remaining=new Set(names),ordered=[];while(remaining.size){const ready=[...remaining].filter(name=>!fks.some(f=>f.table_name===name&&f.parent_table!==name&&remaining.has(f.parent_table))).sort();if(!ready.length)throw stop('Public foreign-key cycle requires a reviewed custom migration.');for(const name of ready){ordered.push(name);remaining.delete(name);}}return ordered;}
async function verifyMappings(source,target,mappings){
 if(!Array.isArray(mappings)||!mappings.length)throw stop('Supply a reviewed nonempty owner mapping.');
 const seen=new Set();for(const map of mappings){if(!/^[a-f0-9-]{36}$/i.test(map.sourceId||'')||!/^[a-f0-9-]{36}$/i.test(map.targetId||'')||seen.has(map.sourceId))throw stop('Invalid or duplicate source owner mapping.');seen.add(map.sourceId);
  const a=(await source.query('select email,email_confirmed_at from auth.users where id=$1',[map.sourceId])).rows[0],b=(await target.query('select email,email_confirmed_at from auth.users where id=$1',[map.targetId])).rows[0];
  if(!a?.email_confirmed_at||!b?.email_confirmed_at)throw stop('Every mapped source and target account must already exist with a verified email.');
  if(a.email.toLowerCase()!==b.email.toLowerCase()&&map.confirmDifferentEmails!==true)throw stop('Different email addresses require explicit confirmDifferentEmails in that mapping.');
 }
 const admitted=(await source.query('select user_id from public.profiles')).rows;
 if(admitted.some(row=>!seen.has(row.user_id)))throw stop('Mapping must cover every admitted source user; no source account may silently be skipped.');
 return new Map(mappings.map(m=>[m.sourceId,m.targetId]));
}
async function buildPlan(source,target,mappings,keys={}){
 const ownerMap=await verifyMappings(source,target,mappings),a=await describe(source),b=await describe(target),sourceIds=[...ownerMap.keys()],targetIds=[...new Set(ownerMap.values())];
 if(a.tables.get('profiles')?.columns.some(c=>!['user_id','created_at'].includes(c.column_name)))throw stop('Profile metadata requires a reviewed custom migration.');
 const names=[...a.tables].filter(([name,t])=>!excluded.has(name)&&t.columns.some(c=>c.column_name==='owner_id')).map(([name])=>name);
 const plan={version:1,mappings:mappings.map(m=>({sourceId:m.sourceId,targetId:m.targetId})),tables:[],conflicts:0,hasEncryptedData:false,targetKeyVerified:false,ignoredTables:[...a.tables.keys()].filter(n=>!names.includes(n)),backup:{tables:{}}};
 for(const name of sortedTables(names,a.fks)){
  const schema=a.tables.get(name),dest=b.tables.get(name);if(!dest)throw stop('Target schema is missing '+name+'. Install its reviewed setup SQL first.');
  for(const column of schema.columns){const other=dest.columns.find(c=>c.column_name===column.column_name);if(!other||column.data_type!==other.data_type||column.udt_name!==other.udt_name)throw stop('Incompatible target column: '+name+'.'+column.column_name);}
  if(!schema.pk.length)throw stop('A table has no primary key: '+name);
  const owners=(await source.query('select distinct owner_id from public.'+quote(name)+' where owner_id is not null')).rows;
  if(owners.some(row=>!ownerMap.has(row.owner_id)))throw stop('Unmapped source records in '+name+'. Expand the reviewed owner mapping.');
  const rows=(await source.query('select * from public.'+quote(name)+' where owner_id=any($1::uuid[]) limit 100001',[sourceIds])).rows;
  const existing=(await target.query('select * from public.'+quote(name)+' where owner_id=any($1::uuid[]) limit 100001',[targetIds])).rows;
  if(rows.length>100000||existing.length>100000)throw stop('A table exceeds the reviewed migration size limit: '+name);
  plan.backup.tables[name]=rows;
  if(rows.some(row=>Object.entries(row).some(([key,value])=>key.endsWith('_encrypted')&&value!=null)))plan.hasEncryptedData=true;
  const columns=schema.columns.map(c=>c.column_name),generated=dest.generated,pk=schema.pk.filter(k=>!generated.includes(k));
  // Auto-generated audit IDs may collide across projects; preserve their content,
  // let the destination allocate IDs, and deduplicate by the remaining fields.
  const autoIdentity=schema.pk.every(k=>generated.includes(k));
  if(autoIdentity&&a.fks.some(f=>f.parent_table===name&&names.includes(f.table_name)))throw stop('Generated IDs referenced by another migrated table require explicit ID remapping: '+name);
  const identity=row=>autoIdentity?hash(comparable(row,keys.target,generated,columns)):JSON.stringify(pk.map(k=>canonical(row[k])));
  const known=new Map(existing.map(row=>[identity(row),row])),pending=[],expected=[],conflicts=[];
  for(const row of rows){const transformed=transformRow(row,ownerMap,keys.source,keys.target,generated,name),key=identity(transformed),previous=known.get(key);expected.push(transformed);
   if(previous){if(hash(comparable(previous,keys.target,generated,columns))!==hash(comparable(transformed,keys.target,generated,columns)))conflicts.push(hash(key));}
   else{known.set(key,transformed);pending.push(transformed);}
  }
  const encrypted=schema.columns.some(c=>c.column_name.endsWith('_encrypted'));
  const report={name,sourceRows:rows.length,targetRows:existing.length,insertRows:pending.length,conflictRows:conflicts.length,generated,columns,pk,autoIdentity,encrypted,pending,expected};
  plan.tables.push(report);plan.conflicts+=conflicts.length;
 }
 if(plan.hasEncryptedData){
  for(const table of b.tables.values()){if(!table.columns.some(c=>c.column_name==='owner_id'))continue;for(const c of table.columns.filter(c=>c.column_name.endsWith('_encrypted'))){const sample=(await target.query('select '+quote(c.column_name)+' as value from public.'+quote(table.name)+' where '+quote(c.column_name)+' is not null limit 1')).rows[0];if(sample){try{decrypt(sample.value,keys.target);plan.targetKeyVerified=true;}catch{throw stop('Target encryption key does not decrypt existing saved credentials. Do not rotate or guess it.');}}}}
 }
 plan.digest=hash({targetKey:plan.hasEncryptedData?hash(keys.target):null,mappings:plan.mappings,tables:plan.tables.map(t=>({name:t.name,source:t.sourceRows,target:t.targetRows,conflicts:t.conflictRows,pending:t.pending.map(r=>comparable(r,keys.target,t.generated,t.columns))}))});
 return plan;
}
async function applyPlan(target,plan,keys={}){
 if(plan.conflicts)throw stop('Conflicting records must be reviewed; no overwrite is permitted.');
 for(const mapping of plan.mappings)await target.query('insert into public.profiles(user_id) values($1) on conflict(user_id) do nothing',[mapping.targetId]);
 for(const table of plan.tables){
  for(const original of table.pending){const row={...original};const columns=Object.keys(row);await target.query('insert into public.'+quote(table.name)+' ('+columns.map(quote).join(',')+') values ('+columns.map((_,i)=>'$'+(i+1)).join(',')+')',columns.map(c=>row[c]));}
 }
 // Every input row must now be represented by the same primary key/content.
 for(const table of plan.tables){const ids=[...new Set(plan.mappings.map(m=>m.targetId))],rows=(await target.query('select * from public.'+quote(table.name)+' where owner_id=any($1::uuid[])',[ids])).rows;
  const identity=row=>table.autoIdentity?hash(comparable(row,keys.target,table.generated,table.columns)):JSON.stringify(table.pk.map(k=>canonical(row[k])));
  const index=new Map(rows.map(r=>[identity(r),r]));
  for(const pending of table.expected){const desired={...pending};const saved=index.get(identity(desired));if(!saved||hash(comparable(saved,keys.target,table.generated,table.columns))!==hash(comparable(desired,keys.target,table.generated,table.columns)))throw stop('Verification failed for '+table.name+'. Roll back the transfer.');}
 }
}
function publicPlan(plan){return {version:plan.version,digest:plan.digest,mappings:plan.mappings,conflicts:plan.conflicts,hasEncryptedData:plan.hasEncryptedData,targetKeyVerified:plan.targetKeyVerified,ignoredTables:plan.ignoredTables,tables:plan.tables.map(({pending,expected,...rest})=>rest)};}
module.exports={buildPlan,applyPlan,publicPlan,transformRow,canonical,encrypt,decrypt,quote};
