// Generate one copy/paste installer from the maintained component migrations.
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const sources=['walmart_core.sql','walmart_settlements.sql','walmart_inventory.sql','walmart_wfs_inventory.sql','walmart_return_recoveries.sql','multiuser_foundation.sql'];
const header='-- WALMART TEST PROJECT SETUP\n-- Run the entire file in the testing Supabase project SQL Editor as postgres.\n-- Preserves existing accounts and data; safe to rerun. No secrets or sample store data.\n-- Creates Walmart tables and per-user connection/access rules.\n-- Background schedulers and Discord alerts are configured separately, after a successful manual import.\n\nbegin;\n';
const content=header+sources.map(name=>'\n-- SOURCE: '+name+'\n'+fs.readFileSync(path.join(root,'supabase',name),'utf8').replace(/^begin;\s*$/gm,'').replace(/^commit;\s*$/gm,'')).join('\n')+'\ncommit;\n';
const target=path.join(root,'supabase/walmart_test_setup.sql');
if(process.argv.includes('--check')){if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==content)throw Error('Regenerate with node scripts/build-walmart-setup.cjs');console.log('Walmart installer matches source migrations.');}else fs.writeFileSync(target,content);
