import { describe, expect, it } from 'vitest';
import { formulaSuggestion, usesMathsPanel } from '../SubjectTools';

describe('formulaSuggestion', () => {
    it('offers chemistry notation for a plainly typed equation', () => {
        expect(formulaSuggestion('In the reaction N2 + 3H2 <=> 2NH3, what happens?', 'Chemistry')).toEqual({
            match: 'N2 + 3H2 <=> 2NH3',
            replacement: '$\\ce{N2 + 3H2 <=> 2NH3}$',
        });
        expect(formulaSuggestion('Dilute H2SO4 is added', 'Chemistry')?.replacement).toBe('$\\ce{H2SO4}$');
    });

    it('leaves formulas already written as maths, class names and other subjects alone', () => {
        expect(formulaSuggestion('In $\\ce{N2 + 3H2 <=> 2NH3}$, what happens?', 'Chemistry')).toBeNull();
        expect(formulaSuggestion('For SS2 learners: name the gas', 'Chemistry')).toBeNull();
        expect(formulaSuggestion('Dilute H2SO4 is added', 'English Language')).toBeNull();
    });

    it('offers standard form in any subject', () => {
        expect(formulaSuggestion('Light travels at 3.0 x 10^8 m/s', 'Physics')?.replacement).toBe('$3.0 \\times 10^{8}$');
    });
});

describe('usesMathsPanel', () => {
    it('opens the maths panel only for subjects that live on equations', () => {
        for (const subject of ['Mathematics', 'Further Mathematics', 'Physics', 'Chemistry']) {
            expect(usesMathsPanel(subject)).toBe(true);
        }
        for (const subject of ['English Language', 'Literature in English', 'Biology', 'Geography', '']) {
            expect(usesMathsPanel(subject)).toBe(false);
        }
    });
});
