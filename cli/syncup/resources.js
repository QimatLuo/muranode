const fs = require("fs");
const path = require("path");

const yaml = require("js-yaml");
const { EMPTY, bindNodeCallback, from, merge, zip } = require("rxjs");
const {
  catchError,
  filter,
  map,
  mergeMap,
  reduce,
  share,
  shareReplay,
  switchMap,
} = require("rxjs/operators");

const L = require("../log.js");
const { Biz } = require("../../api/index.js");
const { applicationId, host, productId, token } = require("../index.js");

const readFile = bindNodeCallback(fs.readFile);
const readdir = bindNodeCallback(fs.readdir);

const biz = zip(applicationId, host, productId, token).pipe(
  map(([applicationId, host, productId, token]) =>
    Biz({ applicationId, host, productId, token })
  )
);

const local = readdir(path.join(process.cwd(), "specs")).pipe(
  catchError((e) => {
    if (e.code === "ENOENT") {
      L.log("Ignore syncup resources due to", e.message);
      return EMPTY;
    } else {
      throw e;
    }
  }),
  mergeMap((xs) => from(xs)),
  filter((x) => x.endsWith(".yaml")),
  shareReplay(1)
);

const payload = local.pipe(
  mergeMap((x) =>
    readFile(path.join(process.cwd(), "specs", x)).pipe(
      map((x) => yaml.load(x)),
      map((o) => ({ [path.basename(x, ".yaml")]: o }))
    )
  ),
  reduce((a, b) => Object.assign(a, b), {})
);

const doUpdate = zip(payload, productId).pipe(
  switchMap(([{ resources, ...parameters }, service]) =>
    biz.pipe(
      switchMap((biz) =>
        biz.config.setParameters({
          service,
          parameters,
        })
      )
    )
  )
);

const origin = zip(
  payload.pipe(map((x) => x.resources)),
  biz.pipe(switchMap((biz) => biz.device2.getGatewayResourceList({})))
).pipe(share());

function diff(method, f) {
  return origin.pipe(
    mergeMap(([a, b]) => f([a, b]).map((alias) => ({ ...a[alias], alias }))),
    mergeMap((x) => biz.pipe(mergeMap((biz) => biz.device2[method](x))))
  );
}

function isSubset(a, b) {
  if (typeof a === "string" || typeof a === "number") {
    return a === b;
  } else if (Array.isArray(a)) {
    return a.every(([, i]) => isSubset(a[i], b[i]));
  } else {
    return Object.keys(a).every((k) => isSubset(a[k], b[k]));
  }
}

const syncResources = merge(
  diff("addGatewayResource", ([a, b]) => Object.keys(a).filter((k) => !b[k])),
  diff("removeGatewayResource", ([a, b]) =>
    Object.keys(b).filter((k) => !a[k])
  ),
  diff("updateGatewayResource", ([a, b]) =>
    Object.keys(a).filter((k) => !isSubset(a[k], b[k]))
  )
);

module.exports = {
  action: merge(doUpdate, syncResources),
};
