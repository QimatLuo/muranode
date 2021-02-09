const fs = require("fs");
const path = require("path");

const { differenceBy } = require("lodash");
const { bindNodeCallback, concat, from, zip } = require("rxjs");
const {
  filter,
  map,
  mergeMap,
  pluck,
  switchMap,
  shareReplay,
  toArray,
} = require("rxjs/operators");

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
  switchMap((xs) => from(xs)),
  filter((x) => x.endsWith(".json")),
  map((x) => ({
    script_key: path.basename(x, ".json"),
  })),
  toArray(),
  shareReplay(1)
);

const cloud = biz.pipe(
  switchMap((biz) => biz.Config.listServices()),
  pluck("items"),
  shareReplay(1)
);

const shouldAdd = zip(local, cloud).pipe(
  map(([local, cloud]) => differenceBy(local, cloud, (x) => x.script_key)),
  mergeMap((xs) => from(xs))
);

const exchangeList = bizWithBusiness.pipe(
  switchMap((biz) => biz.exchange.element()),
  shareReplay(1)
);

const doAdd = shouldAdd.pipe(
  mergeMap(({ script_key }) =>
    exchangeList.pipe(
      map((xs) => xs.find((x) => x.source.name === script_key)),
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
            biz.Config.setParameters({
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
