const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const FormData = require("form-data");
const { differenceBy } = require("lodash");
const { bindNodeCallback, concat, from, fromEvent, zip } = require("rxjs");
const {
  concatMap,
  map,
  mergeMap,
  pluck,
  switchMap,
  reduce,
  shareReplay,
  takeUntil,
  tap,
} = require("rxjs/operators");

const { Biz } = require("../../api/index.js");
const { applicationId, host, token } = require("../index.js");
const { location_files } = require("../project/index.js");

const readdir = bindNodeCallback(fs.readdir);
const stat = bindNodeCallback(fs.stat);

const biz = zip(applicationId, host, token).pipe(
  map(([applicationId, host, token]) => Biz({ applicationId, host, token })),
  shareReplay(1)
);

const local = location_files.pipe(
  switchMap((folder) => listFiles(path.join(process.cwd(), folder))),
  shareReplay(1)
);

const cloud = biz.pipe(
  switchMap((biz) => biz.asset.list({ path: "*" })),
  shareReplay(1)
);

const shouldDelete = zip(cloud, local).pipe(
  map(([cloud, local]) => differenceBy(cloud, local, (x) => x.path)),
  mergeMap((xs) => from(xs)),
  pluck("path")
);

const doDelete = biz.pipe(
  switchMap((biz) =>
    shouldDelete.pipe(concatMap((path) => biz.asset.delete({ path })))
  )
);

const shouldUpload = zip(local, cloud).pipe(
  map(([local, cloud]) => differenceBy(local, cloud, (x) => x.md5)),
  mergeMap((xs) => from(xs)),
  pluck("path")
);

const doUpdate = zip(biz, location_files).pipe(
  switchMap(([biz, folder]) =>
    shouldUpload.pipe(
      concatMap((name) => {
        const formData = new FormData();
        formData.append(
          "file",
          fs.createReadStream(path.join(process.cwd(), folder, name))
        );
        return biz.fileUpload({
          path: name,
          formData,
        });
      })
    )
  )
);

function fileWithMd5(dir, x) {
  const s = fs.createReadStream(path.join(dir, x));
  return fromEvent(s, "data").pipe(
    takeUntil(fromEvent(s, "end")),
    reduce((m, x) => m.update(x), crypto.createHash("md5")),
    map((m) => m.digest("hex")),
    map((md5) => ({
      path: `/${x}`,
      md5,
    }))
  );
}

function listFiles(dir, folder = "") {
  return readdir(path.join(dir, folder)).pipe(
    mergeMap((xs) =>
      from(xs).pipe(
        mergeMap((x) =>
          stat(path.join(dir, folder, x)).pipe(
            mergeMap((s) =>
              s.isDirectory()
                ? listFiles(dir, path.join(folder, x))
                : fileWithMd5(dir, path.join(folder, x))
            )
          )
        )
      )
    ),
    reduce((a, b) => a.concat(b), [])
  );
}

module.exports = {
  action: concat(doUpdate, doDelete),
};
