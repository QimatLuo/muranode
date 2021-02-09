const inquirer = require("inquirer");
inquirer.registerPrompt(
  "autocomplete",
  require("inquirer-autocomplete-prompt")
);

let prompts;
function prompt(x) {
  if (prompts) {
    prompts = prompts.then(() => inquirer.prompt([x]));
  } else {
    prompts = inquirer.prompt([x]);
  }
  return prompts.then((o) => o[x.name]);
}

module.exports = {
  prompt,
};
