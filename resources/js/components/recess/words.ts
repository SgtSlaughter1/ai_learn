/**
 * Word lists for Recess games, shipped with the app so they work offline. Word Search picks
 * from the learner's own subjects; Word of the Day uses one shared list so a class can talk
 * about the same word. British spelling, letters only.
 */

const SUBJECT_WORDS: { match: RegExp; words: string[] }[] = [
    { match: /bio/i, words: ['CELL', 'NUCLEUS', 'ENZYME', 'TISSUE', 'OSMOSIS', 'GENE', 'VALVE', 'NEURON', 'PLASMA', 'XYLEM', 'PHLOEM', 'HORMONE', 'KIDNEY', 'POLLEN', 'SPORE', 'FUNGI', 'ALGAE', 'HABITAT', 'RIBOSOME', 'ALLELE'] },
    { match: /chem/i, words: ['ATOM', 'ION', 'MOLE', 'ACID', 'BASE', 'SALT', 'OXIDE', 'ISOTOPE', 'ALKANE', 'ESTER', 'POLYMER', 'CATALYST', 'ELECTRON', 'PROTON', 'NEUTRON', 'VALENCY', 'ANODE', 'CATHODE', 'BOND', 'REDOX'] },
    { match: /phys/i, words: ['FORCE', 'MASS', 'ENERGY', 'VECTOR', 'MOMENTUM', 'WAVE', 'PRISM', 'LENS', 'CURRENT', 'VOLTAGE', 'OHM', 'MAGNET', 'FRICTION', 'GRAVITY', 'DENSITY', 'PRESSURE', 'INERTIA', 'TORQUE', 'RADIATION', 'PHOTON'] },
    { match: /math|further/i, words: ['ANGLE', 'RADIUS', 'MATRIX', 'VECTOR', 'PRIME', 'RATIO', 'SURD', 'INDEX', 'LOG', 'MEAN', 'MEDIAN', 'MODE', 'SINE', 'COSINE', 'TANGENT', 'PROOF', 'SET', 'LIMIT', 'INTEGER', 'DOMAIN'] },
    { match: /english|literature|lit\b/i, words: ['NOUN', 'VERB', 'ADVERB', 'CLAUSE', 'PHRASE', 'IDIOM', 'SIMILE', 'METAPHOR', 'IRONY', 'RHYME', 'STANZA', 'SONNET', 'PLOT', 'THEME', 'SETTING', 'TONE', 'ALLUSION', 'PROLOGUE', 'SATIRE', 'DICTION'] },
    { match: /econ|commerce|account|insurance/i, words: ['DEMAND', 'SUPPLY', 'PRICE', 'MARKET', 'TAX', 'PROFIT', 'BUDGET', 'CREDIT', 'DEBIT', 'LEDGER', 'ASSET', 'EQUITY', 'TARIFF', 'EXPORT', 'IMPORT', 'WAGE', 'CAPITAL', 'BANK', 'INFLATION', 'PREMIUM'] },
    { match: /geog/i, words: ['DELTA', 'PLATEAU', 'CLIMATE', 'EROSION', 'SAVANNA', 'LATITUDE', 'MONSOON', 'LAGOON', 'VALLEY', 'BASIN', 'RIDGE', 'CONTOUR', 'BEARING', 'WEATHER', 'RAINFALL', 'HARMATTAN', 'ESTUARY', 'CRATER', 'GLACIER', 'MAP'] },
    { match: /gov|civic|history|religious|crs|irs/i, words: ['SENATE', 'CABINET', 'COURT', 'LAW', 'VOTE', 'ELECTION', 'MINISTER', 'TREATY', 'COLONY', 'EMPIRE', 'RIGHTS', 'DUTY', 'CITIZEN', 'NATION', 'STATE', 'DECREE', 'PARTY', 'REFERENDUM', 'MANDATE', 'GOSPEL'] },
];

/** Used when none of the learner's subjects has its own list. */
const GENERAL_WORDS = ['STUDY', 'LEARN', 'BOOK', 'EXAM', 'READ', 'WRITE', 'THINK', 'IDEA', 'LOGIC', 'SCIENCE', 'NUMBER', 'LETTER', 'SCHOOL', 'TEACHER', 'PUPIL', 'LIBRARY'];

/** Words for the learner's subjects (by name), without repeats. */
export function wordsForSubjects(subjectNames: string[]): string[] {
    const words = new Set<string>();
    for (const name of subjectNames) {
        for (const group of SUBJECT_WORDS) {
            if (group.match.test(name)) group.words.forEach((w) => words.add(w));
        }
    }
    return words.size > 0 ? [...words] : GENERAL_WORDS;
}

/** Five-letter curriculum words, one per day in a fixed order. */
export const DAILY_WORDS = [
    'FORCE', 'CELLS', 'OZONE', 'PRISM', 'VALVE', 'ANGLE', 'RATIO', 'NOUNS', 'IRONY', 'DELTA',
    'ATOMS', 'IONIC', 'ACIDS', 'BASES', 'OXIDE', 'ESTER', 'MOLAR', 'WAVES', 'POWER', 'SPEED',
    'GENES', 'ORGAN', 'XYLEM', 'SPORE', 'ALGAE', 'FUNGI', 'BLOOD', 'HEART', 'LIVER', 'NERVE',
    'PRIME', 'SLOPE', 'GRAPH', 'CHORD', 'VERBS', 'IDIOM', 'RHYME', 'THEME', 'PROSE', 'DRAMA',
    'GENRE', 'PRICE', 'TRADE', 'LOANS', 'TAXES', 'BANKS', 'COURT', 'VOTES', 'STATE', 'RIVER',
    'OCEAN', 'BASIN', 'RIDGE', 'LUNGS', 'TOOTH', 'SUGAR', 'WATER', 'SOLID', 'FLUID', 'PHASE',
    'METAL', 'EARTH', 'ORBIT', 'LIGHT', 'SOUND', 'MOTOR', 'VOLTS',
];

/** Days since 1 Jan 2026 in the device's local calendar, so everyone shares a word per day. */
export function dayNumber(date = new Date()): number {
    const start = Date.UTC(2026, 0, 1);
    const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    return Math.floor((today - start) / 86_400_000);
}

export function wordOfTheDay(date = new Date()): string {
    const n = dayNumber(date);
    return DAILY_WORDS[((n % DAILY_WORDS.length) + DAILY_WORDS.length) % DAILY_WORDS.length];
}
