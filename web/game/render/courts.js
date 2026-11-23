// The courts you can play on. Colours and lighting only (the physics is the same on every surface),
// so the menu and tests can use this without a 3D library.
export const COURTS = [
  { id: 'clay', venue: 'Wimbledon', name: 'Clay Court', blurb: 'Warm red-orange clay with a green surround.',
    court: 0xc8643c, run: 0xb25530, ground: 0x4a9a5c, stripe: 0x3f8650, line: 0xf7f2e8, sky: 0xa6d4ff, hemi: 1.15, sun: 2.3, sunColor: 0xffe8c8, tex: 'hard' },
  { id: 'hard', venue: 'Wimbledon', name: 'Hard Court', blurb: 'Classic blue acrylic, clear and fast.',
    court: 0x3b73c9, run: 0x3568b8, ground: 0x4aa564, stripe: 0x3e8f55, line: 0xf4f4ff, sky: 0x8fc8ff, hemi: 1.1, sun: 2.2, sunColor: 0xfff1d6, tex: 'hard' },
  { id: 'grass', venue: 'Wimbledon', name: 'Grass Court', blurb: 'Fresh-cut lawn in the park, striped by the mower.',
    court: 0x5fb35d, run: 0x4ea04e, ground: 0x3f8f55, stripe: 0x357a49, line: 0xffffff, sky: 0x9ad2ff, hemi: 1.2, sun: 2.1, sunColor: 0xfff6d8, tex: 'grass' },
  // A public park court: green playing surface inside a big blue run-off, wire fence, trees and the park beyond. No stands or crowd.
  { id: 'loxford', venue: 'Loxford Park', name: 'Loxford Park', blurb: 'The park courts: green surface, blue surround, a wire fence and trees.',
    court: 0x5c8f56, run: 0x1f7fe0, ground: 0x4f9a54, stripe: 0x468a4b, line: 0xffffff, sky: 0x9fd4ff, hemi: 1.15, sun: 2.2, sunColor: 0xfff3d8, tex: 'hard' },
];
export const isPark = (court) => courtAt(court).id === 'loxford';
// Time of day is a separate choice: it only changes the sky, the light and the scenery, on any court.
export const TIMES = [
  { id: 'day', name: 'Day' },
  { id: 'sunset', name: 'Sunset', sky: 0xff9a6a, hemi: 0.95, sun: 2.0, sunColor: 0xffb070 },
  { id: 'night', name: 'Night', sky: 0x151c40, hemi: 0.7, sun: 1.3, sunColor: 0xbcd0ff },
  // starts as sunset and darkens through the match (the world blends towards `to` as the match goes on)
  { id: 'dusk', name: 'Dusk to Night', sky: 0xff9a6a, hemi: 0.95, sun: 2.0, sunColor: 0xffb070, to: { sky: 0x151c40, hemi: 0.7, sun: 1.3, sunColor: 0xbcd0ff } },
];
export const timeAt = (i) => TIMES[((i | 0) % TIMES.length + TIMES.length) % TIMES.length];
export const courtAt = (i) => COURTS[((i | 0) % COURTS.length + COURTS.length) % COURTS.length];
/** A court as lit at a time of day (colours of the surface stay, the light and sky change). */
export const themeFor = (court, time = 0) => { const t = timeAt(time); const { name, id, ...light } = t; return { ...courtAt(court), ...light, time: id }; };
