const { zip } = require("rxjs");
const { map, shareReplay, switchMap } = require("rxjs/operators");

const L = require("../log.js");
const { Biz } = require("../../api/index.js");
const { applicationId, host, token } = require("../index.js");

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
      try {
        biz
          .pipe(
            switchMap((biz) =>
              biz.serviceConfig[method](JSON.parse(parameters))
            )
          )
          .subscribe(
            (x) => L.stdout(JSON.stringify(x)),
            L.stderr,
            () => L.log("command serviceConfig complete")
          );
      } catch (e) {
        L.stderr(e);
      }
    });
}

module.exports = {
  commander,
};
