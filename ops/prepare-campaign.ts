import { writeFile } from 'node:fs/promises';
import { campaignTerms,privacyNotice } from '../src/features/legal/policy';
const quote=(value:string)=>`'${value.replaceAll("'","''")}'`;
const sql=`-- Operator approved the terms and support inbox in this task on 2026-09-12.\n-- Publish immutable terms; enrollment stays paused until SMTP and deployment are verified.\nbegin;\ninsert into public.campaign_versions(id,welcome_minor,referral_minor,referral_cap,founder_cap,terms_body,privacy_body,eligibility_region,minimum_age,starts_at,published_at)\nvalues('founding-v1',10000,5000,3,100,${quote(campaignTerms)},${quote(privacyNotice)},'worldwide',18,now(),now());\nupdate public.campaign_state set active_version='founding-v1',paused=true where id='founding';\ncommit;\nselect active_version,paused,allocated_founders from public.campaign_state;\n`;
await writeFile('ops/publish-approved-campaign.sql',sql);console.log('Prepared the approved, immutable campaign version.');
