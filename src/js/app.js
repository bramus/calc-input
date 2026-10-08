/**
 * <formula-input> Demo Application Controller
 */

import './formula-input/index.js';

export class FormulaInputDemoApp {
  constructor() {
    this.demoFormula = document.getElementById('demo-formula');
    this.playground = document.getElementById('playground-input');
    this.playgroundFocusBadge = document.getElementById('playground-focus-badge');
    this.playgroundInputsGrid = document.getElementById('playground-inputs-grid');
    this.tokensContainer = document.getElementById('playground-tokens');
    this.jsonOutput = document.getElementById('playground-json');
    this.demoForm = document.getElementById('demo-form');
    this.formResult = document.getElementById('form-result');
    this.btnSetInvalidForm = document.getElementById('btn-set-invalid-form');
    this.separatorDemoInput = document.getElementById('separator-demo-input');
    this.separatorInputsGrid = document.getElementById('separator-inputs-grid');

    this.init();
  }

  init() {
    this._setupPresets();
    this._setupPlayground();
    this._setupFormDemo();
    this._setupSeparatorDemo();
    this._setupMicroLighterCopyButtons();
    this._setupScrollspy();
  }

  _setupPresets() {
    const buttons = document.querySelectorAll('[data-preset]');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const formula = btn.getAttribute('data-preset') ?? '';
        const target =
          btn.closest('.card')?.querySelector('formula-input') ||
          this.demoFormula ||
          this.playground;
        if (target) {
          target.formula = formula;
          target.blur();
          if (this.playground && target === this.demoFormula) {
            this.playground.formula = formula;
            this.playground.blur();
            this._renderPlayground();
          }
        }
      });
    });
  }

  _createInputStateCard(inputEl, roleLabel) {
    const card = document.createElement('div');
    const isVisible = !inputEl.hidden;
    const isInvalid = !inputEl.validity.valid;
    card.className = `input-state-card${isVisible ? ' is-visible' : ''}${isInvalid ? ' is-invalid' : ''}`;

    const header = document.createElement('div');
    header.className = 'input-state-header';

    const title = document.createElement('span');
    title.textContent = roleLabel;

    const pill = document.createElement('span');
    pill.className = `visibility-pill ${isVisible ? 'visible' : 'hidden'}`;
    pill.textContent = isVisible ? 'VISIBLE' : 'hidden';

    header.append(title, pill);

    const nameRow = document.createElement('div');
    nameRow.style.fontSize = '0.8rem';
    const nameCode = document.createElement('code');
    if (inputEl.hasAttribute('name')) {
      nameCode.textContent = `name="${inputEl.getAttribute('name')}"`;
    } else {
      nameCode.textContent = 'no name (not submitted)';
    }
    nameRow.appendChild(nameCode);

    const valRow = document.createElement('div');
    valRow.style.fontSize = '0.8rem';
    const valStrong = document.createElement('strong');
    valStrong.textContent = '.value: ';
    const valCode = document.createElement('code');
    valCode.textContent = JSON.stringify(inputEl.value);
    valRow.append(valStrong, valCode);

    const attrRow = document.createElement('div');
    attrRow.style.fontSize = '0.75rem';
    attrRow.style.color = 'var(--text-muted)';
    attrRow.textContent = `getAttribute('value'): ${JSON.stringify(inputEl.getAttribute('value'))}`;

    card.append(header, nameRow, valRow, attrRow);
    return card;
  }

  _renderInputsGrid(container, formulaInputEl) {
    if (!container || !formulaInputEl) return;
    const inputs = formulaInputEl.querySelectorAll('input');
    if (inputs.length < 3) return;

    container.replaceChildren(
      this._createInputStateCard(inputs[0], '1. Primary Input'),
      this._createInputStateCard(inputs[1], '2. Formula Input'),
      this._createInputStateCard(inputs[2], '3. Result Input')
    );
  }

  _setupPlayground() {
    if (!this.playground) return;

    const update = () => this._renderPlayground();

    this.playground.addEventListener('input', update);
    this.playground.addEventListener('focusin', update);
    this.playground.addEventListener('focusout', () => {
      queueMicrotask(update);
    });
    this.playground.addEventListener('keyup', update);
    this.playground.addEventListener('click', update);

    update();
  }

  _renderPlayground() {
    if (!this.playground) return;

    const evaluation = this.playground.getEvaluation();
    const isFocused = !this.playground.formulaInput.hidden && document.activeElement === this.playground.formulaInput;

    if (this.playgroundFocusBadge) {
      if (!evaluation.isValid) {
        this.playgroundFocusBadge.textContent = 'State: Invalid Formula (Keeping Formula Visible)';
      } else if (isFocused) {
        this.playgroundFocusBadge.textContent = 'State: Focused (Showing Formula Input)';
      } else {
        this.playgroundFocusBadge.textContent = 'State: Blurred (Showing Result Input)';
      }
    }

    this._renderInputsGrid(this.playgroundInputsGrid, this.playground);

    if (this.tokensContainer) {
      this.tokensContainer.replaceChildren();

      const domAttrInfo = document.createElement('div');
      domAttrInfo.style.marginBottom = '0.75rem';
      domAttrInfo.style.paddingBottom = '0.5rem';
      domAttrInfo.style.borderBottom = '1px solid var(--border-color)';
      domAttrInfo.textContent = `Host getAttribute('value'): ${JSON.stringify(this.playground.getAttribute('value'))} (never overwritten on edit)`;
      this.tokensContainer.appendChild(domAttrInfo);

      if (!evaluation.tokens || evaluation.tokens.length === 0) {
        const emptySpan = document.createElement('span');
        emptySpan.style.color = '#94a3b8';
        emptySpan.style.fontStyle = 'italic';
        emptySpan.textContent = 'No tokens. Enter a formula above!';
        this.tokensContainer.appendChild(emptySpan);
      } else {
        evaluation.tokens.forEach((t) => {
          const span = document.createElement('span');
          span.className = `token-pill pill-${t.type}`;
          span.textContent = `${t.type}: ${t.raw}`;
          this.tokensContainer.appendChild(span);
        });
      }
    }

    if (this.jsonOutput) {
      this.jsonOutput.textContent = JSON.stringify(evaluation, null, 2);
    }
  }

  _setupFormDemo() {
    if (!this.demoForm || !this.formResult) return;

    if (this.btnSetInvalidForm) {
      this.btnSetInvalidForm.addEventListener('click', () => {
        const widthEl = document.getElementById('form-width');
        if (widthEl) {
          widthEl.formula = '2 + ';
          widthEl.blur();
        }
      });
    }

    this.demoForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(this.demoForm);
      const entries = Object.fromEntries(formData.entries());

      this.formResult.hidden = false;
      this.formResult.replaceChildren();

      const header = document.createElement('div');
      header.style.fontWeight = '600';
      header.style.marginBottom = '0.5rem';
      header.textContent = 'Form Submitted Successfully (FormData Entries):';

      const pre = document.createElement('pre');
      pre.style.margin = '0.25rem 0 0';
      pre.textContent = JSON.stringify(entries, null, 2);

      this.formResult.append(header, pre);
    });

    this.demoForm.addEventListener('reset', () => {
      this.formResult.hidden = true;
    });
  }

  _setupSeparatorDemo() {
    if (!this.separatorDemoInput) return;

    const sepChips = document.querySelectorAll('#separator-chips [data-sep]');
    const submitChips = document.querySelectorAll('#submit-chips [data-submit]');

    const renderGrid = () => {
      this._renderInputsGrid(this.separatorInputsGrid, this.separatorDemoInput);
    };

    sepChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const sep = chip.getAttribute('data-sep') ?? '--';
        this.separatorDemoInput.setAttribute('separator', sep);
        sepChips.forEach((c) => c.classList.toggle('is-active', c === chip));
        renderGrid();
      });
    });

    submitChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const submitMode = chip.getAttribute('data-submit') ?? 'formula';
        this.separatorDemoInput.setAttribute('submit', submitMode);
        submitChips.forEach((c) => c.classList.toggle('is-active', c === chip));
        renderGrid();
      });
    });

    this.separatorDemoInput.addEventListener('input', renderGrid);
    this.separatorDemoInput.addEventListener('focusin', renderGrid);
    this.separatorDemoInput.addEventListener('focusout', () => queueMicrotask(renderGrid));

    renderGrid();
  }

  _createCopyIconSvg(isCopied = false) {
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '15');
    svg.setAttribute('height', '15');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.display = 'block';
    svg.style.margin = 'auto';

    if (isCopied) {
      svg.style.color = '#16a34a';
      const polyline = document.createElementNS(svgNs, 'polyline');
      polyline.setAttribute('points', '20 6 9 17 4 12');
      svg.appendChild(polyline);
    } else {
      const rect = document.createElementNS(svgNs, 'rect');
      rect.setAttribute('x', '9');
      rect.setAttribute('y', '9');
      rect.setAttribute('width', '13');
      rect.setAttribute('height', '13');
      rect.setAttribute('rx', '2');
      rect.setAttribute('ry', '2');
      const path = document.createElementNS(svgNs, 'path');
      path.setAttribute('d', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1');
      svg.append(rect, path);
    }

    return svg;
  }

  _setupMicroLighterCopyButtons() {
    if (typeof customElements === 'undefined') return;

    const enhanceAll = () => {
      document.querySelectorAll('micro-lighter').forEach((lighter) => {
        const button = lighter.shadowRoot?.querySelector('button[part="copy-button"]');
        if (!button || button.dataset.iconEnhanced === 'true') return;
        button.dataset.iconEnhanced = 'true';

        let currentLabel = 'Copy code';
        const renderIcon = (label) => {
          currentLabel = String(label || 'Copy');
          const isCopied = currentLabel.toLowerCase().includes('copied');
          button.setAttribute('aria-label', isCopied ? 'Copied' : 'Copy code');
          button.setAttribute('title', isCopied ? 'Copied' : 'Copy code');
          button.replaceChildren(this._createCopyIconSvg(isCopied));
        };

        Object.defineProperty(button, 'textContent', {
          configurable: true,
          get() {
            return currentLabel;
          },
          set(value) {
            renderIcon(value);
          },
        });

        renderIcon('Copy');
      });
    };

    if (customElements.get('micro-lighter')) {
      enhanceAll();
    } else {
      customElements.whenDefined('micro-lighter').then(enhanceAll);
    }
  }

  _setupScrollspy() {
    const navLinks = document.querySelectorAll('.sidenav-list a');
    const sections = Array.from(navLinks)
      .map((link) => {
        const id = link.getAttribute('href').replace('#', '');
        return document.getElementById(id);
      })
      .filter(Boolean);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            navLinks.forEach((link) => {
              if (link.getAttribute('href') === `#${id}`) {
                link.classList.add('is-active');
              } else {
                link.classList.remove('is-active');
              }
            });
          }
        });
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );

    sections.forEach((sec) => observer.observe(sec));
  }
}

// Auto-instantiate on DOM load
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new FormulaInputDemoApp());
  } else {
    new FormulaInputDemoApp();
  }
}
