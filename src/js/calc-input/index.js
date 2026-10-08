/**
 * <calc-input> Entry Point
 * Registers the <calc-input> custom element and exports public utilities.
 */

import { CalcInput } from './components/calc-input.js';
import {
  DEFAULT_SEPARATOR,
  DEFAULT_SUBMIT,
  VALID_SUBMIT_MODES,
  MATH_CONSTANTS,
  MATH_FUNCTIONS,
  normalizeSeparator,
  normalizeSubmit,
  formatResult,
  tokenizeFormula,
  parseFormulaToAST,
  evaluateAST,
  evaluateFormula,
} from './utils/calc-parser.js';

export {
  CalcInput,
  DEFAULT_SEPARATOR,
  DEFAULT_SUBMIT,
  VALID_SUBMIT_MODES,
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

export default CalcInput;
