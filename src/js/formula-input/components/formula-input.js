/**
 * <formula-input> Custom Element
 * An input field that accepts mathematical formulas, shows the evaluated result on blur,
 * and shows the formula on focus while maintaining three underlying <input type="text">
 * elements for seamless form submission.
 */

import {
  DEFAULT_SEPARATOR,
  DEFAULT_SUBMIT,
  normalizeSeparator,
  normalizeSubmit,
  evaluateFormula,
} from '../utils/formula-parser.js';

const STYLE_ID = 'formula-input-default-styles';

const DEFAULT_CSS = `
  formula-input {
    display: contents;
    font-family: inherit;
    font-size: 0.95rem;
    line-height: 1.5;
    padding: 0.625rem 0.75rem;
    color: #111827;
    background-color: #ffffff;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    width: 100%;
    box-sizing: border-box;
    outline: none;
  }

  formula-input[hidden],
  formula-input input[hidden] {
    display: none !important;
  }

  formula-input:focus-within {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
  }

  formula-input[disabled] {
    background-color: #f3f4f6;
    border-color: #e5e7eb;
    opacity: 0.7;
    cursor: not-allowed;
  }

  formula-input:has(input:invalid),
  formula-input[data-invalid],
  formula-input input:invalid {
    border-color: #ef4444;
    background-color: #fef2f2;
  }

  formula-input:has(input:invalid):focus-within,
  formula-input[data-invalid]:focus-within,
  formula-input input:invalid:focus {
    border-color: #ef4444;
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2);
  }

  formula-input input {
    display: block;
    width: inherit;
    min-width: 0;
    font: inherit;
    letter-spacing: inherit;
    text-align: inherit;
    padding: inherit;
    margin: inherit;
    color: inherit;
    background: inherit;
    border: inherit;
    border-radius: inherit;
    box-shadow: inherit;
    opacity: inherit;
    cursor: inherit;
    box-sizing: inherit;
    outline: inherit;
    outline-offset: inherit;
    transition: box-shadow 0.15s ease;
  }

  formula-input input::placeholder {
    color: #9ca3af;
  }
`;

function ensureDefaultStyles(rootNode) {
  if (typeof document === 'undefined') return;
  const target =
    rootNode instanceof ShadowRoot ? rootNode : document.head || document.documentElement;
  if (!target) return;
  if (!target.querySelector(`#${STYLE_ID}`)) {
    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = DEFAULT_CSS;
    target.appendChild(styleEl);
  }
}

export class FormulaInput extends HTMLElement {
  static _globalSeparator = DEFAULT_SEPARATOR;
  static _globalSubmit = DEFAULT_SUBMIT;

  /**
   * Global default separator inherited by <formula-input> instances without a `separator` attribute.
   */
  static get separator() {
    return FormulaInput._globalSeparator;
  }

  static set separator(val) {
    FormulaInput._globalSeparator = normalizeSeparator(val);
  }

  static get defaultSeparator() {
    return FormulaInput.separator;
  }

  static set defaultSeparator(val) {
    FormulaInput.separator = val;
  }

  /**
   * Global default submit mode ("formula" or "result") inherited by <formula-input> instances
   * without a `submit` attribute.
   */
  static get submit() {
    return FormulaInput._globalSubmit;
  }

  static set submit(val) {
    FormulaInput._globalSubmit = normalizeSubmit(val);
  }

  static get defaultSubmit() {
    return FormulaInput.submit;
  }

  static set defaultSubmit(val) {
    FormulaInput.submit = val;
  }

  static get observedAttributes() {
    return [
      'name',
      'separator',
      'submit',
      'value',
      'placeholder',
      'disabled',
      'readonly',
      'required',
      'autofocus',
      'aria-label',
      'aria-labelledby',
    ];
  }

