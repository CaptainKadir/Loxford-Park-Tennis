// Story mode: a trail of six stops through Loxford Park. Beat the five rival cats, then Professor Hoot.
// Pure data and rules (no DOM), so it can be tested. The story changes with the cat you start as.
import { CATS, OWL, BOSS_INDEX } from './cats.js';

/** The six stops, in order. level: CPU level (0 easy .. 3 boss). games: games to take the match (short matches). x, y: place on the map (0..100). */
export const STOPS = [
  { id: 'gate', name: 'Park Gate', blurb: 'Where every story in Loxford starts.', court: 2, time: 0, level: 0, games: 2, x: 8, y: 74 },
  { id: 'pond', name: 'Duck Pond', blurb: 'Quiet water, loud ducks.', court: 2, time: 1, level: 0, games: 2, weather: 1, x: 27, y: 38 },
  { id: 'market', name: 'Market Square', blurb: 'Clay courts behind the fish stalls.', court: 0, time: 0, level: 1, games: 2, x: 47, y: 70 },
  { id: 'rooftop', name: 'Rooftop Court', blurb: 'The city glows below.', court: 1, time: 1, level: 1, games: 3, x: 64, y: 30 },
  { id: 'harbour', name: 'Harbour Lights', blurb: 'Wind, salt and floodlights.', court: 0, time: 2, level: 2, games: 3, weather: 2, x: 82, y: 70 },
  { id: 'roost', name: "Hoot's Roost", blurb: 'The clock tower court, high above the park.', court: 1, time: 2, level: 3, games: 3, x: 92, y: 40 },
];
export const STAGES = STOPS.length;

// What each hero is after, for the story's opening screen.
export const PREMISES = [
  { title: 'The Golden Sardine Tin', text: 'Professor Hoot\'s night patrol has taken Otis\'s Golden Sardine Tin, the only treasure a hobo ever owned. It is locked in the clock tower. Otis has a racket and nothing to lose.' },
  { title: 'The Last Sunbeam', text: 'Hoot had floodlights rigged over the courts, and Minu\'s warm patch of sun is gone. A cat needs her naps. Minu is going to the clock tower, and she is going to be grumpy about it.' },
  { title: 'The Midnight Crown', text: 'Night belongs to Bombay, until Professor Hoot declared himself lord of the dark. A ninja does not let an owl keep the crown. Bombay will take it back, one quiet match at a time.' },
  { title: 'The Missing Flock', text: 'Bella\'s pigeons have vanished from the park, and the feathers lead to Professor Hoot\'s roost. Somebody has to ask him nicely. With a racket.' },
  { title: 'The Cloud Cup', text: 'The Cloud Cup, the fluffiest trophy in Loxford, has been "borrowed" by Professor Hoot. Snowy wants it back before her fur loses its shine. She will be polite. She will also win.' },
  { title: 'The Great Ball Heist', text: 'Biscuit spent a year stealing a thousand tennis balls. Professor Hoot stole them all back in one night. Nobody out-steals Biscuit. This is personal.' },
];

// The five other cats, in the order a hero meets them: next cat along, then on round the roster.
export function rivalFor(hero, stage) {
  if (stage >= STAGES - 1) return BOSS_INDEX;
  const others = [];
  for (let i = 1; i < CATS.length; i++) others.push((hero + i) % CATS.length);
  return others[stage];
}

