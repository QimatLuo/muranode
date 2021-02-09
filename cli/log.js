let lastTime;

module.exports = {
  log(...args) {
    if (!global.logs) return;
    const time = new Date().toJSON();
    if (time !== lastTime) {
      lastTime = time;
      console.log(time);
    }
    console.log(...args);
  },
  stderr: console.error,
  stdout: console.log,
};
