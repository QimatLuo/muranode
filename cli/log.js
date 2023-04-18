let lastTime;

module.exports = {
  log(...args) {
    if (!global.logs) return;
    const time = new Date().toJSON();
    if (time !== lastTime) {
      lastTime = time;
      console.log(time);
    }
    const xs = args.map((x) => {
      if ((x.url || "").endsWith("/api:1/token/")) {
        x = { ...x };
        x.body = x.body.replace(/"password":".*"/, '"password":"**********"');
      }
      return x;
    });
    stringifyLog(console.log)("[muranode]", ...xs);
  },
  stderr: stringifyLog(console.error),
  stdout: stringifyLog(console.log),
};

function stringifyLog(f) {
  return (...args) => {
    const xs = args.map((x) => JSON.stringify(x));
    return f(...xs);
  };
}
