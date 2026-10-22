import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RichText, normalizeMathDelimiters } from '../RichText';

const html = (text: string, inline = false) => renderToStaticMarkup(<RichText text={text} inline={inline} />);

describe('RichText', () => {
    it('underlines __word__ and keeps **word** bold', () => {
        const out = html('Choose the word nearest in meaning to __haggling__, not **bargain**.');
        expect(out).toContain('<u class="rich-underline">haggling</u>');
        expect(out).toContain('<strong>bargain</strong>');
    });

    it('renders chemistry with mhchem', () => {
        const out = html('In $\\ce{N2 + 3H2 <=> 2NH3}$ the pressure rises.');
        expect(out).toContain('class="katex"');
        expect(out).toContain('x-arrow'); // the ⇌ equilibrium arrow, drawn by mhchem
        expect(out).not.toContain('katex-error');
    });

    it('renders maths', () => {
        expect(html('$\\frac{1}{2}$')).toContain('class="katex"');
    });

    it('renders tables in a scroll box', () => {
        const out = html('| Item | Dr | Cr |\n|---|---|---|\n| Cash | 500 | |');
        expect(out).toContain('<div class="rich-table my-2 overflow-x-auto"><table>');
        expect(out).toContain('<td>Cash</td>');
    });

    it('keeps every line of a poem block', () => {
        const out = html('```poem\nI wandered lonely as a cloud\nThat floats on high o\'er vales and hills\n```');
        expect(out).toContain('rich-poem');
        expect(out).toContain('I wandered lonely as a cloud\nThat floats');
        expect(out).not.toContain('<pre>');
    });

    it('never renders raw HTML from authors', () => {
        const out = html('Hi <script>alert(1)</script><img src=x onerror="alert(2)"> <u>raw</u>');
        expect(out).not.toContain('<script');
        expect(out).not.toContain('<img');
        expect(out).not.toContain('<u>raw</u>');
    });

    it('keeps blanks as plain text', () => {
        expect(html('A trade discount is _________ discount.')).toContain('_________');
    });

    it('renders inline for options', () => {
        expect(html('Pressure doubles', true)).not.toContain('<p>');
    });

    it('reads \\( \\) and \\[ \\] maths from AI answers', () => {
        expect(normalizeMathDelimiters('Roots \\(x=-3\\) and \\(x=\\frac12\\).\n\\[\nx=\\frac{-5\\pm7}{4}\n\\]\nCost $5.'))
            .toBe('Roots $x=-3$ and $x=\\frac12$.\n$$x=\\frac{-5\\pm7}{4}$$\nCost $5.');
        expect(html('Roots \\(x=-3\\)')).toContain('class="katex"');
    });
});
