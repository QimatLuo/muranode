const L = require("../log.js");
const { login } = require("../project/index.js");

function commander(program) {
  program
    .command("login")
    .option("-L, --logs", "Print out a request payload for each network call")
    .action(async (args) => {
      global.logs = args.logs;

      login.subscribe(
        (x) => L.stdout(JSON.stringify(x)),
        L.stderr,
        () => L.log("command login complete")
      );
    });
}

module.exports = {
  commander,
};
