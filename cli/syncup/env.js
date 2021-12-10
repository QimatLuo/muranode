const fs = require("fs");
const path = require("path");

const { EMPTY, bindNodeCallback, zip } = require("rxjs");
const { catchError, map, switchMap } = require("rxjs/operators");

const L = require("../log.js");
const { Biz } = require("../../api/index.js");
const { applicationId, host, token } = require("../index.js");

const readFile = bindNodeCallback(fs.readFile);

const biz = zip(applicationId, host, token).pipe(
  map(([applicationId, host, token]) => Biz({ applicationId, host, token }))
);

const payload = readFile(path.join(process.cwd(), "env.json")).pipe(
  catchError((e) => {
    if (e.code === "ENOENT") {
      L.log("Ignore syncup env due to", e.message);
      return EMPTY;
    } else {
      throw e;
    }
  }),
  map((x) => x.toString().trim()),
  map((x) => JSON.parse(x))
);

const doUpdate = payload.pipe(
  switchMap((x) => biz.pipe(switchMap((biz) => biz.solution.env(x))))
);

module.exports = {
  action: doUpdate,
};