  constructor() {
    super();

    this._mainInput = document.createElement('input');
    this._mainInput.setAttribute('type', 'text');
    this._mainInput.hidden = true;
    this._mainInput.tabIndex = -1;

    this._formulaInput = document.createElement('input');
    this._formulaInput.setAttribute('type', 'text');

    this._resultInput = document.createElement('input');
    this._resultInput.setAttribute('type', 'text');

    // Wrap _formulaInput.focus and _resultInput.focus so calling .focus() directly
    // on either inner input (even when hidden) reveals and focuses _formulaInput.
    const nativeFormulaFocus = this._formulaInput.focus.bind(this._formulaInput);
    const nativeResultFocus = this._resultInput.focus.bind(this._resultInput);
    this._nativeFormulaFocus = nativeFormulaFocus;
    this._nativeResultFocus = nativeResultFocus;

    this._formulaInput.focus = (options) => {
      this._focusFormulaInput(options, false);
    };

    this._resultInput.focus = (options) => {
      this._focusFormulaInput(options, false);
    };

    this._formula = '';
    this._result = '';
    this._isValid = true;
    this._evaluation = evaluateFormula('');
    this._isFocused = false;
    this._isHandlingBlur = false;
    this._isTransferringFocus = false;
    this._initialized = false;
    this._boundForm = null;

    this._onFormulaInput = this._onFormulaInput.bind(this);
    this._onFormulaChange = this._onFormulaChange.bind(this);
    this._onFormulaFocus = this._onFormulaFocus.bind(this);
    this._onFormulaBlur = this._onFormulaBlur.bind(this);
    this._onResultMouseDown = this._onResultMouseDown.bind(this);
    this._onResultFocus = this._onResultFocus.bind(this);
    this._onResultBlur = this._onResultBlur.bind(this);
    this._onHostFocus = this._onHostFocus.bind(this);
    this._onHostBlur = this._onHostBlur.bind(this);
    this._onFormReset = this._onFormReset.bind(this);
  }

  connectedCallback() {
    ensureDefaultStyles(this.getRootNode());

    if (!this.contains(this._mainInput)) {
      this.append(this._mainInput, this._formulaInput, this._resultInput);
    }

    this._formulaInput.addEventListener('input', this._onFormulaInput);
    this._formulaInput.addEventListener('change', this._onFormulaChange);
    this._formulaInput.addEventListener('focus', this._onFormulaFocus);
    this._formulaInput.addEventListener('blur', this._onFormulaBlur);

    this._resultInput.addEventListener('mousedown', this._onResultMouseDown);
    this._resultInput.addEventListener('focus', this._onResultFocus);
    this._resultInput.addEventListener('blur', this._onResultBlur);

    this.addEventListener('focus', this._onHostFocus);
    this.addEventListener('blur', this._onHostBlur);

    this._attachFormResetListener();

    this._syncNames();
    this._syncControlAttributes();

    if (!this._initialized) {
      this._initialized = true;
      if (this.hasAttribute('value') && this._formula === '') {
        this._formula = this.getAttribute('value') ?? '';
      }
    }

    this._evaluateAndSync();

    // Determine initial focus state
    const activeEl = document.activeElement;
    this._isFocused = Boolean(
      activeEl === this ||
      activeEl === this._formulaInput ||
      activeEl === this._resultInput
    );

    if (this.hasAttribute('autofocus') && !this.disabled) {
      this._focusFormulaInput(undefined, true);
    } else if (this._isFocused) {
      this._focusFormulaInput(undefined, false);
    } else {
      this._updateVisibilityForBlurredState();
    }
  }

  disconnectedCallback() {
    this._formulaInput.removeEventListener('input', this._onFormulaInput);
    this._formulaInput.removeEventListener('change', this._onFormulaChange);
    this._formulaInput.removeEventListener('focus', this._onFormulaFocus);
    this._formulaInput.removeEventListener('blur', this._onFormulaBlur);

    this._resultInput.removeEventListener('mousedown', this._onResultMouseDown);
    this._resultInput.removeEventListener('focus', this._onResultFocus);
    this._resultInput.removeEventListener('blur', this._onResultBlur);

    this.removeEventListener('focus', this._onHostFocus);
    this.removeEventListener('blur', this._onHostBlur);

    this._detachFormResetListener();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    switch (name) {
      case 'name':
      case 'separator':
        this._syncNames();
        break;

      case 'submit':
        this._syncNames();
        this._syncMainInputValue();
        break;

      case 'value':
        this._formula = newValue ?? '';
        this._evaluateAndSync();
        if (!this._isFocused) {
          this._updateVisibilityForBlurredState();
        }
        break;

      case 'placeholder':
      case 'disabled':
      case 'readonly':
      case 'required':
      case 'aria-label':
      case 'aria-labelledby':
        this._syncControlAttributes();
        break;

      default:
        break;
    }
  }

