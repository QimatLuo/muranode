const { of, zip } = require("rxjs");
const { map, shareReplay, switchMap } = require("rxjs/operators");

const L = require("../log.js");
const { Biz } = require("../../api/index.js");
const { applicationId, host, productId, token } = require("../index.js");

const biz = zip(applicationId, host, token).pipe(
  map(([applicationId, host, token]) => Biz({ applicationId, host, token })),
  shareReplay(1)
);

function commander(program) {
  program
    .command("serviceConfig <add|list> [parameters]")
    .option("-L, --logs", "Print out a request payload for each network call")
    .action(async (method, parameters = "{}", options) => {
      global.logs = options.logs;
      let params;
      try {
        const payload = JSON.parse(parameters);
        params =
          method === "add" && !payload.service
            ? zip(biz, productId).pipe(
                switchMap(([biz, id]) => biz.solution.get({ id })),
                map((x) => ({
                  ...payload,
                  service: x.id,
                  script_key: x.name,
                }))
              )
            : of(payload);
      } catch (e) {
        L.stderr(e);
      }
      zip(biz, params)
        .pipe(
          switchMap(([biz, parameters]) =>
            biz.serviceConfig[method](parameters)
          )
        )
        .subscribe(
          (x) => L.stdout(JSON.stringify(x)),
          L.stderr,
          () => L.log("command serviceConfig complete")
        );
    });
}

module.exports = {
  commander,
};
