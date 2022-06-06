const { of, zip } = require("rxjs");
const { map, switchMap } = require("rxjs/operators");

const L = require("../log.js");
const { Biz } = require("../../api/index.js");
const { applicationId, host, productId, token } = require("../index.js");

function commander(program) {
  program
    .command("service <service> <method> [parameters]")
    .option("-L, --logs", "Print out a request payload for each network call")
    .action(async (service, method, parameters = "{}", options) => {
      global.logs = options.logs;
      service = service.toLowerCase();
      const solutinoId = service === "device2" ? productId : applicationId;

      try {
        const json = JSON.parse(parameters);
        zip(host, solutinoId, token)
          .pipe(
            map(([host, solutinoId, token]) => {
              const params = { host, productId, token };
              const key = service === "device2" ? "productId" : "applicationId";
              params[key] = solutinoId;
              return Biz(params);
            }),
            switchMap((biz) => biz[service][method](json))
          )
          .subscribe(
            (x) => L.stdout(x),
            L.stderr,
            () => L.log("command service complete")
          );
      } catch (e) {
        L.stderr(e);
      }
    });
}

module.exports = {
  commander,
};
