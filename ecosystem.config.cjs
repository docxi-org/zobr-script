module.exports = {
  apps: [{
    name: "zobr-script",
    script: "npx",
    args: "tsx packages/server/src/main.ts",
    cwd: "/opt/zobr-script",
    interpreter: "none",
    env: {
      NODE_ENV: "production",
    },
  }],
};
