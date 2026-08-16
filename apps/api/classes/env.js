const fs = require("fs");
const path = require("path");

const excludedVariables = ["JS_GEOLITE_LICENSE_KEY", "JS_USER", "JS_PASSWORD"];

function buildEnvContent() {
  const envVariables = Object.keys(process.env).reduce((acc, key) => {
    if (key.startsWith("JS_") && !excludedVariables.includes(key)) {
      acc[key] = process.env[key];
    }
    return acc;
  }, {});

  return `window.env = ${JSON.stringify(envVariables, null, 2)};`;
}

async function writeEnvVariables() {
  const envContent = buildEnvContent();

  // Define the output file path
  const outputPath = path.join(process.env.JS_CLIENT_DIST || path.join(__dirname, "..", "..", "web", "dist"), "env.js");

  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.promises.writeFile(outputPath, envContent, "utf8");
  console.log("env.js file has been saved successfully.");
}

module.exports = writeEnvVariables;
module.exports.buildEnvContent = buildEnvContent;
