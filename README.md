# Intro

This is a nodejs module can use in code and also a Murano CLI project compatible CLI.

# Install

```sh
npm link
```

# CLI Usage

```sh
muranode --help
```

# Module Usage

## Promise

```js
const {
  api: { Biz },
} = require("muranode");

const host = process.env.muranode_net_host;
const email = process.env.muranode_user_name
const password = process.env.muranode_password
const applicationId = process.env.muranode_application_id
const productId = process.env.muranode_product_id;

const biz = Biz({ host, applicationId, productId });

biz
  .token({ email, password })
  .toPromise()
  .then(() =>
    Promise.all([
      biz.device2.listIdentities({ limit: 1 }).toPromise(),
      biz.user.listUsers({ limit: 1 }).toPromise(),
    ])
  )
  .then(console.log)
  .catch(console.log);
```

## Observable

```js
const { combineLatest } = require("rxjs");
const { switchMap } = require("rxjs/operators");
const {
  api: { Biz },
} = require("muranode");

const host = process.env.muranode_net_host;
const email = process.env.muranode_user_name
const password = process.env.muranode_password
const applicationId = process.env.muranode_application_id
const productId = process.env.muranode_product_id;

const biz = Biz({ host, applicationId, productId });

biz
  .token({ email, password })
  .pipe(
    switchMap(() =>
      combineLatest(
        biz.device2.listIdentities({ limit: 1 }),
        biz.user.listUsers({ limit: 1 })
      )
    )
  )
  .subscribe(
    (x) => console.log("next", x),
    (e) => console.log("error", e),
    () => console.log("complete")
  );
```

## CLI

```js
const { combineLatest, zip } = require("rxjs");
const { map, switchMap } = require("rxjs/operators");
const {
  api: { Biz },
  cli: { host, applicationId, productId, token },
} = require("muranode");

zip(host, applicationId, productId, token)
  .pipe(
    map(([host, applicationId, productId, token]) =>
      Biz({ host, applicationId, productId, token })
    ),
    switchMap((biz) =>
      combineLatest(
        biz.device2.listIdentities({ limit: 1 }),
        biz.user.listUsers({ limit: 1 })
      )
    )
  )
  .subscribe(
    (x) => console.log("next", x),
    (e) => console.log("error", e),
    () => console.log("complete")
  );
```

# Uninstall

```sh
npm unlink
```
