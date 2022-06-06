const { intersection } = require("lodash");
const { from } = require("rxjs");
const { concatMap } = require("rxjs/operators");

const L = require("../log.js");

function commander(program) {
  program
    .command("syncup")
    .description("Sync project up into Murano")
    .option("-A, --assets", "Only syncup assets")
    .option("-C, --configs", "Only syncup configs")
    .option("-E, --endpoints", "Only syncup endpoints")
    .option("-M, --modules", "Only syncup modules")
    .option("-N, --env", "Only syncup environment variables")
    .option("-R, --resources", "Only syncup resources")
    .option("-S, --services", "Only syncup services")
    .option("-L, --logs", "Print out a request payload for each network call")
    .action(async (args) => {
      global.logs = args.logs;

      const actions = [
        "env",
        "configs",
        "assets",
        "endpoints",
        "modules",
        "resources",
        "services",
      ];

      const isNoSpecificAction = actions.every((x) => !args[x]);

      from(
        isNoSpecificAction ? actions : intersection(actions, Object.keys(args))
      )
        .pipe(concatMap((x) => require(`./${x}.js`).action))
        .subscribe(
          (x) => L.stdout(x),
          (x) => {
            L.stderr(x);
            process.exit(1);
          },
          () => L.log("command syncup complete")
        );
    });
}

module.exports = {
  commander,
};
