const net = require('net')
const Docker = require('dockerode')

const port = process.env.PORT || 8080
const host = process.env.HOST || '0.0.0.0'

const docker = new Docker({ socketPath: '/var/run/docker.sock' })

const server = net.createServer(socket => {
  socket.write('[server] Connecting...\n')

  docker.createContainer({
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
    .then(container => {
      console.log('Starting container...')
      return container.start()
    })
    .then(container => {
      console.log('Attaching container...')
      container.exec({
        Cmd: ['bash'],
        'AttachStdout': true,
        'AttachStderr': true,
        'AttachStdin': true,
        'Tty': true
      })
        .then(exec => {
          return exec.start({ stdin: true }, (err, stream) => {
            console.log(`Piping socket to container... (${container.id})`)
            socket.write('[server] Remember, if you disconnect, all your data will be lost!\n\n')
            stream.pipe(socket)

            socket.on('data', data => {
              stream.write(data)
            })

            socket.on('close', () => {
              container.stop()
                .then(c => c.remove())
            })
          })
        })
        .catch(error => socket.write('[server] Error connecting to container.\n' + error + '\n'))
    })
    .catch(console.error)
})

server.listen(port, host, () => {
  console.log(`Server listening on ${host}:${port}`)
})