/**
 * Safe mathematical formula tokenizer, recursive-descent AST parser, and evaluator.
 * Evaluates arithmetic expressions, parentheses, powers, and standard math functions
 * without using eval() or new Function().
 */

export const DEFAULT_SEPARATOR = '--';
export const DEFAULT_SUBMIT = 'formula';

export const MATH_CONSTANTS = Object.freeze({
  pi: Math.PI,
  e: Math.E,
});

export const MATH_FUNCTIONS = Object.freeze({
  sqrt: { minArgs: 1, maxArgs: 1, fn: (x) => Math.sqrt(x) },
  abs: { minArgs: 1, maxArgs: 1, fn: (x) => Math.abs(x) },
  round: {
    minArgs: 1,
    maxArgs: 2,
    fn: (x, decimals = 0) => {
      const factor = 10 ** decimals;
      return Math.round(x * factor) / factor;
    },
  },
  floor: { minArgs: 1, maxArgs: 1, fn: (x) => Math.floor(x) },
  ceil: { minArgs: 1, maxArgs: 1, fn: (x) => Math.ceil(x) },
  trunc: { minArgs: 1, maxArgs: 1, fn: (x) => Math.trunc(x) },
  sign: { minArgs: 1, maxArgs: 1, fn: (x) => Math.sign(x) },
  min: { minArgs: 1, maxArgs: Infinity, fn: (...args) => Math.min(...args) },
  max: { minArgs: 1, maxArgs: Infinity, fn: (...args) => Math.max(...args) },
  pow: { minArgs: 2, maxArgs: 2, fn: (base, exp) => base ** exp },
  mod: {
    minArgs: 2,
    maxArgs: 2,
    fn: (a, b) => {
      if (b === 0) throw new Error('Division by zero');
      return a % b;
    },
  },
  sin: { minArgs: 1, maxArgs: 1, fn: (x) => Math.sin(x) },
  cos: { minArgs: 1, maxArgs: 1, fn: (x) => Math.cos(x) },
  tan: { minArgs: 1, maxArgs: 1, fn: (x) => Math.tan(x) },
  asin: { minArgs: 1, maxArgs: 1, fn: (x) => Math.asin(x) },
  acos: { minArgs: 1, maxArgs: 1, fn: (x) => Math.acos(x) },
  atan: { minArgs: 1, maxArgs: 1, fn: (x) => Math.atan(x) },
  log: { minArgs: 1, maxArgs: 1, fn: (x) => Math.log10(x) },
  log10: { minArgs: 1, maxArgs: 1, fn: (x) => Math.log10(x) },
  log2: { minArgs: 1, maxArgs: 1, fn: (x) => Math.log2(x) },
  ln: { minArgs: 1, maxArgs: 1, fn: (x) => Math.log(x) },
  exp: { minArgs: 1, maxArgs: 1, fn: (x) => Math.exp(x) },
});

/**
 * Normalizes the separator value.
 * Preserves empty string `""`, defaults to `"--"` when null or undefined.
 *
 * @param {string|null|undefined} separator
 * @returns {string}
 */
export function normalizeSeparator(separator) {
  if (separator === null || separator === undefined) {
    return DEFAULT_SEPARATOR;
  }
  return String(separator);
}

export const VALID_SUBMIT_MODES = Object.freeze([
  'formula',
  'result',
  'formula-only',
  'result-only',
]);

/**
 * Normalizes the submit mode value ("formula", "result", "formula-only", or "result-only").
 * Defaults to "formula".
 *
 * @param {string|null|undefined} submit
 * @returns {'formula'|'result'|'formula-only'|'result-only'}
 */
export function normalizeSubmit(submit) {
  if (typeof submit === 'string') {
    const normalized = submit.trim().toLowerCase();
    if (VALID_SUBMIT_MODES.includes(normalized)) {
      return normalized;
    }
  }
  return DEFAULT_SUBMIT;
}

/**
 * Formats a numeric evaluation result into a clean string, stripping
 * IEEE-754 floating-point precision noise (e.g. 0.1 + 0.2 -> "0.3").
 *
 * @param {number} num
 * @returns {{ numericResult: number, result: string }}
 */
