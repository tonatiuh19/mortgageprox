/** Mocked tests do not write TiDB fixtures. Deploy still calls this so a failed run cannot leave rows behind. */
console.log("Mocked test suite: no database fixtures to purge.");