  /**
   * Name attribute getter/setter.
   */
  get name() {
    return this.getAttribute('name') ?? '';
  }

  set name(val) {
    if (val === null || val === undefined) {
      this.removeAttribute('name');
    } else {
      this.setAttribute('name', String(val));
    }
  }

  /**
   * Separator getter/setter. Defaults to "--" when attribute is not present.
   * Accepts an empty string "".
   */
  get separator() {
    if (this.hasAttribute('separator')) {
      return this.getAttribute('separator') ?? '';
    }
    return FormulaInput.separator;
  }

  set separator(val) {
    if (val === null || val === undefined) {
      this.removeAttribute('separator');
    } else {
      this.setAttribute('separator', String(val));
    }
  }

  /**
   * Submit mode getter/setter ("formula", "result", "formula-only", or "result-only"). Defaults to "formula".
   */
  get submit() {
    if (this.hasAttribute('submit')) {
      return normalizeSubmit(this.getAttribute('submit'));
    }
    return FormulaInput.submit;
  }

  set submit(val) {
    if (val === null || val === undefined) {
      this.removeAttribute('submit');
    } else {
      this.setAttribute('submit', normalizeSubmit(val));
    }
  }

  /**
   * Gets or sets the component value.
   * Getting `value` returns the value of the primary `<input name="...">` (configured via `submit`).
   * Setting `value` updates the formula and re-evaluates without writing back to the DOM `value` attribute.
   */
  get value() {
    return this._mainInput.value;
  }

  set value(val) {
    this.formula = val;
  }

  /**
   * Gets or sets the raw formula string without writing back to the DOM `value` attribute.
   */
  get formula() {
    return this._formulaInput.value;
  }

  set formula(val) {
    this._formula = val === null || val === undefined ? '' : String(val);
    this._evaluateAndSync();
    if (!this._isFocused) {
      this._updateVisibilityForBlurredState();
    }
  }

  /**
   * Gets the evaluated result string (e.g. "5" for "2 + 3", or "" if empty/invalid).
   */
  get result() {
    return this._resultInput.value;
  }

  /**
   * Returns true if the current formula is valid (or empty).
   */
  get isValid() {
    return this._isValid;
  }

  /**
   * Underlying `<input>` element references.
   */
  get mainInput() {
    return this._mainInput;
  }

  get formulaInput() {
    return this._formulaInput;
  }

  get resultInput() {
    return this._resultInput;
  }

  get placeholder() {
    return this.getAttribute('placeholder') ?? '';
  }

  set placeholder(val) {
    if (val === null || val === undefined) {
      this.removeAttribute('placeholder');
    } else {
      this.setAttribute('placeholder', String(val));
    }
  }

  get disabled() {
    return this.hasAttribute('disabled');
  }

  set disabled(val) {
    this.toggleAttribute('disabled', Boolean(val));
  }

  get readOnly() {
    return this.hasAttribute('readonly');
  }

  set readOnly(val) {
    this.toggleAttribute('readonly', Boolean(val));
  }

  get required() {
    return this.hasAttribute('required');
  }

  set required(val) {
    this.toggleAttribute('required', Boolean(val));
  }

  get validity() {
    return this._formulaInput.validity;
  }

  get validationMessage() {
    return this._formulaInput.validationMessage;
  }

  checkValidity() {
    this._syncFromFormulaInput();
    return this._formulaInput.checkValidity();
  }

  reportValidity() {
    this._syncFromFormulaInput();
    if (!this._isValid) {
      this._showFormulaInput();
    }
    return this._formulaInput.reportValidity();
  }

  setCustomValidity(message) {
    this._formulaInput.setCustomValidity(message);
  }

  /**
   * Returns the structured evaluation result for the current formula.
   */
  getEvaluation() {
    return this._evaluation;
  }

  focus(options) {
    this._focusFormulaInput(options, true);
  }