// The rivalries: PAIRS[hero][rival] is the talk before the match, [who, line] with who 'h' (hero) or 'r' (rival).
const NAMES = CATS.map((c) => c.name);
const PAIRS = {
  Otis: {
    Minu: [['r', 'You again. You slept on my bench. It was still warm. It was MY warm.'], ['h', 'A bench is only borrowed, Minu. Like everything else in life.'], ['r', 'Then I am borrowing a win off you. Hmph.']],
    Bombay: [['h', 'Bombay. Somebody ate my lunch last Tuesday and left no crumbs. Only a ninja is that tidy.'], ['r', '...I do not confirm. I do not deny. It was a good sandwich.'], ['h', 'Then you owe me a sandwich, or a set.']],
    Bella: [['r', 'My pigeons say you hide crumbs in your coat. That is their bread, Otis.'], ['h', 'Finders keepers, Bella. The pigeons can have the second helping, if they ask nicely.'], ['r', 'They do not ask. They are pigeons. Serve.']],
    Snowy: [['r', 'Please keep downwind of me, Otis. I have just brushed.'], ['h', 'Fluffball, I have slept in worse weather than you have walked in.'], ['r', 'Do not call me fluffball. Do not stand there. And do not win.']],
    Biscuit: [['r', 'Otis! My favourite shopping cart thief!'], ['h', 'You stole it from ME, Biscuit. I was only stealing it back.'], ['r', 'Details, details. Best of three? Loser gets the cart. HA!']],
  },
  Minu: {
    Otis: [['h', 'Otis. You were on my bench. It was still warm.'], ['r', 'Friend, a bench is only borrowed. A cat who understands this finds peace.'], ['h', 'A cat who understands this gets a racket in the face. Hmph. Serve.']],
    Bombay: [['h', 'Your shadow was over my sunbeam again. I could feel it.'], ['r', 'It is not possible. Nobody can feel me.'], ['h', 'I can. I feel you the way I feel a cold draught. Play.']],
    Bella: [['h', 'Your pigeons woke me. Eleven times. I counted. I had nothing else to do, I was awake.'], ['r', 'They only wanted to say good morning, Minu.'], ['h', 'Nothing is good about the morning. Hmph.']],
    Snowy: [['r', 'Minu! Isn\'t it a lovely day? I brought you a daisy!'], ['h', 'Take it away. It is far too cheerful. It smells of mornings.'], ['r', 'One game and you will love me. Everybody does!']],
    Biscuit: [['r', 'Remember when I pushed your cup off the table, Minu? I do. Fondly.'], ['h', 'Eleven times. You pushed it off eleven times.'], ['r', 'And you never reacted! Today I will make you react, in a tennis match!']],
  },
  Bombay: {
    Otis: [['h', 'You breathe loudly, Otis. A stakeout with you is a brass band.'], ['r', 'It is called living, my shadowy friend. You should try it.'], ['h', 'I will try it after I win.']],
    Minu: [['h', 'Minu. Of all the cats in the park, you are the only one who sees me.'], ['r', 'You walk like a drum solo. A ninja you are not.'], ['h', 'Then this match will teach you what a ninja is.']],
    Bella: [['r', 'Bombay! The pigeons said you were on the wall again!'], ['h', 'They always see me. Every ninja\'s nightmare: a flock of tiny informers.'], ['r', 'They are my friends, and they will cheer for me.']],
    Snowy: [['r', 'Oh, Bombay! You are always so... dark. We should be a team. Black and white!'], ['h', 'Your fur is a lantern, Snowy. I cannot hide next to you.'], ['r', 'That is the best compliment I have had all week. Serve!']],
    Biscuit: [['r', 'The great thief Bombay! I heard you took the baker\'s moon-cake without a sound.'], ['h', 'Art. Silence. Precision. You throw ropes and shout, Biscuit.'], ['r', 'Chaos is also an art! Let us find out whose art wins.']],
  },
  Bella: {
    Otis: [['h', 'Otis, the pigeons told me about the crumbs in your coat.'], ['r', 'They gave me the crumbs, Bella. It is called sharing.'], ['h', 'They are pigeons. They share nothing. Play.']],
    Bombay: [['h', 'You frighten my pigeons, Bombay. They flew off a rooftop and into a bin.'], ['r', 'I only stood. I stood very quietly.'], ['h', 'Quietly is the problem. Now I will return the favour with a forehand.']],
    Minu: [['r', 'Pigeons! Hmph. They wake the whole park at dawn, and you encourage them.'], ['h', 'They only say hello, Minu. Maybe you would feel better if you answered.'], ['r', 'I answer nobody before ten. I will answer you with a tennis ball.']],
    Snowy: [['r', 'Bella! Your pigeons landed on my coat again. I look like a dandelion that lost an argument.'], ['h', 'They think you are a cloud, Snowy. It is a compliment.'], ['r', 'Then you can say it kindly after I beat you.']],
    Biscuit: [['r', 'Pigeon lady! I will swap three stolen balls for one fat pigeon.'], ['h', 'No pigeon is for sale, Biscuit. And no ball is yours.'], ['r', 'Everything is mine, if I get there first! Serve!']],
  },
  Snowy: {
    Otis: [['r', 'Look who it is, the snow princess. Smell that? That is the open road.'], ['h', 'That is you, Otis. Please stand downwind. I have a rally to win.'], ['r', 'The road does not care how clean you are. Play ball.']],
    Minu: [['r', 'Cheerful. Fluffy. Sparkly. A dandelion in a bad mood.'], ['h', 'I am a CLOUD, Minu. A cloud with a very good backhand.'], ['r', 'Prove it. Between naps.']],
    Bombay: [['r', 'Your fur is loud, Snowy. It lights up the entire court.'], ['h', 'Maybe the court needs a little light. You are so gloomy, Bombay!'], ['r', 'I am not gloomy. I am dark. There is a difference. Serve.']],
    Bella: [['r', 'Pigeons love you, Snowy. They sit on you like a bench.'], ['h', 'And leave me gifts, Bella! I smell like a park for a week!'], ['r', 'They are fond of you. Today I am fond of winning.']],
    Biscuit: [['r', 'Snowy! The cat who told the park warden about the Balloon Incident!'], ['h', 'You popped forty balloons in the library, Biscuit. Somebody had to say something.'], ['r', 'I regret nothing! HA! Serve and prepare to be tattled on, again!']],
  },
  Biscuit: {
    Otis: [['h', 'Otis! I heard you stole the cart back. HA! I have a plan to steal it again.'], ['r', 'Biscuit, you are a menace, and a friend. But the cart is mine.'], ['h', 'Fine. Beat me and keep it. I will go quietly. Loudly.']],
    Minu: [['h', 'Minu! The only cat who never flinches when I knock over her cup.'], ['r', 'Eleven times, Biscuit. Eleven. I am saving the twelfth for your face.'], ['h', 'Ooh. A threat! My favourite!']],
    Bombay: [['h', 'The silent shadow! You and I are the best thieves in Loxford. Settle it on court?'], ['r', 'Thieves steal quietly. You steal with fireworks.'], ['h', 'And I have never been caught on the same night twice!']],
    Bella: [['r', 'Biscuit. My pigeons tell me everything you have done this week. It is a long list.'], ['h', 'Tell them to stop spying on me, Bella! A cat is entitled to a little crime!'], ['r', 'Not in my park. Serve.']],
    Snowy: [['r', 'Biscuit! You are on the warden\'s list again. I put you there myself.'], ['h', 'SNOWY. The Balloon Incident was a PERFORMANCE.'], ['r', 'It was forty popped balloons and a very sad librarian. Serve!']],
  },
};

