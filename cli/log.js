let lastTime;

module.exports = {
  log(...args) {
    if (!global.logs) return;
    const time = new Date().toJSON();
    if (time !== lastTime) {
      lastTime = time;
      console.log(time);
    }
    console.log(
      ...args.map((x) => {
        if ((x.url || "").endsWith("/api:1/token/")) {
          x = { ...x };
          x.body = x.body.replace(/"password":".*"/, '"password":"**********"');
        }
        return x;
      })
    );
  },
  stderr: console.error,
  stdout: console.log,
};