  blur() {
    this._formulaInput.blur();
    this._resultInput.blur();
    this._handleBlurTransition();
  }

  select() {
    if (this.disabled) return;
    this._focusFormulaInput(undefined, false);
    this._formulaInput.select();
  }

  _attachFormResetListener() {
    this._detachFormResetListener();
    const form = this.closest('form');
    if (form) {
      this._boundForm = form;
      form.addEventListener('reset', this._onFormReset);
    }
  }

  _detachFormResetListener() {
    if (this._boundForm) {
      this._boundForm.removeEventListener('reset', this._onFormReset);
      this._boundForm = null;
    }
  }

  _onFormReset() {
    // Wait a microtask so native input reset completes first, then restore initial attribute value
    queueMicrotask(() => {
      this._formula = this.getAttribute('value') ?? '';
      this._evaluateAndSync();
      if (!this._isFocused) {
        this._updateVisibilityForBlurredState();
      }
    });
  }

  _syncNames() {
    const baseName = this.getAttribute('name');
    const sep = this.separator;
    const submitMode = this.submit;
    const isOnlyMode = submitMode === 'formula-only' || submitMode === 'result-only';

    if (baseName !== null && baseName !== '') {
      this._mainInput.setAttribute('name', baseName);
      if (isOnlyMode) {
        this._formulaInput.removeAttribute('name');
        this._resultInput.removeAttribute('name');
      } else {
        this._formulaInput.setAttribute('name', `${baseName}${sep}formula`);
        this._resultInput.setAttribute('name', `${baseName}${sep}result`);
      }
    } else if (baseName === '') {
      this._mainInput.setAttribute('name', '');
      if (isOnlyMode) {
        this._formulaInput.removeAttribute('name');
        this._resultInput.removeAttribute('name');
      } else {
        this._formulaInput.setAttribute('name', `${sep}formula`);
        this._resultInput.setAttribute('name', `${sep}result`);
      }
    } else {
      this._mainInput.removeAttribute('name');
      this._formulaInput.removeAttribute('name');
      this._resultInput.removeAttribute('name');
    }
  }

  _syncControlAttributes() {
    const placeholder = this.getAttribute('placeholder') ?? '';
    const isDisabled = this.hasAttribute('disabled');
    const isReadOnly = this.hasAttribute('readonly');
    const isRequired = this.hasAttribute('required');
    const ariaLabel = this.getAttribute('aria-label');
    const ariaLabelledBy = this.getAttribute('aria-labelledby');

    if (placeholder) {
      this._formulaInput.setAttribute('placeholder', placeholder);
      this._resultInput.setAttribute('placeholder', placeholder);
    } else {
      this._formulaInput.removeAttribute('placeholder');
      this._resultInput.removeAttribute('placeholder');
    }

    this._mainInput.disabled = isDisabled;
    this._formulaInput.disabled = isDisabled;
    this._resultInput.disabled = isDisabled;

    this._formulaInput.readOnly = isReadOnly;
    this._resultInput.readOnly = isReadOnly;

    this._syncRequiredState();

    if (ariaLabel !== null) {
      this._formulaInput.setAttribute('aria-label', ariaLabel);
      this._resultInput.setAttribute('aria-label', ariaLabel);
    } else {
      this._formulaInput.removeAttribute('aria-label');
      this._resultInput.removeAttribute('aria-label');
    }

    if (ariaLabelledBy !== null) {
      this._formulaInput.setAttribute('aria-labelledby', ariaLabelledBy);
      this._resultInput.setAttribute('aria-labelledby', ariaLabelledBy);
    } else {
      this._formulaInput.removeAttribute('aria-labelledby');
      this._resultInput.removeAttribute('aria-labelledby');
    }
  }

  _syncRequiredState() {
    const isRequired = this.hasAttribute('required');
    this._mainInput.required = false;
    this._formulaInput.required = isRequired && !this._formulaInput.hidden;
    this._resultInput.required = isRequired && !this._resultInput.hidden;
  }

  _syncFromFormulaInput() {
    if (this._formulaInput.value !== this._formula) {
      this._formula = this._formulaInput.value;
      this._evaluateAndSync();
    }
  }

