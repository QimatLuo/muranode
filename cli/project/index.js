const fs = require("fs");
const os = require("os");
const path = require("path");

const _ = {
  merge: require("lodash/merge"),
};
const yaml = require("js-yaml");
const ini = require("ini");
const { bindNodeCallback, iif, merge, of, zip } = require("rxjs");
const {
  catchError,
  map,
  pluck,
  switchMap,
  shareReplay,
} = require("rxjs/operators");

const { prompt } = require("../prompt.js");
const { Biz } = require("../../api/index.js");

const readFile = bindNodeCallback(fs.readFile);
const writeFile = bindNodeCallback(fs.writeFile);
const mkdir = bindNodeCallback(fs.mkdir);

const config = readFile(
  path.join(process.cwd(), ".murano", "config"),
  "utf-8"
).pipe(
  map((x) => ini.parse(x)),
  catchError(() => of({}))
);

const host = iif(
  () => process.env.muranode_net_host,
  of(process.env.muranode_net_host),
  config.pipe(pluck("net", "host"))
).pipe(
  switchMap((x) =>
    x
      ? of(x)
      : prompt({
          type: "autocomplete",
          name: "host",
          message: "Biz API domain",
          suggestOnly: true,
          validate: (x) => !!x,
          source: (_, input = "") =>
            tokens
              .pipe(map((x) => Object.keys(x).filter((x) => x.includes(input))))
              .toPromise(),
        })
  ),
  shareReplay(1)
);

const email = iif(
  () => process.env.muranode_user_name,
  of(process.env.muranode_user_name),
  config.pipe(pluck("user", "name"))
).pipe(
  switchMap((x) =>
    x
      ? of(x)
      : host.pipe(
          switchMap((host) =>
            prompt({
              type: "autocomplete",
              name: "email",
              message: "Account",
              suggestOnly: true,
              validate: (x) => !!x,
              source: (_, input = "") =>
                tokens
                  .pipe(
                    map((x) => x[host]),
                    map((x = {}) =>
                      Object.keys(x).filter((x) => x.includes(input))
                    )
                  )
                  .toPromise(),
            })
          )
        )
  ),
  shareReplay(1)
);

const passwords = readFile(
  path.join(os.homedir(), ".murano", "passwords"),
  "utf-8"
).pipe(
  map((x) => yaml.load(x)),
  catchError(() => of({}))
);

const tokens = readFile(
  path.join(os.homedir(), ".murano", "tokens"),
  "utf-8"
).pipe(
  map((x) => yaml.load(x)),
  catchError(() => of({}))
);

const password = iif(
  () => process.env.muranode_password,
  of(process.env.muranode_password),
  zip(email, host).pipe(
    switchMap(([email, host]) => passwords.pipe(pluck(host, email)))
  )
).pipe(
  switchMap((x) =>
    x
      ? of(x)
      : prompt({
          type: "password",
          name: "password",
          message: "Password",
          mask: "*",
        })
  ),
  shareReplay(1)
);

const login = zip(email, host, password).pipe(
  switchMap(([email, host, password]) =>
    Biz({ host })
      .token({ email, password })
      .pipe(
        pluck("token"),
        switchMap((token) =>
          merge(
            setPassword({ [host]: { [email]: password } }),
            setToken({ [host]: { [email]: token } })
          ).pipe(map(() => token))
        )
      )
  )
);

const token = iif(
  () => process.env.muranode_token,
  of(process.env.muranode_token),
  zip(email, host).pipe(
    switchMap(([email, host]) => tokens.pipe(pluck(host, email)))
  )
).pipe(
  switchMap((x) => (x ? of(x) : login)),
  shareReplay(1)
);

const businesses = zip(email, host, token).pipe(
  switchMap(([email, host, token]) =>
    Biz({ host, token }).businesses({ email })
  )
);

const businessId = iif(
  () => process.env.muranode_business_id,
  of(process.env.muranode_business_id),
  config.pipe(pluck("business", "id"))
).pipe(
  switchMap((x) =>
    x
      ? of(x)
      : businesses.pipe(
          switchMap((xs) =>
            prompt({
              type: "autocomplete",
              name: "businessId",
              message: "Business",
              suggestOnly: true,
              validate: (x) => !!x,
              source: (_, input = "") =>
                Promise.resolve(
                  xs
                    .filter((x) => x.bizid.includes(input))
                    .map((x) => `${x.bizid}(${x.name})`)
                ),
            })
          ),
          map((x) => {
            const i = x.indexOf("(");
            if (i === -1) return x;
            return x.slice(0, i);
          })
        )
  ),
  shareReplay(1)
);

const solutions = zip(businessId, host, token).pipe(
  switchMap(([businessId, host, token]) =>
    Biz({ host, token }).solutions({ businessId })
  ),
  shareReplay(1)
);

const applications = solutions.pipe(
  map((xs) => xs.filter((x) => x.type === "application"))
);

const products = solutions.pipe(
  map((xs) => xs.filter((x) => x.type === "product"))
);

const applicationId = iif(
  () => process.env.muranode_application_id,
  of(process.env.muranode_application_id),
  config.pipe(pluck("application", "id"))
).pipe(
  switchMap((x) =>
    x
      ? of(x)
      : applications.pipe(
          switchMap((xs) =>
            prompt({
              type: "autocomplete",
              name: "applicationId",
              message: "Application",
              suggestOnly: true,
              validate: (x) => !!x,
              source: (_, input = "") =>
                Promise.resolve(
                  xs
                    .filter((x) => x.sid.includes(input))
                    .map((x) => `${x.sid}(${x.name})`)
                ),
            })
          ),
          map((x) => {
            const i = x.indexOf("(");
            if (i === -1) return x;
            return x.slice(0, i);
          })
        )
  ),
  shareReplay(1)
);

const productId = iif(
  () => process.env.muranode_product_id,
  of(process.env.muranode_product_id),
  config.pipe(pluck("product", "id"))
).pipe(
  switchMap((x) =>
    x
      ? of(x)
      : products.pipe(
          switchMap((xs) =>
            prompt({
              type: "autocomplete",
              name: "productId",
              message: "Product",
              suggestOnly: true,
              validate: (x) => !!x,
              source: (_, input = "") =>
                Promise.resolve(
                  xs
                    .filter((x) => x.sid.includes(input))
                    .map((x) => `${x.sid}(${x.name})`)
                ),
            })
          ),
          map((x) => {
            const i = x.indexOf("(");
            if (i === -1) return x;
            return x.slice(0, i);
          })
        )
  ),
  shareReplay(1)
);

const location_files = iif(
  () => process.env.muranode_location_files,
  of(process.env.muranode_location_files),
  config.pipe(
    pluck("location", "files"),
    map((x) => x || "assets")
  )
).pipe(shareReplay(1));

function setPassword(x) {
  return mkdir(path.join(os.homedir(), ".murano"), { recursive: true }).pipe(
    switchMap(() => passwords),
    switchMap((o = {}) =>
      writeFile(
        path.join(os.homedir(), ".murano", "passwords"),
        yaml.dump(_.merge(o, x))
      )
    )
  );
}

function setToken(x) {
  return mkdir(path.join(os.homedir(), ".murano"), { recursive: true }).pipe(
    switchMap(() => tokens),
    switchMap((o = {}) =>
      writeFile(
        path.join(os.homedir(), ".murano", "tokens"),
        yaml.dump(_.merge(o, x))
      )
    )
  );
}

module.exports = {
  applicationId,
  businessId,
  config,
  email,
  host,
  location_files,
  login,
  password,
  productId,
  setPassword,
  setToken,
  token,
};
