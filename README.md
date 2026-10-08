# `<formula-input>`

A custom input element that accepts mathematical formulas (such as `2 + 3` or `(2 + 3) * 4`). Upon blurring the input, the field displays the calculated result (`5` or `20`), and upon re-focusing it shows the original formula again.

Behind the scenes, `<formula-input name="size">` renders three `<input type="text">` elements (`name="size"`, `name="size--formula"`, and `name="size--result"`) so standard HTML `<form>` submissions and constraint validation work seamlessly out of the box.

---

## Features

- **Focus / Blur Formula Switching**: Shows the evaluated result on blur and restores the formula on focus. The user never sees more than one input at a time.
- **Three Synchronized Inputs Under the Hood**: `<formula-input name="size">` creates:
  - `<input type="text" name="size">` — contains either the `formula` (default) or `result`, configurable via `submit="formula|result|formula-only|result-only"`.
  - `<input type="text" name="size--formula">` — always contains the entered formula (omitted from submission when `submit="formula-only"` or `submit="result-only"`).
  - `<input type="text" name="size--result">` — always contains the calculated result (omitted from submission when `submit="formula-only"` or `submit="result-only"`).
- **Configurable Separator**: Customize the `--` separator in `name--formula` and `name--result` using the `separator` attribute (e.g. `separator="_"` or `separator=""`).
- **Complex Formula Support**: Evaluates `+`, `-`, `*`, `/`, `%`, `^` / `**`, nested parentheses `(2 + 3) * 4`, unary operators, decimals, scientific notation, and standard math functions (`sqrt`, `abs`, `round`, `min`, `max`, `pow`, etc.) using a safe recursive-descent parser without `eval()`.
- **Invalid Formula Handling & Native Form Validation**: When an unparsable formula is entered (e.g. `2 + `), blurring keeps showing the original formula with invalid styling (red border) and sets `setCustomValidity()` to prevent form submission.
- **Clean DOM Attributes**: Set an initial formula via the `value` attribute (e.g. `<formula-input name="size" value="2 + 3">`) without writing user-entered values back into the DOM attributes.

---

## Component Anatomy

```text
<formula-input name="size" value="2 + 3">
├─ <input type="text" name="size" hidden>
├─ <input type="text" name="size--formula" hidden>
└─ <input type="text" name="size--result">
```

---

## Quick Start

### 1. Installation

```bash
npm install formula-input
```

### 2. Usage

```html
<script type="module" src="formula-input"></script>

<form>
  <formula-input name="size" value="2 + 3"></formula-input>
  <button type="submit">Submit</button>
</form>
```

---

## Attributes & Configuration

| Attribute | Default | Description |
|---|---|---|
| `name` | `""` | Base name for the three underlying `<input type="text">` elements: `<name>`, `<name><separator>formula`, and `<name><separator>result`. |
| `value` | `""` | Initial formula string (e.g. `value="2 + 3"`). Parsed on load without writing subsequent user edits back into the DOM attribute. |
| `submit` | `"formula"` | Controls what `<input type="text" name="<name>">` contains (`"formula"`, `"result"`, `"formula-only"`, or `"result-only"`). When set to `"formula-only"` or `"result-only"`, the `--formula` and `--result` fields are not submitted. |
| `separator` | `"--"` | Separator used for the formula and result input names. Empty string `separator=""` is supported. |
| `placeholder` | `""` | Placeholder forwarded to the inner inputs. |
| `disabled` / `readonly` / `required` | `false` | Standard form attributes forwarded to the inner inputs. |

---

## Development & Testing

```bash
# Start local demo server
npm start

# Run unit and end-to-end Puppeteer tests
npm test

# Build ./dist for publishing
npm run build
```

---

## License

MIT © [Bramus Van Damme](https://www.bram.us/)
