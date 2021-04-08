const fs = require("fs");
const path = require("path");

const { differenceBy } = require("lodash");
const { EMPTY, bindNodeCallback, from, merge, zip } = require("rxjs");
const {
  catchError,
  concatMap,
  filter,
  map,
  mergeMap,
  pluck,
  switchMap,
  shareReplay,
  toArray,
} = require("rxjs/operators");

const L = require("../log.js");
const { Biz } = require("../../api/index.js");
const { applicationId, host, token } = require("../index.js");

const readFile = bindNodeCallback(fs.readFile);
const readdir = bindNodeCallback(fs.readdir);

const biz = zip(applicationId, host, token).pipe(
  map(([applicationId, host, token]) => Biz({ applicationId, host, token })),
  shareReplay(1)
);

const local = readdir(path.join(process.cwd(), "modules")).pipe(
  catchError((e) => {
    if (e.code === "ENOENT") {
      L.log("Ignore syncup modules due to", e.message);
      return EMPTY;
    } else {
      throw e;
    }
  }),
  switchMap((xs) => from(xs)),
  filter((x) => x.endsWith(".lua")),
  mergeMap((x) =>
    readFile(path.join(process.cwd(), "modules", x)).pipe(
      map((b) => ({
        name: path.basename(x, ".lua"),
        script: b.toString(),
      }))
    )
  ),
  toArray(),
  shareReplay(1)
);

const cloud = biz.pipe(
  switchMap((biz) => biz.module.list()),
  pluck("items"),
  shareReplay(1)
);

const shouldDelete = zip(cloud, local).pipe(
  map(([cloud, local]) => differenceBy(cloud, local, (x) => x.name)),
  mergeMap((xs) => from(xs)),
  pluck("name")
);

const doDelete = biz.pipe(
  switchMap((biz) =>
    shouldDelete.pipe(mergeMap((name) => biz.module.delete({ name })))
  )
);

const shouldUpdate = local.pipe(mergeMap((xs) => from(xs)));

const doUpdate = biz.pipe(
  switchMap((biz) => shouldUpdate.pipe(mergeMap((x) => biz.module.update(x))))
);

module.exports = {
  action: doUpdate,
};
