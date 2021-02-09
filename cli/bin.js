#!/usr/bin/env node

const commands = [
  require("./login/index.js"),
  require("./service/index.js"),
  require("./serviceConfig/index.js"),
  require("./syncup/index.js"),
];

async function main() {
  const { Command } = require("commander");
  const program = new Command();

  commands.forEach((x) => x.commander(program));
  await program.parseAsync(process.argv);
}

main();
