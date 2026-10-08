import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, '../../src');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function startStaticServer(rootDir) {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      try {
        const reqUrl = new URL(req.url, 'http://127.0.0.1');
        let pathname = decodeURIComponent(reqUrl.pathname);
        if (pathname === '/') pathname = '/index.html';

        const resolvedRoot = path.resolve(rootDir);
        const filePath = path.resolve(resolvedRoot, '.' + pathname);
        // Prevent directory traversal outside rootDir
        if (!filePath.startsWith(resolvedRoot + path.sep) && filePath !== resolvedRoot) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }

        const data = await fs.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        });
        res.end(data);
      } catch (err) {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

describe('<calc-input> End-to-End Browser Tests (Puppeteer + WebDriver BiDi)', () => {
  let serverInfo;
  let browser;
  let page;

  before(async () => {
    serverInfo = await startStaticServer(SRC_DIR);
    browser = await puppeteer.launch({
      protocol: 'webDriverBiDi',
      headless: true,
    });
    page = await browser.newPage();
    await page.goto(serverInfo.url, { waitUntil: 'networkidle0' });
  });

  after(async () => {
    if (browser) {
      await browser.close();
    }
    if (serverInfo?.server) {
      await new Promise((resolve) => serverInfo.server.close(resolve));
    }
  });

  it('creates three <input type="text"> elements under the hood with default "--" separator and shows only one input at a time', async () => {
    const state = await page.evaluate(() => {
      const el = document.createElement('calc-input');
      el.setAttribute('name', 'size');
      document.body.appendChild(el);

      const inputs = Array.from(el.querySelectorAll('input'));
      const visibleInputs = inputs.filter(
        (inp) => !inp.hidden && getComputedStyle(inp).display !== 'none'
      );

      const details = inputs.map((inp) => ({
        type: inp.getAttribute('type'),
        name: inp.getAttribute('name'),
        hidden: inp.hidden,
      }));

      el.remove();
      return {
        isDefined: Boolean(customElements.get('calc-input')),
        inputCount: inputs.length,
        visibleCount: visibleInputs.length,
        details,
      };
    });

    assert.equal(state.isDefined, true);
    assert.equal(state.inputCount, 3);
    assert.equal(state.visibleCount, 1);
    assert.deepEqual(state.details, [
      { type: 'text', name: 'size', hidden: true },
      { type: 'text', name: 'size--formula', hidden: true },
      { type: 'text', name: 'size--result', hidden: false },
    ]);
  });

  it('evaluates simple and complex formulas, showing result on blur and formula on focus without ever showing more than one input', async () => {
    const result = await page.evaluate(() => {
      const el = document.createElement('calc-input');
      el.setAttribute('name', 'size');
      document.body.appendChild(el);

      const mainInput = el.querySelector('input[name="size"]');
      const formulaInput = el.querySelector('input[name="size--formula"]');
      const resultInput = el.querySelector('input[name="size--result"]');

      const countVisible = () =>
        Array.from(el.querySelectorAll('input')).filter(
          (i) => !i.hidden && getComputedStyle(i).display !== 'none'
        ).length;

      // Focus the element and enter "2 + 3"
      el.focus();
      const visibleDuringFocus1 = countVisible();
      const isFormulaVisibleOnFocus1 = !formulaInput.hidden && resultInput.hidden && mainInput.hidden;

      formulaInput.value = '2 + 3';
      formulaInput.dispatchEvent(new Event('input', { bubbles: true }));

      // Blur the input -> should show "5"
      formulaInput.blur();
      const visibleDuringBlur1 = countVisible();
      const isResultVisibleOnBlur1 = !resultInput.hidden && formulaInput.hidden && mainInput.hidden;
      const simpleValues = {
        main: mainInput.value,
        formula: formulaInput.value,
        result: resultInput.value,
        shownValueOnBlur: el.querySelector('input:not([hidden])').value,
      };

      // Re-focus -> should show the formula "2 + 3" again
      resultInput.focus();
      const visibleDuringFocus2 = countVisible();
      const shownValueOnRefocus = el.querySelector('input:not([hidden])').value;

      // Enter complex formula "(2 + 3) * 4" and blur -> should show "20"
      formulaInput.value = '(2 + 3) * 4';
      formulaInput.dispatchEvent(new Event('input', { bubbles: true }));
      formulaInput.blur();

      const complexValues = {
        main: mainInput.value,
        formula: formulaInput.value,
        result: resultInput.value,
        shownValueOnBlur: el.querySelector('input:not([hidden])').value,
      };

      el.remove();
      return {
        visibleDuringFocus1,
        isFormulaVisibleOnFocus1,
        visibleDuringBlur1,
        isResultVisibleOnBlur1,
        simpleValues,
        visibleDuringFocus2,
        shownValueOnRefocus,
        complexValues,
      };
    });

    assert.equal(result.visibleDuringFocus1, 1);
    assert.equal(result.isFormulaVisibleOnFocus1, true);
    assert.equal(result.visibleDuringBlur1, 1);
    assert.equal(result.isResultVisibleOnBlur1, true);
    assert.deepEqual(result.simpleValues, {
      main: '2 + 3',
      formula: '2 + 3',
      result: '5',
      shownValueOnBlur: '5',
    });
    assert.equal(result.visibleDuringFocus2, 1);
    assert.equal(result.shownValueOnRefocus, '2 + 3');
    assert.deepEqual(result.complexValues, {
      main: '(2 + 3) * 4',
      formula: '(2 + 3) * 4',
      result: '20',
      shownValueOnBlur: '20',
    });
  });

  it('supports configuring the primary input value and submitted fields via submit="formula" (default), "result", "formula-only", and "result-only"', async () => {
    const result = await page.evaluate(() => {
      const form = document.createElement('form');
      form.innerHTML = `
        <calc-input name="defaultSubmit" value="2 + 3"></calc-input>
        <calc-input name="explicitFormula" submit="formula" value="2 + 3"></calc-input>
        <calc-input name="explicitResult" submit="result" value="(2 + 3) * 4"></calc-input>
        <calc-input name="formulaOnly" submit="formula-only" value="10 + 5"></calc-input>
        <calc-input name="resultOnly" submit="result-only" value="6 * 7"></calc-input>
      `;
      document.body.appendChild(form);

      const fd = Object.fromEntries(new FormData(form).entries());

      const formulaOnlyEl = form.querySelector('calc-input[name="formulaOnly"]');
      const resultOnlyEl = form.querySelector('calc-input[name="resultOnly"]');
      const formulaOnlyInputNames = Array.from(formulaOnlyEl.querySelectorAll('input')).map((i) =>
        i.getAttribute('name')
      );
      const resultOnlyInputNames = Array.from(resultOnlyEl.querySelectorAll('input')).map((i) =>
        i.getAttribute('name')
      );

      // Also test dynamic switching of `submit` attribute
      const firstEl = form.querySelector('calc-input[name="defaultSubmit"]');
      firstEl.setAttribute('submit', 'result-only');
      const afterSwitchToResultOnly = {
        value: firstEl.value,
        names: Array.from(firstEl.querySelectorAll('input')).map((i) => i.getAttribute('name')),
        fdKeys: Array.from(new FormData(form).keys()).filter((k) => k.startsWith('defaultSubmit')),
      };

      firstEl.setAttribute('submit', 'formula');
      const afterSwitchBackToFormula = {
        value: firstEl.value,
        names: Array.from(firstEl.querySelectorAll('input')).map((i) => i.getAttribute('name')),
      };

      form.remove();
      return {
        fd,
        formulaOnlyInputNames,
        resultOnlyInputNames,
        afterSwitchToResultOnly,
        afterSwitchBackToFormula,
      };
    });

    assert.deepEqual(result.fd, {
      defaultSubmit: '2 + 3',
      'defaultSubmit--formula': '2 + 3',
      'defaultSubmit--result': '5',
      explicitFormula: '2 + 3',
      'explicitFormula--formula': '2 + 3',
      'explicitFormula--result': '5',
      explicitResult: '20',
      'explicitResult--formula': '(2 + 3) * 4',
      'explicitResult--result': '20',
      formulaOnly: '10 + 5',
      resultOnly: '42',
    });
    assert.deepEqual(result.formulaOnlyInputNames, ['formulaOnly', null, null]);
    assert.deepEqual(result.resultOnlyInputNames, ['resultOnly', null, null]);
    assert.deepEqual(result.afterSwitchToResultOnly, {
      value: '5',
      names: ['defaultSubmit', null, null],
      fdKeys: ['defaultSubmit'],
    });
    assert.deepEqual(result.afterSwitchBackToFormula, {
      value: '2 + 3',
      names: ['defaultSubmit', 'defaultSubmit--formula', 'defaultSubmit--result'],
    });
  });

  it('supports configuring the separator via the separator attribute, including an empty string', async () => {
    const result = await page.evaluate(() => {
      const container = document.createElement('div');
      container.innerHTML = `
        <calc-input id="sep-default" name="size" value="2 + 3"></calc-input>
        <calc-input id="sep-custom" name="size" separator="_" value="2 + 3"></calc-input>
        <calc-input id="sep-empty" name="size" separator="" value="2 + 3"></calc-input>
      `;
      document.body.appendChild(container);

      const getNames = (id) =>
        Array.from(container.querySelectorAll(`#${id} input`)).map((i) => i.getAttribute('name'));

      const out = {
        defaultNames: getNames('sep-default'),
        customNames: getNames('sep-custom'),
        emptyNames: getNames('sep-empty'),
      };

      container.remove();
      return out;
    });

    assert.deepEqual(result.defaultNames, ['size', 'size--formula', 'size--result']);
    assert.deepEqual(result.customNames, ['size', 'size_formula', 'size_result']);
    assert.deepEqual(result.emptyNames, ['size', 'sizeformula', 'sizeresult']);
  });

  it('keeps showing the original formula when blurred if unparsable, applies invalid styling, and prevents form submission', async () => {
    const result = await page.evaluate(() => {
      const form = document.createElement('form');
      const el = document.createElement('calc-input');
      el.setAttribute('name', 'size');
      form.appendChild(el);
      document.body.appendChild(form);

      let submitCount = 0;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        submitCount++;
      });

      const formulaInput = el.querySelector('input[name="size--formula"]');
      const resultInput = el.querySelector('input[name="size--result"]');

      //Valid state baseline border color
      el.focus();
      formulaInput.value = '2 + 3';
      formulaInput.dispatchEvent(new Event('input', { bubbles: true }));
      const validBorderColor = getComputedStyle(formulaInput).borderColor;

      // Enter unparsable formula "2 + " while focused -> should NOT be invalid or red while focused
      formulaInput.value = '2 + ';
      formulaInput.dispatchEvent(new Event('input', { bubbles: true }));
      const matchesInvalidWhileFocused = formulaInput.matches(':invalid');
      const borderColorWhileFocused = getComputedStyle(formulaInput).borderColor;

      // Blur -> now validation applies and marks it invalid
      formulaInput.blur();

      const isFormulaStillVisibleOnBlur = !formulaInput.hidden && resultInput.hidden;
      const shownValueOnBlur = el.querySelector('input:not([hidden])').value;
      const invalidBorderColor = getComputedStyle(formulaInput).borderColor;
      const matchesInvalidPseudo = formulaInput.matches(':invalid');
      const inputCheckValidity = formulaInput.checkValidity();
      const formCheckValidityInvalid = form.checkValidity();

      // Attempt form submission via requestSubmit() while invalid
      form.requestSubmit();
      const submitCountAfterInvalidAttempt = submitCount;

      // Fix the formula to "2 + 3" and blur
      el.focus();
      formulaInput.value = '2 + 3';
      formulaInput.dispatchEvent(new Event('input', { bubbles: true }));
      formulaInput.blur();

      const isResultVisibleAfterFix = !resultInput.hidden && formulaInput.hidden;
      const shownValueAfterFix = el.querySelector('input:not([hidden])').value;
      const formCheckValidityValid = form.checkValidity();

      // Attempt form submission now that it is valid
      form.requestSubmit();
      const submitCountAfterValidAttempt = submitCount;

      form.remove();
      return {
        matchesInvalidWhileFocused,
        borderColorWhileFocused,
        isFormulaStillVisibleOnBlur,
        shownValueOnBlur,
        validBorderColor,
        invalidBorderColor,
        matchesInvalidPseudo,
        inputCheckValidity,
        formCheckValidityInvalid,
        submitCountAfterInvalidAttempt,
        isResultVisibleAfterFix,
        shownValueAfterFix,
        formCheckValidityValid,
        submitCountAfterValidAttempt,
      };
    });

    assert.equal(result.matchesInvalidWhileFocused, false);
    assert.equal(result.borderColorWhileFocused, result.validBorderColor);
    assert.equal(result.isFormulaStillVisibleOnBlur, true);
    assert.equal(result.shownValueOnBlur, '2 + ');
    assert.equal(result.matchesInvalidPseudo, true);
    assert.equal(result.invalidBorderColor, 'rgb(239, 68, 68)'); // Red border (#ef4444)
    assert.notEqual(result.invalidBorderColor, result.validBorderColor);
    assert.equal(result.inputCheckValidity, false);
    assert.equal(result.formCheckValidityInvalid, false);
    assert.equal(result.submitCountAfterInvalidAttempt, 0);

    assert.equal(result.isResultVisibleAfterFix, true);
    assert.equal(result.shownValueAfterFix, '5');
    assert.equal(result.formCheckValidityValid, true);
    assert.equal(result.submitCountAfterValidAttempt, 1);
  });

  it('parses the initial value attribute and does NOT write entered values back into the DOM', async () => {
    const result = await page.evaluate(() => {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = `<calc-input name="size" value="2 + 3"></calc-input>`;
      document.body.appendChild(wrapper);

      const el = wrapper.querySelector('calc-input');
      const mainInput = el.querySelector('input[name="size"]');
      const formulaInput = el.querySelector('input[name="size--formula"]');
      const resultInput = el.querySelector('input[name="size--result"]');

      // Initial blurred state: shows "5"
      const initialBlurredVisibleInput = el.querySelector('input:not([hidden])');
      const initialShownOnBlur = initialBlurredVisibleInput.value;

      // Focus: shows "2 + 3"
      el.focus();
      const initialFocusedVisibleInput = el.querySelector('input:not([hidden])');
      const initialShownOnFocus = initialFocusedVisibleInput.value;

      // Enter a new formula "(10 + 5) * 2" -> 30 and blur
      formulaInput.value = '(10 + 5) * 2';
      formulaInput.dispatchEvent(new Event('input', { bubbles: true }));
      formulaInput.blur();

      const updatedShownOnBlur = el.querySelector('input:not([hidden])').value;
      const hostValueAttrAfterEdit = el.getAttribute('value');
      const mainInputValueAttr = mainInput.getAttribute('value');
      const formulaInputValueAttr = formulaInput.getAttribute('value');
      const resultInputValueAttr = resultInput.getAttribute('value');

      // Also test an element with NO initial value attribute
      const elNoAttr = document.createElement('calc-input');
      elNoAttr.setAttribute('name', 'qty');
      document.body.appendChild(elNoAttr);
      const qtyFormulaInput = elNoAttr.querySelector('input[name="qty--formula"]');
      elNoAttr.focus();
      qtyFormulaInput.value = '4 * 5';
      qtyFormulaInput.dispatchEvent(new Event('input', { bubbles: true }));
      qtyFormulaInput.blur();
      const noAttrHostHasValueAttr = elNoAttr.hasAttribute('value');

      wrapper.remove();
      elNoAttr.remove();

      return {
        initialShownOnBlur,
        initialShownOnFocus,
        updatedShownOnBlur,
        hostValueAttrAfterEdit,
        mainInputValueAttr,
        formulaInputValueAttr,
        resultInputValueAttr,
        noAttrHostHasValueAttr,
      };
    });

    assert.equal(result.initialShownOnBlur, '5');
    assert.equal(result.initialShownOnFocus, '2 + 3');
    assert.equal(result.updatedShownOnBlur, '30');
    // Host value attribute remains untouched as initial "2 + 3"
    assert.equal(result.hostValueAttrAfterEdit, '2 + 3');
    // Inner inputs do not have a `value` attribute written to the DOM
    assert.equal(result.mainInputValueAttr, null);
    assert.equal(result.formulaInputValueAttr, null);
    assert.equal(result.resultInputValueAttr, null);
    // Element without initial value attribute still has no value attribute in the DOM
    assert.equal(result.noAttrHostHasValueAttr, false);
  });

  it('supports real mouse clicks, keyboard typing, form reset, and direct CSS inheritance from <calc-input> to inner inputs', async () => {
    // Click on the visible input inside #demo-formula, clear, type a new formula, and click outside to blur
    await page.click('#demo-formula input:not([hidden])');

    const focusedState = await page.evaluate(() => {
      const el = document.querySelector('#demo-formula');
      return {
        activeElementName: document.activeElement?.getAttribute('name'),
        formulaHidden: el.formulaInput.hidden,
        resultHidden: el.resultInput.hidden,
        formulaValue: el.formulaInput.value,
      };
    });

    assert.equal(focusedState.activeElementName, 'size--formula');
    assert.equal(focusedState.formulaHidden, false);
    assert.equal(focusedState.resultHidden, true);
    assert.equal(focusedState.formulaValue, '(2 + 3) * 4');

    // Select all and type a new formula via Puppeteer keyboard
    await page.evaluate(() => {
      document.querySelector('#demo-formula').select();
    });
    await page.keyboard.type('(10 + 2) / 3');

    // Click on body header to blur
    await page.click('header h1');

    const blurredState = await page.evaluate(() => {
      const el = document.querySelector('#demo-formula');
      return {
        formulaHidden: el.formulaInput.hidden,
        resultHidden: el.resultInput.hidden,
        formulaValue: el.formulaInput.value,
        resultValue: el.resultInput.value,
        domValueAttr: el.getAttribute('value'),
      };
    });

    assert.equal(blurredState.formulaHidden, true);
    assert.equal(blurredState.resultHidden, false);
    assert.equal(blurredState.formulaValue, '(10 + 2) / 3');
    assert.equal(blurredState.resultValue, '4');
    assert.equal(blurredState.domValueAttr, '(2 + 3) * 4');

    // Test that styles applied directly onto <calc-input> apply to the <input> elements inside it
    const inheritedStyles = await page.evaluate(() => {
      const styledEl = document.querySelector('calc-input[name="custom_border"]');
      const styledInput = styledEl.querySelector('input:not([hidden])');
      const cs = getComputedStyle(styledInput);
      return {
        hostDisplay: getComputedStyle(styledEl).display,
        borderColor: cs.borderColor,
        borderRadius: cs.borderRadius,
      };
    });

    assert.equal(inheritedStyles.hostDisplay, 'contents');
    assert.equal(inheritedStyles.borderColor, 'rgb(59, 130, 246)');
    assert.equal(inheritedStyles.borderRadius, '9999px');

    // Test form reset restores initial value attribute
    const resetState = await page.evaluate(async () => {
      const form = document.querySelector('#demo-form');
      const widthEl = document.querySelector('#form-width');
      widthEl.formula = '50 + 50';
      widthEl.blur();
      const beforeResetResult = widthEl.result;

      form.reset();
      await new Promise((r) => setTimeout(r, 10));

      return {
        beforeResetResult,
        afterResetFormula: widthEl.formula,
        afterResetResult: widthEl.result,
      };
    });

    assert.equal(resetState.beforeResetResult, '100');
    assert.equal(resetState.afterResetFormula, '2 + 3');
    assert.equal(resetState.afterResetResult, '5');
  });

  it('reveals and focuses the --formula input with focus styling when tabbing (Tab / Shift+Tab) into and out of <calc-input>', async () => {
    // Focus the link immediately preceding #demo-formula
    await page.evaluate(() => {
      document.querySelector('#demo-formula').formula = '(2 + 3) * 4';
      document.querySelector('#demo-formula').blur();
      document.querySelector('a[href="#example-themes"]').focus();
    });

    // Press Tab to enter #demo-formula
    await page.keyboard.press('Tab');

    const afterTabIn = await page.evaluate(() => {
      const demo = document.querySelector('#demo-formula');
      const active = document.activeElement;
      const cs = getComputedStyle(demo.formulaInput);
      return {
        activeName: active?.getAttribute('name'),
        formulaHidden: demo.formulaInput.hidden,
        resultHidden: demo.resultInput.hidden,
        mainHidden: demo.mainInput.hidden,
        visibleValue: demo.querySelector('input:not([hidden])')?.value,
        borderColor: cs.borderColor,
        boxShadow: cs.boxShadow,
      };
    });

    assert.equal(afterTabIn.activeName, 'size--formula');
    assert.equal(afterTabIn.formulaHidden, false);
    assert.equal(afterTabIn.resultHidden, true);
    assert.equal(afterTabIn.mainHidden, true);
    assert.equal(afterTabIn.visibleValue, '(2 + 3) * 4');
    assert.equal(afterTabIn.borderColor, 'rgb(37, 99, 235)');
    assert.notEqual(afterTabIn.boxShadow, 'none');

    // Press Tab again to exit #demo-formula to the first preset button
    await page.keyboard.press('Tab');

    const afterTabOut = await page.evaluate(() => {
      const demo = document.querySelector('#demo-formula');
      const active = document.activeElement;
      return {
        activeTag: active?.tagName,
        activePreset: active?.getAttribute('data-preset'),
        formulaHidden: demo.formulaInput.hidden,
        resultHidden: demo.resultInput.hidden,
        visibleValue: demo.querySelector('input:not([hidden])')?.value,
      };
    });

    assert.equal(afterTabOut.activeTag, 'BUTTON');
    assert.equal(afterTabOut.activePreset, '2 + 3');
    assert.equal(afterTabOut.formulaHidden, true);
    assert.equal(afterTabOut.resultHidden, false);
    assert.equal(afterTabOut.visibleValue, '20');

    // Press Shift+Tab to re-enter #demo-formula backwards
    await page.keyboard.down('Shift');
    await page.keyboard.press('Tab');
    await page.keyboard.up('Shift');

    const afterShiftTabIn = await page.evaluate(() => {
      const demo = document.querySelector('#demo-formula');
      const active = document.activeElement;
      return {
        activeName: active?.getAttribute('name'),
        formulaHidden: demo.formulaInput.hidden,
        resultHidden: demo.resultInput.hidden,
        visibleValue: demo.querySelector('input:not([hidden])')?.value,
      };
    });

    assert.equal(afterShiftTabIn.activeName, 'size--formula');
    assert.equal(afterShiftTabIn.formulaHidden, false);
    assert.equal(afterShiftTabIn.resultHidden, true);
    assert.equal(afterShiftTabIn.visibleValue, '(2 + 3) * 4');
  });
});