export function formatResult(num) {
  if (typeof num !== 'number' || !Number.isFinite(num)) {
    throw new Error('Formula did not evaluate to a finite number');
  }
  if (Object.is(num, -0) || num === 0) {
    return { numericResult: 0, result: '0' };
  }

  const cleaned = Number(num.toPrecision(12));
  const finalNum = Object.is(cleaned, -0) ? 0 : cleaned;
  return {
    numericResult: finalNum,
    result: String(finalNum),
  };
}

/**
 * Tokenizes a mathematical formula string into structured tokens.
 *
 * @param {string} formula
 * @returns {Array<{type: string, value: any, raw: string, start: number, end: number}>}
 */
export function tokenizeFormula(formula) {
  if (typeof formula !== 'string') {
    throw new SyntaxError('Formula must be a string');
  }

  const tokens = [];
  const len = formula.length;
  let i = 0;

  while (i < len) {
    const ch = formula[i];

    // Skip whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Numbers: integer, decimal (e.g. 3.14 or .5), and scientific notation (e.g. 1e5, 2.5e-3)
    if (/\d/.test(ch) || (ch === '.' && i + 1 < len && /\d/.test(formula[i + 1]))) {
      const start = i;
      let hasDot = false;

      if (formula[i] === '.') {
        hasDot = true;
        i++;
      }

      while (i < len && /\d/.test(formula[i])) {
        i++;
      }

      if (i < len && formula[i] === '.') {
        if (hasDot) {
          throw new SyntaxError(`Unexpected decimal point at position ${i}`);
        }
        hasDot = true;
        i++;
        while (i < len && /\d/.test(formula[i])) {
          i++;
        }
      }

      // Check for trailing extra dot like 1.2.3
      if (i < len && formula[i] === '.') {
        throw new SyntaxError(`Unexpected decimal point at position ${i}`);
      }

      // Optional scientific notation exponent (e.g. e10, E-3, e+2)
      if (i < len && (formula[i] === 'e' || formula[i] === 'E')) {
        i++;
        if (i < len && (formula[i] === '+' || formula[i] === '-')) {
          i++;
        }
        const expDigitsStart = i;
        while (i < len && /\d/.test(formula[i])) {
          i++;
        }
        if (i === expDigitsStart) {
          throw new SyntaxError(`Invalid scientific notation at position ${start}`);
        }
      }

      const raw = formula.slice(start, i);
      const numValue = Number(raw);
      if (!Number.isFinite(numValue)) {
        throw new SyntaxError(`Invalid number "${raw}" at position ${start}`);
      }

      tokens.push({
        type: 'number',
        value: numValue,
        raw,
        start,
        end: i,
      });
      continue;
    }

    // Power operator **
    if (ch === '*' && formula[i + 1] === '*') {
      tokens.push({
        type: 'operator',
        value: '^',
        raw: '**',
        start: i,
        end: i + 2,
      });
      i += 2;
      continue;
    }

    // Reject increment/decrement operators ++ and --
    if ((ch === '+' && formula[i + 1] === '+') || (ch === '-' && formula[i + 1] === '-')) {
      throw new SyntaxError(`Unexpected operator "${ch}${ch}" at position ${i}`);
    }

    // Single-character operators (including Unicode ×, ÷, −)
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '%' || ch === '^' || ch === '×' || ch === '÷' || ch === '−') {
      const normalizedOp = ch === '×' ? '*' : ch === '÷' ? '/' : ch === '−' ? '-' : ch;
      tokens.push({
        type: 'operator',
        value: normalizedOp,
        raw: ch,
        start: i,
        end: i + 1,
      });
      i++;
      continue;
    }

    // Parentheses
    if (ch === '(' || ch === ')') {
      tokens.push({
        type: 'paren',
        value: ch,
        raw: ch,
        start: i,
        end: i + 1,
      });
      i++;
      continue;
    }

    // Comma (for multi-argument functions like min(2, 5), pow(2, 3))
    if (ch === ',') {
      tokens.push({
        type: 'comma',
        value: ',',
        raw: ',',
        start: i,
        end: i + 1,
      });
      i++;
      continue;
    }

    // Identifiers (functions and constants)
    if (/[a-zA-Z_]/.test(ch)) {
      const start = i;
      while (i < len && /[a-zA-Z0-9_]/.test(formula[i])) {
        i++;
      }
      const raw = formula.slice(start, i);
      tokens.push({
        type: 'identifier',
        value: raw.toLowerCase(),
        raw,
        start,
        end: i,
      });
      continue;
    }

    throw new SyntaxError(`Unexpected character "${ch}" at position ${i}`);
  }

  return tokens;
}

