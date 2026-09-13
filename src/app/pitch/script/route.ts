import { pitchScript } from '@/features/pitch/script';
export function GET(){return new Response(pitchScript(),{headers:{'Content-Type':'text/plain; charset=utf-8','Content-Disposition':'attachment; filename="neylo-pitch-script.txt"','X-Robots-Tag':'noindex, nofollow'}});}