  _evaluateAndSync() {
    const evaluation = evaluateFormula(this._formula);
    this._evaluation = evaluation;
    this._isValid = evaluation.isValid;
    this._result = evaluation.result;

    // Set DOM properties (.value) without mutating DOM `value` attributes
    if (this._formulaInput.value !== this._formula) {
      this._formulaInput.value = this._formula;
    }
    this._resultInput.value = this._result;
    this._syncMainInputValue();

    // Update validity on _formulaInput to prevent form submission when invalid
    if (!this._isValid) {
      this._formulaInput.setCustomValidity(evaluation.error || 'Invalid formula');
      this._formulaInput.setAttribute('aria-invalid', 'true');
      this.setAttribute('data-invalid', '');
    } else {
      this._formulaInput.setCustomValidity('');
      this._formulaInput.removeAttribute('aria-invalid');
      this.removeAttribute('data-invalid');
    }

    // Ensure hidden inputs never block form submission with unfocusable validity errors
    this._mainInput.setCustomValidity('');
    this._resultInput.setCustomValidity('');
  }

  _syncMainInputValue() {
    const submitMode = this.submit;
    const useResult = submitMode === 'result' || submitMode === 'result-only';
    this._mainInput.value = useResult ? this._result : this._formula;
  }

  _showFormulaInput() {
    this._isFocused = true;
    this._mainInput.hidden = true;
    this._formulaInput.hidden = false;
    this._resultInput.hidden = true;
    this._syncRequiredState();
  }

  _focusFormulaInput(options, moveCaretToEnd = false) {
    if (this.disabled) return;
    this._isTransferringFocus = true;
    try {
      this._isFocused = true;
      this._mainInput.hidden = true;
      this._formulaInput.hidden = false;
      this._nativeFormulaFocus(options);
      this._resultInput.hidden = true;
      this._syncRequiredState();
      if (moveCaretToEnd) {
        const len = this._formulaInput.value.length;
        try {
          this._formulaInput.setSelectionRange(len, len);
        } catch (err) {}
      }
    } finally {
      this._isTransferringFocus = false;
    }
  }

  _updateVisibilityForBlurredState() {
    this._mainInput.hidden = true;
    if (this._isValid) {
      this._formulaInput.hidden = true;
      this._resultInput.hidden = false;
    } else {
      // When unparsable/invalid, keep showing the original formula input when blurred
      this._formulaInput.hidden = false;
      this._resultInput.hidden = true;
    }
    this._syncRequiredState();
  }

  _onFormulaInput() {
    this._formula = this._formulaInput.value;
    this._evaluateAndSync();
  }

  _onFormulaChange() {
    this._formula = this._formulaInput.value;
    this._evaluateAndSync();
  }

  _onFormulaFocus() {
    this._showFormulaInput();
  }

  _onFormulaBlur() {
    this._handleBlurTransition();
  }

  _onResultMouseDown(e) {
    if (this.disabled) return;
    e.preventDefault();
    this._focusFormulaInput(undefined, true);
  }

  _onResultFocus() {
    if (this.disabled) return;
    this._focusFormulaInput(undefined, true);
  }

  _onResultBlur(e) {
    // Ignore blur caused by immediate focus handoff to _formulaInput
    if (
      this._isTransferringFocus ||
      e?.relatedTarget === this._formulaInput ||
      document.activeElement === this._formulaInput
    ) {
      return;
    }
    this._handleBlurTransition();
  }

  _onHostFocus(e) {
    if (e.target === this && !this.disabled) {
      this._focusFormulaInput(undefined, true);
    }
  }

  _onHostBlur(e) {
    if (e.target === this) {
      this._handleBlurTransition();
    }
  }

  _handleBlurTransition() {
    if (this._isHandlingBlur) return;
    this._isHandlingBlur = true;
    try {
      this._isFocused = false;
      this._formula = this._formulaInput.value;
      this._evaluateAndSync();
      this._updateVisibilityForBlurredState();
    } finally {
      this._isHandlingBlur = false;
    }
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('formula-input')) {
  customElements.define('formula-input', FormulaInput);
}

export default FormulaInput;