/**
 * Parses an array of formula tokens into an Abstract Syntax Tree (AST).
 *
 * Grammar:
 *   Expression     := Additive
 *   Additive       := Multiplicative ( ('+' | '-') Multiplicative )*
 *   Multiplicative := Unary ( ('*' | '/' | '%') Unary )*
 *   Unary          := ('+' | '-') Unary | Power
 *   Power          := Primary ( '^' Unary )?
 *   Primary        := NUMBER | IDENTIFIER '(' Args ')' | IDENTIFIER | '(' Expression ')'
 *
 * @param {Array} tokens
 * @returns {object} AST root node
 */
export function parseFormulaToAST(tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    throw new SyntaxError('Empty formula');
  }

  let pos = 0;

  function peek() {
    return tokens[pos] || null;
  }

  function consume() {
    return tokens[pos++] || null;
  }

  function parseExpression() {
    return parseAdditive();
  }

  function parseAdditive() {
    let left = parseMultiplicative();

    while (peek()?.type === 'operator' && (peek().value === '+' || peek().value === '-')) {
      const opToken = consume();
      const right = parseMultiplicative();
      left = {
        type: 'BinaryExpression',
        operator: opToken.value,
        left,
        right,
      };
    }

    return left;
  }

  function parseMultiplicative() {
    let left = parseUnary(false);

    while (
      peek()?.type === 'operator' &&
      (peek().value === '*' || peek().value === '/' || peek().value === '%')
    ) {
      const opToken = consume();
      const right = parseUnary(false);
      left = {
        type: 'BinaryExpression',
        operator: opToken.value,
        left,
        right,
      };
    }

    return left;
  }

  function parseUnary(alreadyInUnary = false) {
    const current = peek();
    if (current?.type === 'operator' && (current.value === '+' || current.value === '-')) {
      if (alreadyInUnary) {
        throw new SyntaxError(`Unexpected consecutive unary operator "${current.raw}" at position ${current.start}`);
      }
      const opToken = consume();
      const argument = parseUnary(true);
      return {
        type: 'UnaryExpression',
        operator: opToken.value,
        argument,
      };
    }

    return parsePower();
  }

  function parsePower() {
    const base = parsePrimary();

    if (peek()?.type === 'operator' && peek().value === '^') {
      consume(); // '^' or '**'
      // Right-associative and allows unary sign in exponent (e.g. 2 ^ -3 or 2 ^ 3 ^ 2)
      const exponent = parseUnary(false);
      return {
        type: 'BinaryExpression',
        operator: '^',
        left: base,
        right: exponent,
      };
    }

    return base;
  }

  function parsePrimary() {
    const token = peek();

    if (!token) {
      throw new SyntaxError('Unexpected end of formula');
    }

    if (token.type === 'number') {
      consume();
      return {
        type: 'NumberLiteral',
        value: token.value,
        raw: token.raw,
      };
    }

    if (token.type === 'identifier') {
      consume();
      const name = token.value;

      // Function call: identifier followed by '('
      if (peek()?.type === 'paren' && peek().value === '(') {
        if (!Object.prototype.hasOwnProperty.call(MATH_FUNCTIONS, name)) {
          throw new SyntaxError(`Unknown function "${token.raw}" at position ${token.start}`);
        }
        consume(); // '('

        if (peek()?.type === 'paren' && peek().value === ')') {
          throw new SyntaxError(`Function "${token.raw}" requires at least 1 argument`);
        }

        const args = [parseExpression()];
        while (peek()?.type === 'comma') {
          consume(); // ','
          args.push(parseExpression());
        }

        const closing = peek();
        if (!closing || closing.type !== 'paren' || closing.value !== ')') {
          throw new SyntaxError(`Missing closing parenthesis for function "${token.raw}"`);
        }
        consume(); // ')'

        const fnSpec = MATH_FUNCTIONS[name];
        if (args.length < fnSpec.minArgs || args.length > fnSpec.maxArgs) {
          throw new SyntaxError(`Invalid number of arguments for function "${token.raw}"`);
        }

        return {
          type: 'CallExpression',
          callee: name,
          arguments: args,
        };
      }

      // Constant identifier (e.g. PI, E)
      if (!Object.prototype.hasOwnProperty.call(MATH_CONSTANTS, name)) {
        throw new SyntaxError(`Unknown identifier "${token.raw}" at position ${token.start}`);
      }

      return {
        type: 'ConstantLiteral',
        name,
        value: MATH_CONSTANTS[name],
      };
    }

    if (token.type === 'paren' && token.value === '(') {
      consume(); // '('
      if (peek()?.type === 'paren' && peek().value === ')') {
        throw new SyntaxError(`Empty parentheses at position ${token.start}`);
      }
      const expr = parseExpression();
      const closing = peek();
      if (!closing || closing.type !== 'paren' || closing.value !== ')') {
        throw new SyntaxError(`Unclosed parenthesis starting at position ${token.start}`);
      }
      consume(); // ')'
      return expr;
    }

    throw new SyntaxError(`Unexpected token "${token.raw}" at position ${token.start}`);
  }

  const ast = parseExpression();

  if (pos < tokens.length) {
    const leftover = tokens[pos];
    throw new SyntaxError(`Unexpected token "${leftover.raw}" at position ${leftover.start}`);
  }

  return ast;
}

