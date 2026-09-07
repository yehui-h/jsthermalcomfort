```bash
npm install jsthermalcomfort
```

If you want to use jsthermalcomfort package without installing it on your local machine, you can import with:

[`https://cdn.jsdelivr.net/npm/jsthermalcomfort/lib/esm/`](https://cdn.jsdelivr.net/npm/jsthermalcomfort/lib/esm/)

Example:

```javascript
import {
  pmv_ppd_iso,
  v_relative,
} from "https://cdn.jsdelivr.net/npm/jsthermalcomfort/lib/esm/index.js";

pmv_ppd_iso(25, 25, v_relative(0.1, 1.2), 50, 1.2, 0.5); // { pmv: -0.09, ppd: 5.2 }
```

You can also import it in the website directly, and caution that you need to mark the script as module:

```html
<script type="module">
  import {
    pmv_ppd_iso,
    v_relative,
  } from "https://cdn.jsdelivr.net/npm/jsthermalcomfort/lib/esm/index.js";
</script>
```
