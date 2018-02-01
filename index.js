const net = require('net')
const fs = require('fs')
const crypto = require('crypto')
const inspect = require('util').inspect
const ssh2 = require('ssh2')
const Docker = require('dockerode')

const port = process.env.PORT || 8080
const host = process.env.HOST || '0.0.0.0'

const docker = new Docker({ socketPath: '/var/run/docker.sock' })

const pubKey = ssh2.utils.genPublicKey(ssh2.utils.parseKey(fs.readFileSync('keys/user.pub')))
const intro = fs.readFileSync('introduction.txt', { encoding: 'utf8' })

const users = {}

const getOrCreateContainer = async (user) => {
  try {
    if (user.containerID) {
      return docker.getContainer(`${user.containerID}`)
    } else {
      const container = await docker.createContainer({
        Image: 'hackos',
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
        Cmd: ['/bin/bash'],
        OpenStdin: false,
        StdinOnce: false,
        Privileged: false,
      })

      user.containerID = container.id

      return container
    }
  } catch(error) {
    console.log(error)
  }
}

const attachToContainer = async ({ container, socket, client, user }) => {
  try {
    const exec = await container.exec({
      Cmd: ['bash'],
      'AttachStdout': true,
      'AttachStderr': true,
      'AttachStdin': true,
      'Tty': true
    })
    exec.start({ stdin: true, hijack: true }, (err, stream) => {
      console.log(`Piping socket to container... (${container.id})`)

      socket.write(`[server] Welcome ${user.username}\r\n\r\n`)

      socket.write(intro.replace(/\n/g, '\r\n') + '\r\n\r\n')

      docker.modem.demuxStream(stream, socket, socket)

      socket.pipe(stream)

      stream.on('end', () => {
        socket.write(`\r\n[server] Goodbye for now ${user.username}.\r\n\r\n`)
        client.end()
        container.stop()
      })
      client.on('end', () => {
        container.stop()
        // .then(c => c.remove())
      })
    })
  } catch(error) {
    socket.write('[server] Error connecting to container.\r\n' + error + '\r\n')
  }
}

const authenticateUser = client => ctx => {
  if (ctx.method === 'password') {
    const { username, password } = ctx
    // account already exists
    if (users[username] && users[username].password === password) {
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
  } else {
    ctx.reject()
  }
}

new ssh2.Server({
  hostKeys: [fs.readFileSync('keys/user')],
}, client => {
  client._sshstream._authFailure = client._sshstream.authFailure;
  client._sshstream.authFailure = function() {
      client._sshstream._authFailure(['password', 'publickey']);
  }

  client
    .on('authentication', authenticateUser(client))
    .on('ready', () => {
      const user = users[client.username]

      client.on('session', (accept, reject) => {
        const session = accept()

        session
        .on('shell', async (accept, reject) => {
          const socket = accept()

          socket.write('[server] Connecting...\r\n')

          const container = await getOrCreateContainer(user)

          console.log('Starting container...')
          await container.start()

          console.log('Attaching container...')
          await attachToContainer({ container, socket, client, user })
        })
        .on('pty', async (accept, reject, info) => {
          const x = accept()


        })
      })
    })
})
  .listen(port, host, () => {
    console.log(`SSH server listening on ${host}:${port}`)
  })
