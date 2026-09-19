```bash
npm install jsthermalcomfort
```

If you want to use jsthermalcomfort package without installing it on your local machine, you can import with:

[`https://cdn.jsdelivr.net/npm/jsthermalcomfort/lib/esm/`](https://cdn.jsdelivr.net/npm/jsthermalcomfort/lib/esm/)

Named functions are re-exported from the package root:

```javascript
import { pmv_ppd } from "https://cdn.jsdelivr.net/npm/jsthermalcomfort/lib/esm/index.js";

const results = pmv_ppd(25, 25, 0.1, 50, 1.2, 0.5);
```

The default export groups the same functions under `models`, `utilities`, and `psychrometrics`:

```javascript
import pkg from "https://cdn.jsdelivr.net/npm/jsthermalcomfort/lib/esm/index.js";

const results = pkg.models.pmv_ppd(25, 25, 0.1, 50, 1.2, 0.5);
```

You can also import it in the website directly, and caution that you need to mark the script as module:

```html
<script type="module">
  import pkg from "https://cdn.jsdelivr.net/npm/jsthermalcomfort/lib/esm/index.js";

  const results = pkg.models.pmv_ppd(25, 25, 0.1, 50, 1.2, 0.5);
</script>
```
