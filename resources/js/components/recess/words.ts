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

/**
 * A clue for each daily word: its subject and what it means or is used for. Clues never
 * contain the word itself, so showing one helps without giving the answer away.
 */
export const DAILY_HINTS: Record<string, { subject: string; clue: string }> = {
    FORCE: { subject: 'Physics', clue: 'A push or a pull that can change how an object moves.' },
    CELLS: { subject: 'Biology', clue: 'The tiny basic units that all living things are made of.' },
    OZONE: { subject: 'Chemistry', clue: 'A gas high in the atmosphere that blocks much of the sun’s ultraviolet rays.' },
    PRISM: { subject: 'Physics', clue: 'A glass block that splits white light into the colours of the rainbow.' },
    VALVE: { subject: 'Biology', clue: 'A flap in the heart or veins that stops blood flowing backwards.' },
    ANGLE: { subject: 'Mathematics', clue: 'The amount of turn between two lines that meet, measured in degrees.' },
    RATIO: { subject: 'Mathematics', clue: 'A comparison of two amounts, written like 2 : 3.' },
    NOUNS: { subject: 'English', clue: 'Words that name people, places, things or ideas.' },
    IRONY: { subject: 'Literature', clue: 'When what happens, or what is meant, is the opposite of what you expect.' },
    DELTA: { subject: 'Geography', clue: 'Flat land formed where a river drops its sediment as it enters the sea, like the Niger’s.' },
    ATOMS: { subject: 'Chemistry', clue: 'The smallest particles of an element, made of protons, neutrons and electrons.' },
    IONIC: { subject: 'Chemistry', clue: 'The kind of bonding where electrons pass from one atom to another, as in table salt.' },
    ACIDS: { subject: 'Chemistry', clue: 'Substances with a pH below 7 that turn blue litmus paper red.' },
    BASES: { subject: 'Chemistry', clue: 'Substances that neutralise acids; the ones that dissolve in water are alkalis.' },
    OXIDE: { subject: 'Chemistry', clue: 'A compound of oxygen and one other element, such as rust on iron.' },
    ESTER: { subject: 'Chemistry', clue: 'A sweet-smelling compound made when an acid reacts with an alcohol.' },
    MOLAR: { subject: 'Chemistry', clue: 'Describes an amount per mole, as in the mass of one mole of a substance.' },
    WAVES: { subject: 'Physics', clue: 'Disturbances that carry energy from place to place, like sound and light.' },
    POWER: { subject: 'Physics', clue: 'The rate of doing work, measured in watts.' },
    SPEED: { subject: 'Physics', clue: 'How far something travels in a unit of time, such as metres per second.' },
    GENES: { subject: 'Biology', clue: 'Sections of DNA that carry the instructions for inherited traits.' },
    ORGAN: { subject: 'Biology', clue: 'A group of tissues working together for one job, such as the heart or the liver.' },
    XYLEM: { subject: 'Biology', clue: 'The tubes in a plant that carry water up from the roots.' },
    SPORE: { subject: 'Biology', clue: 'A tiny cell that ferns, mosses and fungi use to reproduce.' },
    ALGAE: { subject: 'Biology', clue: 'Simple, often green, plant-like living things that grow in water and make food from sunlight.' },
    FUNGI: { subject: 'Biology', clue: 'Living things like mushrooms and moulds that feed on dead or decaying matter.' },
    BLOOD: { subject: 'Biology', clue: 'The red liquid that carries oxygen and food around the body.' },
    HEART: { subject: 'Biology', clue: 'The muscular organ that pumps blood around the body.' },
    LIVER: { subject: 'Biology', clue: 'The large organ that makes bile and removes poisons from the blood.' },
    NERVE: { subject: 'Biology', clue: 'A bundle of fibres that carries messages between the brain and the body.' },
    PRIME: { subject: 'Mathematics', clue: 'Describes a whole number above 1 whose only factors are 1 and itself, like 7.' },
    SLOPE: { subject: 'Mathematics', clue: 'The steepness of a line, worked out as rise over run.' },
    GRAPH: { subject: 'Mathematics', clue: 'A diagram that shows how two quantities are related.' },
    CHORD: { subject: 'Mathematics', clue: 'A straight line joining two points on a circle.' },
    VERBS: { subject: 'English', clue: 'Words for actions or states, such as run, think and is.' },
    IDIOM: { subject: 'English', clue: 'A phrase whose meaning differs from its words, like “kick the bucket”.' },
    RHYME: { subject: 'Literature', clue: 'When words end with the same sound, like cat and hat.' },
    THEME: { subject: 'Literature', clue: 'The main idea or message of a story or poem.' },
    PROSE: { subject: 'Literature', clue: 'Ordinary writing in sentences and paragraphs, not in verse.' },
    DRAMA: { subject: 'Literature', clue: 'A story written to be acted on a stage.' },
    GENRE: { subject: 'Literature', clue: 'A type of writing, such as poetry, prose or drama.' },
    PRICE: { subject: 'Economics', clue: 'The amount of money paid for a good or service.' },
    TRADE: { subject: 'Commerce', clue: 'The buying and selling of goods and services.' },
    LOANS: { subject: 'Commerce', clue: 'Money borrowed that must be paid back, usually with interest.' },
    TAXES: { subject: 'Economics', clue: 'Money that people and businesses must pay to the government.' },
    BANKS: { subject: 'Commerce', clue: 'Institutions that keep people’s money safe and lend it out.' },
    COURT: { subject: 'Government', clue: 'Where cases are heard and judges apply the law.' },
    VOTES: { subject: 'Government', clue: 'What citizens cast in an election to choose their leaders.' },
    STATE: { subject: 'Government', clue: 'A country with its own government, or one of Nigeria’s 36 parts, like Lagos or Kano.' },
    RIVER: { subject: 'Geography', clue: 'A large natural stream of fresh water flowing to the sea or a lake, like the Niger.' },
    OCEAN: { subject: 'Geography', clue: 'A huge body of salt water, such as the Atlantic.' },
    BASIN: { subject: 'Geography', clue: 'The area of land drained by a river and its tributaries.' },
    RIDGE: { subject: 'Geography', clue: 'A long, narrow stretch of high land.' },
    LUNGS: { subject: 'Biology', clue: 'The organs of breathing, where oxygen passes into the blood.' },
    TOOTH: { subject: 'Biology', clue: 'A hard structure in the mouth used to bite and chew food.' },
    SUGAR: { subject: 'Biology', clue: 'A sweet carbohydrate, such as glucose, that the body uses for energy.' },
    WATER: { subject: 'Chemistry', clue: 'H₂O, the compound of hydrogen and oxygen that covers most of the Earth.' },
    SOLID: { subject: 'Physics', clue: 'The state of matter with a fixed shape and volume.' },
    FLUID: { subject: 'Physics', clue: 'Any substance that can flow: a liquid or a gas.' },
    PHASE: { subject: 'Physics', clue: 'A stage in a repeating cycle, like the shapes of the moon each month.' },
    METAL: { subject: 'Chemistry', clue: 'A shiny element that conducts heat and electricity, such as iron or copper.' },
    EARTH: { subject: 'Geography', clue: 'Our planet, the third from the sun.' },
    ORBIT: { subject: 'Physics', clue: 'The curved path of a planet or satellite around another body.' },
    LIGHT: { subject: 'Physics', clue: 'The energy that lets us see, the fastest thing in the universe.' },
    SOUND: { subject: 'Physics', clue: 'Vibrations that travel through air and other materials to our ears.' },
    MOTOR: { subject: 'Physics', clue: 'A machine that turns electrical energy into movement.' },
    VOLTS: { subject: 'Physics', clue: 'The units used to measure potential difference.' },
};

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
