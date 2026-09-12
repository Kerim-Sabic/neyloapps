import type { Metrics } from '@/lib/domain';
export function csvCell(value:string|number|boolean){const text=String(value);return `"${(/^[=+\-@\t\r\n]/.test(text)?"'"+text:text).replaceAll('"','""')}"`;}
export function metricsCsv(metrics:Metrics){
  const rows:Array<Array<string|number|boolean>>=[['metric','value','from_utc','to_utc','cohort','as_of_utc']];
  for(const [key,value] of Object.entries(metrics)){if(typeof value==='number'||typeof value==='boolean')rows.push([key,value,metrics.from,metrics.to,metrics.cohort,metrics.asOf]);}
  for(const source of metrics.sources)rows.push([`source:${source.source}`,source.accounts,metrics.from,metrics.to,metrics.cohort,metrics.asOf]);
  for(const cohort of metrics.cohorts)rows.push([`classification:${cohort.cohort}`,cohort.accounts,metrics.from,metrics.to,'all (classification context)',metrics.asOf]);
  return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
