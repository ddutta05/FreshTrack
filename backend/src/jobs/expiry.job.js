const env = require("../config/env");
const { expireDonationsAndNotify } = require("../services/donation.service");

let timer;

function startExpiryJob() {
  if (timer) {
    clearInterval(timer);
  }

  timer = setInterval(async () => {
    try {
      const count = await expireDonationsAndNotify();
      if (count > 0) {
        console.log(`Expired ${count} donation(s)`);
      }
    } catch (error) {
      console.error("Expiry job failed:", error.message);
    }
  }, env.expirySweepIntervalMs);
}

function stopExpiryJob() {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }
}

module.exports = {
  startExpiryJob,
  stopExpiryJob
};