/**
 * Evaluates a parsed formula AST node to a numeric result.
 *
 * @param {object} node
 * @returns {number}
 */
export function evaluateAST(node) {
  if (!node || typeof node !== 'object') {
    throw new Error('Invalid AST node');
  }

  switch (node.type) {
    case 'NumberLiteral':
    case 'ConstantLiteral':
      return node.value;

    case 'UnaryExpression': {
      const val = evaluateAST(node.argument);
      return node.operator === '-' ? -val : +val;
    }

    case 'BinaryExpression': {
      const left = evaluateAST(node.left);
      const right = evaluateAST(node.right);
      let out;

      switch (node.operator) {
        case '+':
          out = left + right;
          break;
        case '-':
          out = left - right;
          break;
        case '*':
          out = left * right;
          break;
        case '/':
          if (right === 0) {
            throw new Error('Division by zero');
          }
          out = left / right;
          break;
        case '%':
          if (right === 0) {
            throw new Error('Division by zero');
          }
          out = left % right;
          break;
        case '^':
          out = left ** right;
          break;
        default:
          throw new Error(`Unsupported operator "${node.operator}"`);
      }

      if (!Number.isFinite(out)) {
        throw new Error('Formula result is not finite');
      }
      return out;
    }

    case 'CallExpression': {
      const fnSpec = MATH_FUNCTIONS[node.callee];
      if (!fnSpec) {
        throw new Error(`Unknown function "${node.callee}"`);
      }
      const evaluatedArgs = node.arguments.map((arg) => evaluateAST(arg));
      const out = fnSpec.fn(...evaluatedArgs);
      if (!Number.isFinite(out)) {
        throw new Error(`Function "${node.callee}" returned a non-finite value`);
      }
      return out;
    }

    default:
      throw new Error(`Unknown AST node type "${node.type}"`);
  }
}

/**
 * Parses and evaluates a formula string safely.
 *
 * @param {string|null|undefined} rawFormula
 * @returns {{
 *   formula: string,
 *   result: string,
 *   numericResult: number|null,
 *   isValid: boolean,
 *   isEmpty: boolean,
 *   error: string|null,
 *   tokens: Array,
 *   ast: object|null
 * }}
 */
export function evaluateFormula(rawFormula) {
  const formula = rawFormula === null || rawFormula === undefined ? '' : String(rawFormula);

  if (formula.trim() === '') {
    return {
      formula,
      result: '',
      numericResult: null,
      isValid: true,
      isEmpty: true,
      error: null,
      tokens: [],
      ast: null,
    };
  }

  let tokens = [];
  try {
    tokens = tokenizeFormula(formula);
    const ast = parseFormulaToAST(tokens);
    const rawNumber = evaluateAST(ast);
    const { numericResult, result } = formatResult(rawNumber);

    return {
      formula,
      result,
      numericResult,
      isValid: true,
      isEmpty: false,
      error: null,
      tokens,
      ast,
    };
  } catch (err) {
    return {
      formula,
      result: '',
      numericResult: null,
      isValid: false,
      isEmpty: false,
      error: err instanceof Error ? err.message : String(err),
      tokens,
      ast: null,
    };
  }
}
