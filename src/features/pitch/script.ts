import { CHAPTERS, SOURCES } from './content';

function timestamp(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function pitchScript() {
  let elapsed = 0;
  return [
    'NEYLO — YOU KNOW WHO. WE FIND THE WAY.',
    'Three-minute pitch / spoken script and stage cues',
    '',
    'HOW TO USE',
    'Speak the paragraphs. Bracketed cues are for you, not the audience. Timings are rehearsal targets; allow the arrival to finish instead of rushing the receipt.',
    'Before presenting: open /pitch in Projector mode, prepare Nadin’s 25 KM composer, and keep Kerim connected on the second device. For a separate rehearsal, pair both pages using a private session link.',
    'Use manual chapter controls during the live demonstration. Manual interaction pauses guided playback.',
    '',
    ...CHAPTERS.flatMap((chapter, index) => {
      const start = elapsed;
      elapsed += chapter.seconds;
      return [
        `${String(index + 1).padStart(2, '0')} / ${chapter.label.toUpperCase()} / ${timestamp(start)}–${timestamp(elapsed)}`,
        `[${chapter.cue}]`,
        '',
        chapter.note,
        '',
      ];
    }),
    'IF THE DEMONSTRATION IS DELAYED',
    '“The connection is taking a moment. I’ll leave the transfer open and return to it.” Continue the pitch. Only describe an arrival after the receipt is visible; do not click Send repeatedly or pass a recording off as the current transfer.',
    '',
    'SOURCES — FOR REFERENCE, NOT SPOKEN',
    ...Object.values(SOURCES).flatMap(source => [source.label, source.url, '']),
    'Traction: https://neylo.xyz/api/pitch/metrics — production completed-participant aggregates, not demo activity.',
    'Always disclose simulated financial execution before demonstrating the product. Read current metrics from the screen; never memorize a count.',
  ].join('\n');
}
