import { CHAPTERS,SOURCES } from './content';
export function pitchScript(){return ['NEYLO — ONE ADDRESS FOR MONEY','Three-minute core pitch / presenter notes','',
  ...CHAPTERS.flatMap((chapter,i)=>[`${String(i+1).padStart(2,'0')} / ${chapter.label.toUpperCase()} / ${chapter.seconds}s`,chapter.note,'']),
  'SOURCES',SOURCES.prices.label,SOURCES.prices.url,'',SOURCES.flows.label,SOURCES.flows.url,'',
  'Traction: https://neylo.xyz/api/pitch/metrics — production completed-participant aggregates, not demo activity.',
  'Always disclose simulated financial execution before demonstrating the product. Read current metrics from the screen; never memorize a count.',
].join('\n');}
