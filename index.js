const net = require('net')
const fs = require('fs')
const crypto = require('crypto')
const inspect = require('util').inspect
const ssh2 = require('ssh2')
const Docker = require('dockerode')

const port = process.env.PORT || 8080
const host = process.env.HOST || '0.0.0.0'

const docker = new Docker({ socketPath: '/var/run/docker.sock' })

const pubKey = ssh2.utils.genPublicKey(ssh2.utils.parseKey(fs.readFileSync('keys/user.pub')));

const users = {}

const getOrCreateContainer = async (user) => {
  if (user.containerID) {
    return docker.getContainer(user.containerID)
  } else {
    const container = await docker.createContainer({
      Image: 'ubuntu',
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      Cmd: ['/bin/bash'],
      OpenStdin: false,
      StdinOnce: false,
      Priveleged: false,
    })

    user.containerID = container.id

    return container
  }
}

const attachToContainer = async ({ container, socket, client, user }) => {
  try {
    const exec = await container.exec({
      Cmd: ['bash'],
      'AttachStdout': true,
      'AttachStderr': false,
      'AttachStdin': true,
      'Tty': true
    })
    exec.start({ stdin: true }, (err, stream) => {
      console.log(`Piping socket to container... (${container.id})`)
      socket.write(`[server] Welcome ${user.username}\n\n`)
      stream.pipe(socket)
  
      socket.on('data', data => {
        stream.write(data)
      })
  
      client.on('end', () => {
        container.stop()
        // .then(c => c.remove())
      })
    })
  } catch(error) {
    socket.write('[server] Error connecting to container.\n' + error + '\n')
  }
}

const authenticateUser = client => ctx => {
  if (ctx.method === 'keyboard-interactive') {
    ctx.prompt(['username: ', 'password: '], ([username, password]) => {
      // no username or password given
      if (!username || !password) {
        return ctx.reject()
      }
      // account already exists
      else if (users[username] && users[username].password === password) {
        client.username = username
        return ctx.accept()
      }
      // account doesn't exist yet
      else if (!users[username]) {
        users[username] = {
          username,
          password,
        }
        client.username = username
        return ctx.accept()
      }
      // they did something really wrong
      return ctx.reject()
    })
  } else {
    ctx.reject()
  }
}

new ssh2.Server({
  hostKeys: [fs.readFileSync('keys/user')],
}, client => {
  client
    .on('authentication', authenticateUser(client))
    .on('ready', () => {
      const user = users[client.username]

      client.on('session', (accept, reject) => {
        const session = accept()

        session.on('shell', async (accept, reject) => {
          const socket = accept()

          socket.write('[server] Connecting...\n')

          const container = await getOrCreateContainer(user)

          console.log('Starting container...')
          container.start()

          console.log('Attaching container...')
          await attachToContainer({ container, socket, client, user })
        })
      })
    })
})
  .listen(8081, '0.0.0.0', () => {
    console.log(`SSH server listening on 0.0.0.0:8081`)
  })