const fs = require("fs");
const path = require("path");

const yaml = require("js-yaml");
const { bindNodeCallback, from, zip } = require("rxjs");
const {
  filter,
  map,
  mergeMap,
  reduce,
  switchMap,
  shareReplay,
} = require("rxjs/operators");

const { Biz } = require("../../api/index.js");
const { host, productId, token } = require("../index.js");

const readFile = bindNodeCallback(fs.readFile);
const readdir = bindNodeCallback(fs.readdir);

const biz = zip(host, productId, token).pipe(
  map(([host, productId, token]) => Biz({ host, productId, token }))
);

const local = readdir(path.join(process.cwd(), "specs")).pipe(
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

const doUpdate = payload.pipe(
  switchMap((x) =>
    biz.pipe(switchMap((biz) => biz.device2.updateGatewaySettings(x)))
  )
);

module.exports = {
  action: doUpdate,
};
