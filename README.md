# Overview

|        docs         | [![docs](https://github.com/FedericoTartarini/jsthermalcomfort/actions/workflows/test_docs.yml/badge.svg)][docs_link]                                                                 |
| :-----------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
|      **build**      | [![build](https://img.shields.io/github/actions/workflow/status/FedericoTartarini/jsthermalcomfort/ci.yml?branch=main&label=build)][build_link]                                       |
|      **tests**      | [![test](https://img.shields.io/github/actions/workflow/status/FedericoTartarini/jsthermalcomfort/ci.yml?branch=main&label=tests)][test_link]                                         |
| **page deployment** | [![page deployment](https://github.com/FedericoTartarini/jsthermalcomfort/actions/workflows/deploy-docs.yml/badge.svg)][deploy_link]                                                  |
|  **snyk security**  | [![snyk](https://github.com/FedericoTartarini/jsthermalcomfort/actions/workflows/snyk.yml/badge.svg)][snyk_link]                                                                      |
|     **license**     | [![license](https://custom-icon-badges.demolab.com/github/license/denvercoder1/custom-icon-badges?logo=law)](https://github.com/FedericoTartarini/jsthermalcomfort/blob/main/LICENSE) |
|   **npm version**   | [![npm](https://img.shields.io/npm/v/jsthermalcomfort?style=plastic&logo=npm&logoColor=rgb)][npm_link]                                                                                |

Package to calculate thermophysiological, thermal comfort, thermal stress indices, in JavaScript.

Please cite us if you use this package: [Tartarini, F., Schiavon, S., 2020. pythermalcomfort: A Python package for thermal comfort research. SoftwareX 12, 100578. https://doi.org/10.1016/j.softx.2020.100578](https://www.sciencedirect.com/science/article/pii/S2352711020302910)

- Free software: MIT license
- Authors: [Federico Tartarini](https://www.linkedin.com/in/federico-tartarini/), [Omar Jesus Acuache Briceno](https://www.linkedin.com/in/omar-acuache), [Ruoshui Chen](https://github.com/ChristinChen233), [Jingyu Lu](https://github.com/Lu-Whale), [Yuchen Mu](https://github.com/YuchenMu), [Jordan Ocokoljic](https://github.com/JordanOcokoljic), [Santiago Zaldivar del Alba​](https://github.com/szaldivar), [Stefano Schiavon](https://www.linkedin.com/in/stefanoschiavon/), [Ollie Jay](https://www.linkedin.com/in/ollie-jay-793a1b11/)

[docs_link]: https://github.com/FedericoTartarini/jsthermalcomfort/actions/workflows/test_docs.yml
[build_link]: https://github.com/FedericoTartarini/jsthermalcomfort/actions/workflows/ci.yml
[test_link]: https://github.com/FedericoTartarini/jsthermalcomfort/actions/workflows/ci.yml
[deploy_link]: https://github.com/FedericoTartarini/jsthermalcomfort/actions/workflows/deploy-docs.yml
[snyk_link]: https://github.com/FedericoTartarini/jsthermalcomfort/actions/workflows/snyk.yml
[npm_link]: https://www.npmjs.com/package/jsthermalcomfort

# Official Documentation Website

[https://federicotartarini.github.io/jsthermalcomfort/](https://federicotartarini.github.io/jsthermalcomfort/)

# Installation

```bash
npm install jsthermalcomfort
```

If you want to use jsthermalcomfort package without installing it on your local machine, you can import with:

[`https://cdn.jsdelivr.net/npm/jsthermalcomfort/lib/esm/`](https://cdn.jsdelivr.net/npm/jsthermalcomfort/lib/esm/)

Example:

```javascript
import {
  models,
  utilities,
  psychrometrics,
} from "https://cdn.jsdelivr.net/npm/jsthermalcomfort/lib/esm/index.js";
```

You can also import it in the website directly, and caution that you need to mark the script as module:

```html
<script type="module">
  import {
    models,
    utilities,
    psychrometrics,
  } from "https://cdn.jsdelivr.net/npm/jsthermalcomfort/lib/esm/index.js";
</script>
```

# Four layers

The **models** take and return plain numbers, exactly as they always have:

```js
import { pmv_ppd_iso, adaptive_ashrae } from "jsthermalcomfort";

pmv_ppd_iso(25, 25, 0.1, 50, 1.2, 0.5); // { pmv: 0.08, ppd: 5.1 }
adaptive_ashrae(25, 25, 20, 0.1); // { tmp_cmf: 24, ... }
```

**`jsthermalcomfort/reference`** holds the thresholds as data — the thermal
sensation scales, the adaptive acceptability offsets, the EN category limits —
so a consuming tool reads one definition instead of transcribing numbers into
its own source. The same tables hang off the model functions:

```js
import { pmv_ppd_iso } from "jsthermalcomfort";

pmv_ppd_iso.tsv.labelFor(-0.8); // "Slightly Cool"
pmv_ppd_iso.tsv.classify(-0.8).notation; // "[-1.5, -0.5)"
```

**`jsthermalcomfort/io`** gives every model one input shape and one output
shape, without changing what the models themselves return:

```js
import { io } from "jsthermalcomfort";

const result = io.adaptiveEn({ tdb: 25, tr: 25, t_running_mean: 20, v: 0.1 });
result.toMeasures(); // [{ quantity, value, unit, category, intervals }]
result.warnings; // why a NaN is a NaN
```

**`jsthermalcomfort/charts`** computes the comfort zones a tool draws — the
psychrometric zone by root finding, the adaptive bands in closed form —
reproducing the geometry of the CBE Thermal Comfort Tool:

```js
import { charts } from "jsthermalcomfort";

charts.psychrometricZone({ tr: 25, vr: 0.13, met: 1.1, clo: 0.5 }).polygon;
charts.adaptiveAshraeZone()[0].upper; // the 80% band, from trm 10 to trm 36
```

Every layer calls the same functions with the same defaults, so the numbers
agree; tests enforce that. See
[Examples](https://federicotartarini.github.io/jsthermalcomfort/documents/Examples.html).

Subpath entry points: `jsthermalcomfort/models`, `/psychrometrics`,
`/utilities`, `/reference`, `/io`, `/charts`. The package ships ESM, CommonJS
and type declarations, and resolves under node10, node16 and bundler resolution
alike.

# Contributing

Contributions are welcome.

- Contributor guide: [`docs-src/contributing.md`](docs-src/contributing.md)
- Bug reports and feature requests: [GitHub Issues](https://github.com/FedericoTartarini/jsthermalcomfort/issues)

## Local development (quick start)

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run check:exports   # verifies the ESM/CJS/types wiring still resolves
npm run docs
```

Validation datasets for model tests are fetched from
`FedericoTartarini/validation-data-comfort-models` on GitHub (no submodule needed).
By default tests use the `main` branch. To pin tests to a specific ref (tag/branch/commit), set
`VALIDATION_DATA_REF` when running tests:

```bash
VALIDATION_DATA_REF=main npm test
```
