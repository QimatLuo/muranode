const fs = require("fs");
const os = require("os");
const path = require("path");

const { EMPTY, bindNodeCallback, from, zip } = require("rxjs");
const {
  catchError,
  filter,
  map,
  mergeMap,
  pluck,
  switchMap,
  shareReplay,
} = require("rxjs/operators");

const L = require("../log.js");
const { Biz } = require("../../api/index.js");
const { applicationId, host, productId, token } = require("../index.js");

const readFile = bindNodeCallback(fs.readFile);
const readdir = bindNodeCallback(fs.readdir);

const biz = zip(applicationId, host, productId, token).pipe(
  map(([applicationId, host, productId, token]) =>
    Biz({ applicationId, host, productId, token })
  ),
  shareReplay(1)
);

const local = readdir(path.join(process.cwd(), "services")).pipe(
  catchError((e) => {
    if (e.code === "ENOENT") {
      L.log("Ignore syncup services due to", e.message);
      return EMPTY;
    } else {
      throw e;
    }
  }),
  switchMap((xs) => from(xs)),
  filter((x) => x.endsWith(".lua")),
  mergeMap((x) => readFile(path.join(process.cwd(), "services", x))),
  map((x) => parseScript(x)),
  shareReplay(1)
);

const cloud = biz.pipe(
  switchMap((biz) => biz.eventHandler.list()),
  pluck("items"),
  shareReplay(1)
);

const shouldUpdate = local;

const doUpdate = biz.pipe(
  switchMap((biz) =>
    shouldUpdate.pipe(mergeMap((x) => biz.eventHandler.update(x)))
  )
);

function parseScript(x) {
  const o = {};
  const scripts = [];
  x.toString()
    .split(os.EOL)
    .forEach((x) => {
      const event = x.match(/^--#EVENT (.+)/);
      const product = x.match(/^--#PRODUCT/);
      if (event) {
        o.name = event[1].trim().replace(/ /g, "_");
      } else if (product) {
        o.product = true;
      } else {
        scripts.push(x);
      }
    });
  o.script = scripts.join(os.EOL);
  return o;
}

module.exports = {
  action: doUpdate,
};
