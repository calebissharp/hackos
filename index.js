const net = require('net')
const Docker = require('dockerode');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

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
      console.log('running container...')
      return container.start();
    })
    .then(container => {
      console.log('attaching container...')
      container.exec({
        Cmd: ["bash"],
        'AttachStdout': true,
        'AttachStderr': true,
        'AttachStdin': true,
        'Tty': true
      }, (err, exec) => {
        if (err) {
          console.log('error', err)
        }
        exec.start({ stdin: true }, (err, stream) => {
          console.log(`piping container... (${container.id})`)
          if (err) {
            console.log(err)
          }
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
    })
    .catch(console.error)
})

server.listen(8000, () => {
  console.log('Server listening...')
})