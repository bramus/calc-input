import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SEPARATOR,
  DEFAULT_SUBMIT,
  normalizeSeparator,
  normalizeSubmit,
  formatResult,
  tokenizeFormula,
  parseFormulaToAST,
  evaluateAST,
  evaluateFormula,
} from '../../src/js/formula-input/utils/formula-parser.js';

describe('formula-parser unit tests', () => {
  describe('normalizeSeparator()', () => {
    it('returns default separator "--" when null or undefined', () => {
      assert.equal(normalizeSeparator(undefined), DEFAULT_SEPARATOR);
      assert.equal(normalizeSeparator(null), '--');
    });

    it('accepts an empty string ""', () => {
      assert.equal(normalizeSeparator(''), '');
    });

    it('returns custom separator strings', () => {
      assert.equal(normalizeSeparator('_'), '_');
      assert.equal(normalizeSeparator(':'), ':');
      assert.equal(normalizeSeparator('__'), '__');
    });
  });

  describe('normalizeSubmit()', () => {
    it('defaults to "formula" when omitted, null, or unrecognized', () => {
      assert.equal(normalizeSubmit(undefined), DEFAULT_SUBMIT);
      assert.equal(normalizeSubmit(null), 'formula');
      assert.equal(normalizeSubmit(''), 'formula');
      assert.equal(normalizeSubmit('formula'), 'formula');
      assert.equal(normalizeSubmit('other'), 'formula');
    });

    it('returns "result", "formula-only", and "result-only" (case-insensitive)', () => {
      assert.equal(normalizeSubmit('result'), 'result');
      assert.equal(normalizeSubmit('RESULT'), 'result');
      assert.equal(normalizeSubmit(' Result '), 'result');
      assert.equal(normalizeSubmit('formula-only'), 'formula-only');
      assert.equal(normalizeSubmit('FORMULA-ONLY'), 'formula-only');
      assert.equal(normalizeSubmit(' formula-only '), 'formula-only');
      assert.equal(normalizeSubmit('result-only'), 'result-only');
      assert.equal(normalizeSubmit('RESULT-ONLY'), 'result-only');
      assert.equal(normalizeSubmit(' result-only '), 'result-only');
    });
  });

  describe('formatResult()', () => {
    it('formats integers and decimals cleanly', () => {
      assert.deepEqual(formatResult(5), { numericResult: 5, result: '5' });
      assert.deepEqual(formatResult(2.5), { numericResult: 2.5, result: '2.5' });
      assert.deepEqual(formatResult(-0), { numericResult: 0, result: '0' });
    });

    it('strips IEEE-754 floating-point noise (e.g. 0.1 + 0.2)', () => {
      assert.deepEqual(formatResult(0.1 + 0.2), { numericResult: 0.3, result: '0.3' });
    });

    it('throws for non-finite values', () => {
      assert.throws(() => formatResult(Infinity));
      assert.throws(() => formatResult(-Infinity));
      assert.throws(() => formatResult(NaN));
    });
  });

  describe('tokenizeFormula()', () => {
    it('tokenizes simple and complex formulas', () => {
      const tokens = tokenizeFormula('(2 + 3) * 4');
      assert.equal(tokens.length, 7);
      assert.equal(tokens[0].type, 'paren');
      assert.equal(tokens[1].value, 2);
      assert.equal(tokens[2].value, '+');
      assert.equal(tokens[3].value, 3);
      assert.equal(tokens[4].type, 'paren');
      assert.equal(tokens[5].value, '*');
      assert.equal(tokens[6].value, 4);
    });

    it('throws on invalid characters or malformed numbers', () => {
      assert.throws(() => tokenizeFormula('2 + $3'));
      assert.throws(() => tokenizeFormula('1.2.3 + 4'));
      assert.throws(() => tokenizeFormula('1e+'));
    });
  });

  describe('evaluateFormula()', () => {
    it('handles empty or whitespace-only formulas as valid empty results', () => {
      const empty = evaluateFormula('');
      assert.equal(empty.isValid, true);
      assert.equal(empty.isEmpty, true);
      assert.equal(empty.result, '');

      const spaces = evaluateFormula('   ');
      assert.equal(spaces.isValid, true);
      assert.equal(spaces.isEmpty, true);
      assert.equal(spaces.result, '');
    });

    it('evaluates basic arithmetic expressions', () => {
      assert.equal(evaluateFormula('2 + 3').result, '5');
      assert.equal(evaluateFormula('10 - 4').result, '6');
      assert.equal(evaluateFormula('6 * 7').result, '42');
      assert.equal(evaluateFormula('20 / 4').result, '5');
      assert.equal(evaluateFormula('10 % 3').result, '1');
    });

    it('evaluates complex formulas with parentheses and operator precedence', () => {
      assert.equal(evaluateFormula('(2 + 3) * 4').result, '20');
      assert.equal(evaluateFormula('2 + 3 * 4').result, '14');
      assert.equal(evaluateFormula('((1 + 2) * (3 + 4)) / 7').result, '3');
      assert.equal(evaluateFormula('100 / (2 + 3) + 2 ^ 3').result, '28');
      assert.equal(evaluateFormula('2 ** 4').result, '16');
      assert.equal(evaluateFormula('-(2 + 3) * 4').result, '-20');
      assert.equal(evaluateFormula('2 * -3').result, '-6');
      assert.equal(evaluateFormula('0.1 + 0.2').result, '0.3');
    });

    it('evaluates math functions and constants', () => {
      assert.equal(evaluateFormula('sqrt(16) + 2').result, '6');
      assert.equal(evaluateFormula('max(2, 5, 1) * 3').result, '15');
      assert.equal(evaluateFormula('min(10, 4) + abs(-3)').result, '7');
      assert.equal(evaluateFormula('round(10 / 3, 2)').result, '3.33');
      assert.equal(evaluateFormula('pow(2, 5)').result, '32');
    });

    it('marks unparsable or invalid formulas as isValid: false', () => {
      const invalidCases = [
        '2 + ',
        '+',
        '* 3',
        '(2 + 3',
        '2 + 3)',
        '()',
        '2 + * 3',
        '2 ++ 3',
        '2 -- 3',
        '2 3',
        'hello',
        '2 + unknownVar',
        'unknownFn(2)',
        '1 / 0',
        '10 % 0',
      ];

      for (const expr of invalidCases) {
        const res = evaluateFormula(expr);
        assert.equal(res.isValid, false, `Expected "${expr}" to be invalid`);
        assert.equal(res.result, '', `Expected "${expr}" to have empty result`);
        assert.ok(res.error, `Expected "${expr}" to have an error message`);
      }
    });

    it('parseFormulaToAST and evaluateAST work directly', () => {
      const tokens = tokenizeFormula('(2 + 3) * 4');
      const ast = parseFormulaToAST(tokens);
      assert.equal(evaluateAST(ast), 20);
    });
  });
});
