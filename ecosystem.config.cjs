// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'ai-harness-demo',
      script: 'npx',
      args: 'tsx src/server.ts',
      cwd: '/home/user/webapp',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
