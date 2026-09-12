import { readdir,readFile,writeFile } from 'node:fs/promises';
const files=(await readdir('supabase/migrations')).filter(name=>/^\d+_[a-z_]+\.sql$/.test(name)).sort();
let bundle="-- Intended project: tfphopejudgbfrucdxsy (neylo). Fresh schema only.\nbegin;\ncreate schema if not exists supabase_migrations;\ncreate table if not exists supabase_migrations.schema_migrations(version text primary key,statements text[],name text);\n";
for(const file of files){const version=file.split('_')[0];const name=file.replace(/^\d+_/,'').replace(/\.sql$/,'');const source=await readFile(`supabase/migrations/${file}`,'utf8');bundle+=`\n-- ${file}\n${source}\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array['${source.replaceAll("'","''")}']);\n`;}
bundle+="\ncommit;\nselect count(*) as protected_tables from pg_tables where schemaname='public' and rowsecurity;\n";
await writeFile('ops/production-migration.sql',bundle);console.log(`Bundled ${files.length} migrations in one transaction.`);