// Professor Hoot's greeting to each hero, and how it ends.
const BOSS_TALK = [
  [['r', 'Otis. The hobo who sleeps on benches and thinks he can climb my tower.'], ['h', 'I came for my Golden Sardine Tin, Professor. Open the drawer, or open the match.'], ['r', 'Whoo-hoo. A sardine is a trophy. Your trophy is a draw against the dark. Serve.']],
  [['r', 'Minu. The sleepiest cat in the park, and the grumpiest. Come to complain?'], ['h', 'You took my sunbeam, Hoot. Give it back, or I will take your whole roost.'], ['r', 'Whoo-hoo. Win the match, little cat, and the lamps go out. Lose it and you nap in the dark for ever.']],
  [['r', 'Bombay. Shadow of the park. Do you really think you are darker than me?'], ['h', 'I do not think. I am. Give me back the Midnight Crown, Professor.'], ['r', 'The night has an owl, young ninja, and the owl does not share. Show me your best.']],
  [['r', 'Bella, the pigeon whisperer. Come to scold me for borrowing your birds?'], ['h', 'You took my friends, Hoot. They are not food, they are not furniture. Where are they?'], ['r', 'Whoo-hoo. Win, and the whole flock flies free. Lose, and you stay with me. Serve.']],
  [['r', 'Snowy. So much fluff for so small a trophy. Whoo-hoo.'], ['h', 'The Cloud Cup is mine, Professor. I will ask politely once. Then I will beat you politely.'], ['r', 'Polite. How charming. You will be charming all the way to the baseline.']],
  [['r', 'Biscuit. The famous thief, back to claim his stolen balls. How cute.'], ['h', 'A thousand balls, Hoot! A YEAR of crime! You do not simply take them from a cat like me.'], ['r', 'I simply did. Now win them back, thief, if you can.']],
];
const ENDINGS = [
  'The tower door swings open. Inside, the Golden Sardine Tin glows in the dark. Otis opens it, shares the sardines with every cat in the park, and sleeps on the bench he deserves.',
  'The floodlights go dark. A warm patch of sun slides back across the court, and Minu curls up in the exact middle of it. She says it is "acceptable". It is the happiest she has ever been.',
  'Professor Hoot bows his great head. The Midnight Crown is Bombay\'s again, and the night belongs to the ninja. No one ever sees him leave. No one ever sees him come.',
  'The doors of the roost burst open, and a thousand pigeons pour out into the sky. Bella laughs as they land on her shoulders, her hat and her racket. The park is loud again.',
  'The Cloud Cup rises from the owl\'s drawer, spotless and soft. Snowy lifts it over her head, and the whole park, even the grumpy ones, applauds. She is, of course, delighted.',
  'A thousand tennis balls tumble out of the clock tower, bouncing down every stair. Biscuit grins and lets the whole park have a few. He keeps nine hundred. He is still Biscuit.',
];
// A quip from the beaten rival, shown after a win.
const DEFEAT_LINES = {
  Otis: 'Ha! The road was kind to you today, friend.',
  Minu: 'Hmph. Fine. You win. Do not tell anyone.',
  Bombay: '...You saw me coming. Impressive.',
  Bella: 'Well played! The pigeons clapped. Even the grumpy one.',
  Snowy: 'Oh! That was wonderful. Please do not tell my fur.',
  Biscuit: 'HA! You win! I will steal it back later!',
};

