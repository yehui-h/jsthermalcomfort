# jsthermalcomfort

The `jsthermalcomfort` JavaScript library calculates thermal comfort indices to the international standards that define them, along with the psychrometrics and thermophysiology they rest on. Designed for researchers, engineers, and building-science professionals, it simplifies complex calculations while promoting accuracy and standards compliance in web-based applications.

## Cite jsthermalcomfort

If you use `jsthermalcomfort` in your research, please cite the original `pythermalcomfort` paper (which this library implements) as follows:

> Tartarini, F., Schiavon, S., 2020. pythermalcomfort: A Python package for thermal comfort research. SoftwareX 12, 100578. [https://doi.org/10.1016/j.softx.2020.100578](https://doi.org/10.1016/j.softx.2020.100578)

## Key Features

- **Standard-compliant:** PMV/PPD to ISO 7730 and to ASHRAE 55, adaptive comfort to ASHRAE 55 and EN 16798-1, and the models they build on — SET, the two-node model and the elevated-air-speed cooling effect.
- **Thresholds as data:** the sensation scales, acceptability offsets and category limits are published as reference tables, so a consuming tool reads one definition instead of transcribing numbers.
- **One input and output shape:** `jsthermalcomfort/io` reduces every model to the same result type without changing what the models themselves return.
- **Chart geometry included:** the psychrometric comfort zone and the adaptive bands are computed, not hard-coded, reproducing what the CBE Thermal Comfort Tool draws.
- **Fast:** Optimized for performance, allowing for large-scale simulations in the browser or Node.js.
- **Cross-platform:** ESM with TypeScript declarations, in any modern browser or Node.js. CommonJS callers `require()` it through Node's `require(esm)`, supported across the whole `engines` range. No runtime dependencies.

## Why Use jsthermalcomfort?

Thermal comfort analysis often requires complex calculations based on multiple parameters. `jsthermalcomfort` provides a reliable and easy-to-use platform for these calculations, ensuring that researchers and practitioners can focus on their results rather than the underlying math. It is based on the well-tested `pythermalcomfort` library, ensuring high accuracy and reliability for building science applications.

## Installation

```bash
npm install jsthermalcomfort
```

## Requirements

- Node.js (for server-side usage) or a modern web browser.
- No external dependencies are required for core functionality.

## Quick Start

To get started with `jsthermalcomfort`, you can install it via npm and run a simple calculation:

```javascript
import { pmv_ppd_iso } from "jsthermalcomfort";

// Calculate PMV and PPD. Pick the model of the standard you are working to:
// pmv_ppd_iso is Fanger unmodified, pmv_ppd_ashrae adds the
// elevated-air-speed cooling effect.
const results = pmv_ppd_iso(25, 25, 0.1, 50, 1.2, 0.5);
console.log(`PMV: ${results.pmv}, PPD: ${results.ppd}%`);
```

## Entry points

| Import                            | What it holds                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| `jsthermalcomfort`                | everything below, plus `reference`, `io` and `charts` as namespaces                              |
| `jsthermalcomfort/models`         | the comfort models: PMV/PPD (ISO, ASHRAE), adaptive (ASHRAE, EN), SET, two-node, cooling effect  |
| `jsthermalcomfort/psychrometrics` | saturation pressure, humidity ratio, wet-bulb, dew point, mean radiant and operative temperature |
| `jsthermalcomfort/utilities`      | relative air speed, dynamic clothing, unit conversion, applicability checks                      |
| `jsthermalcomfort/reference`      | sensation scales, adaptive offsets, EN category limits — the thresholds as data                  |
| `jsthermalcomfort/io`             | one input shape and one output shape across the models                                           |
| `jsthermalcomfort/charts`         | comfort-zone geometry for psychrometric and adaptive charts                                      |

See [Examples](examples.md) for each of them in use.

## Support jsthermalcomfort

You can support the development of `jsthermalcomfort` by:

- **Starring** the project on GitHub.
- **Reporting** bugs and suggesting features via GitHub Issues.
- **Contributing** code via Pull Requests.
- **Sharing** the project with your colleagues and community.

## Contribute

We welcome contributions to `jsthermalcomfort`! You can help by:

- Improving documentation and adding examples.
- Fixing bugs or implementing new thermal comfort models.
- Refactoring code for better performance and maintainability.

Please check the [Contributing Guide](contributing.md) for more details.

## Quick checklist

Before submitting a pull request, please ensure:

- You have provided a clear summary of the changes and motivation.
- You have added/updated tests for the new behavior.
- All existing tests pass.
- Documentation (docstrings and guides) is updated.
- You have added yourself to the `authors.html` page (optional).

## Common commands

- `npm install`: Install dependencies.
- `npm test`: Run the test suite.
- `npm run docs`: Generate this documentation site with TypeDoc.
- `npm run lint`: Check for code quality and formatting issues.

## Where to get help

- Open an issue on [GitHub Issues](https://github.com/FedericoTartarini/jsthermalcomfort/issues) for bug reports and feature requests.
- Participate in the [Discussions section](https://github.com/FedericoTartarini/jsthermalcomfort/discussions) for general questions and feedback.

## License

The `jsthermalcomfort` library is released under the **MIT License**.
