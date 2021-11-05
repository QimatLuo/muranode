const fs = require("fs");
const path = require("path");

const { differenceBy } = require("lodash");
const { EMPTY, bindNodeCallback, concat, from, iif, of, throwError, zip } = require("rxjs");
const {
  catchError,
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
const { applicationId, businessId, host, token } = require("../index.js");

const readdir = bindNodeCallback(fs.readdir);

const biz = zip(applicationId, host, token).pipe(
  map(([applicationId, host, token]) => Biz({ applicationId, host, token }))
);

const bizWithBusiness = zip(applicationId, businessId, host, token).pipe(
  map(([applicationId, businessId, host, token]) =>
    Biz({ applicationId, businessId, host, token })
  )
);

const local = readdir(path.join(process.cwd(), "configs")).pipe(
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
      filter((x) => x.endsWith(".json")),
      map((x) => ({
        script_key: path.basename(x, ".json"),
      })),
      toArray()
    )
  ),
  shareReplay(1)
);

const cloud = biz.pipe(
  switchMap((biz) => biz.config.listServices()),
  shareReplay(1)
);

const shouldAdd = local.pipe(
  switchMap((local) =>
    cloud.pipe(
      map((cloud) => differenceBy(local, cloud, (x) => x.script_key)),
      mergeMap((xs) => from(xs))
    )
  )
);

const exchangeList = bizWithBusiness.pipe(
  switchMap((biz) => biz.exchange.element()),
  pluck("items"),
  shareReplay(1)
);

const doAdd = shouldAdd.pipe(
  mergeMap(({ script_key }) =>
    exchangeList.pipe(
      map((xs) => xs.find((x) => x.source.name === script_key)),
      switchMap(x => iif(
        () => !!x,
        of(x),
        throwError(`Error: Exchange element "${script_key}" not found.`),
      )),
      switchMap(({ elementId }) =>
        bizWithBusiness.pipe(
          switchMap((biz) => biz.exchange.purchase({ elementId }))
        )
      )
    )
  )
);

const doUpdate = local.pipe(
  mergeMap((xs) =>
    from(xs).pipe(
      mergeMap((x) =>
        biz.pipe(
          switchMap((biz) =>
            biz.config.setParameters({
              service: x.script_key,
              parameters: require(path.join(
                process.cwd(),
                "configs",
                `${x.script_key}.json`
              )),
            })
          )
        )
      )
    )
  )
);

module.exports = {
  action: concat(doAdd, doUpdate),
};
