```bash
npm install jsthermalcomfort
```

Functions are named exports, and each call takes one inputs object:

```javascript
import { pmv_ppd_iso } from "jsthermalcomfort";

const results = pmv_ppd_iso({
  tdb: 25,
  tr: 25,
  vr: 0.1,
  rh: 50,
  met: 1.2,
  clo: 0.5,
});
```

The default export groups the same functions under `models`, `utilities`, `psychrometrics`, and `environment`:

```javascript
import pkg from "jsthermalcomfort";

const results = pkg.models.pmv_ppd_iso({
  tdb: 25,
  tr: 25,
  vr: 0.1,
  rh: 50,
  met: 1.2,
  clo: 0.5,
});
```

In a browser, load the jsDelivr ESM build for the `next` release. It bundles the `mathjs` dependency. The raw `lib/esm/index.js` file imports `mathjs` by package name, which a browser does not resolve. The unversioned CDN URL tracks the `latest` release, which still uses positional arguments. Mark the script as a module:

```html
<script type="module">
  import { pmv_ppd_iso } from "https://cdn.jsdelivr.net/npm/jsthermalcomfort@next/+esm";

  const results = pmv_ppd_iso({
    tdb: 25,
    tr: 25,
    vr: 0.1,
    rh: 50,
    met: 1.2,
    clo: 0.5,
  });
</script>
```