/** The talk before a match: lines of { speaker: cat index, name, text, mine }. */
export function dialogueFor(hero, stage) {
  const rival = rivalFor(hero, stage);
  const raw = rival === BOSS_INDEX ? BOSS_TALK[hero] : PAIRS[NAMES[hero]][NAMES[rival]];
  const rName = rival === BOSS_INDEX ? OWL.name : NAMES[rival];
  return raw.map(([who, text]) => {
    const mine = who === 'h';
    return mine ? { speaker: hero, name: NAMES[hero], text, mine: true } : { speaker: rival, name: rName, text, mine: false };
  });
}

/** The one-line comment from the beaten opponent. */
export function defeatLine(hero, stage) {
  const rival = rivalFor(hero, stage);
  return rival === BOSS_INDEX ? 'Whoo... Hoot has been beaten. The tower is yours.' : DEFEAT_LINES[NAMES[rival]];
}

export const endingFor = (hero) => ENDINGS[hero % ENDINGS.length];
export const premiseFor = (hero) => PREMISES[hero % PREMISES.length];

/** The settings a stop plays with (court, time, rival, CPU level, games to win). */
export function stopSettings(hero, stage) {
  const stop = STOPS[Math.min(stage, STAGES - 1)];
  return { cat1: hero, cat2: rivalFor(hero, stage), court: stop.court, time: stop.time, level: stop.level, games: stop.games, stop };
}

// --- progress: how far each cat's story has got (0 = just starting, STAGES = finished), kept in the browser ---
const KEY = 'loxford.story';
export function loadProgress(storage) {
  try {
    const p = JSON.parse(storage.getItem(KEY) || '{}');
    return p && typeof p === 'object' ? p : {};
  } catch { return {}; }
}
export function stageOf(storage, hero) {
  const v = Number(loadProgress(storage)[hero]);
  return Number.isInteger(v) && v >= 0 && v <= STAGES ? v : 0;
}
export function setStage(storage, hero, stage) {
  const p = loadProgress(storage);
  p[hero] = Math.max(0, Math.min(STAGES, stage | 0));
  try { storage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode: the story just restarts next time */ }
}
