const fs = require("fs");
const path = require("path");

const yaml = require("js-yaml");
const { EMPTY, bindNodeCallback, from, zip } = require("rxjs");
const {
  catchError,
  filter,
  map,
  mergeMap,
  reduce,
  switchMap,
  shareReplay,
} = require("rxjs/operators");

const L = require("../log.js");
const { Biz } = require("../../api/index.js");
const { host, productId, token } = require("../index.js");

const readFile = bindNodeCallback(fs.readFile);
const readdir = bindNodeCallback(fs.readdir);

const biz = zip(host, productId, token).pipe(
  map(([host, productId, token]) => Biz({ host, productId, token }))
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
      map((o) => ({ [path.basename(x, ".yaml")]: o })),
    )
  ),
  reduce((a, b) => Object.assign(a, b), {})
);

const doUpdate = payload.pipe(
  switchMap((x) =>
    biz.pipe(switchMap((biz) => biz.device2.updateGatewaySettings(x)))
  )
);

module.exports = {
  action: doUpdate,
};
