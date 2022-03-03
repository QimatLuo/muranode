const fs = require("fs");
const os = require("os");
const path = require("path");

const { differenceBy } = require("lodash");
const {
  EMPTY,
  bindNodeCallback,
  from,
  fromEvent,
  merge,
  zip,
} = require("rxjs");
const {
  catchError,
  filter,
  map,
  mergeMap,
  pluck,
  reduce,
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

const local = readdir(path.join(process.cwd(), "endpoints")).pipe(
  catchError((e) => {
    if (e.code === "ENOENT") {
      L.log("Ignore syncup configs due to", e.message);
      return EMPTY;
    } else {
      throw e;
    }
  }),
  switchMap((xs) =>
    from(xs).pipe(
      filter((x) => x.endsWith(".lua")),
      mergeMap((x) => readFile(path.join(process.cwd(), "endpoints", x))),
      map((x) => parseScript(x)),
      toArray()
    )
  ),
  shareReplay(1)
);

const cloud = biz.pipe(
  switchMap((biz) => biz.endpoint.list()),
  shareReplay(1)
);

const shouldDelete = local.pipe(
  switchMap((local) =>
    cloud.pipe(
      map((cloud) => differenceBy(cloud, local, (x) => toUniqueEndpoint(x))),
      mergeMap((xs) => from(xs)),
      pluck("id")
    )
  )
);

const doDelete = biz.pipe(
  switchMap((biz) =>
    shouldDelete.pipe(mergeMap((id) => biz.endpoint.delete({ id })))
  )
);

const shouldAdd = local.pipe(
  switchMap((local) =>
    cloud.pipe(
      map((cloud) => differenceBy(local, cloud, (x) => toUniqueEndpoint(x))),
      mergeMap((xs) => from(xs))
    )
  )
);

const doAdd = biz.pipe(
  switchMap((biz) => shouldAdd.pipe(mergeMap((x) => biz.endpoint.add(x))))
);

const shouldUpdate = local.pipe(
  switchMap((local) =>
    cloud.pipe(
      map((cloud) =>
        local
          .map((l) => {
            const c = cloud.find(
              (c) => toUniqueEndpoint(c) === toUniqueEndpoint(l)
            );
            if (!c) return;
            if (c.script === l.script) return;
            return {
              ...l,
              id: c.id,
            };
          })
          .filter(Boolean)
      ),
      mergeMap((xs) => from(xs))
    )
  )
);

const doUpdate = biz.pipe(
  switchMap((biz) => shouldUpdate.pipe(mergeMap((x) => biz.endpoint.update(x))))
);

function parseScript(x) {
  const o = { content_type: "application/json" };
  const scripts = [];
  x.toString()
    .split(os.EOL)
    .forEach((x) => {
      const endpoint = x.match(/^--#ENDPOINT ([A-Z]+) (.+)/);
      if (endpoint) {
        o.method = endpoint[1].trim();
        o.path = endpoint[2].trim();
      } else {
        scripts.push(x);
      }
    });
  o.script = scripts.join(os.EOL);
  return o;
}

function toUniqueEndpoint(x) {
  return x.method.toLowerCase() + x.path;
}

module.exports = {
  action: merge(doDelete, doAdd, doUpdate),
};
