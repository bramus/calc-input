/**
 * <formula-input> Entry Point
 * Registers the <formula-input> custom element and exports public utilities.
 */

import { FormulaInput } from './components/formula-input.js';
import {
  DEFAULT_SEPARATOR,
  DEFAULT_SUBMIT,
  MATH_CONSTANTS,
  MATH_FUNCTIONS,
  normalizeSeparator,
  normalizeSubmit,
  formatResult,
  tokenizeFormula,
  parseFormulaToAST,
  evaluateAST,
  evaluateFormula,
} from './utils/formula-parser.js';

export {
  FormulaInput,
  DEFAULT_SEPARATOR,
  DEFAULT_SUBMIT,
  MATH_CONSTANTS,
  MATH_FUNCTIONS,
  normalizeSeparator,
  normalizeSubmit,
  formatResult,
  tokenizeFormula,
  parseFormulaToAST,
  evaluateAST,
  evaluateFormula,
};

export default FormulaInput;
