const express = require('express')
const app = express()
const server = require('http').Server(app)
const io = require('socket.io')(server)
const { Socket } = require('net')
const VirtualMachine = require('./models/virtual_machine')

app.use(express.static('public'))
app.set('view engine', 'ejs')

app.get('/', (req, res) => {
  res.render('pages/index')
})

app.get('/settings', (req, res) => {
  res.render('pages/settings')
})

app.get('/simulation', (req, res) => {
  res.render('pages/simulation')
})

server.listen(3000, () => {
  console.log('http://localhost:3000')
})

// setting up the virtual machine
const vm = new VirtualMachine()
vm.on('stdout_data', (data) => {
  io.emit('stdout', data)
})

vm.on('stderr_data', (data) => {
  io.emit('stderr', data)
})

vm.on('exit', (code) => {
  io.emit('exit', '*** VM exited (Code ' + code + ')')
})

vm.on('error', (code, signal) => {
  io.emit('stderr', { code: code, signal: signal })
})

vm.on('status', (state) => {
  console.log('Virtual machine state: ' + state)
  io.emit('vm_state', state)
})

// fire up the machine...
vm.start()
vm.executeCommand('query-status', (error, status) => {
  if (error) {
    console.log('QMP ERROR : ' + error)
  } else {
    console.info('Current VM Status : %s', status.status)
  }
})

let ioSock = null
setTimeout(() => {
  console.log('creating socket...')
  ioSock = new Socket()

  ioSock.addListener('error', (error) => {
    console.log('#########################################')
    console.log('ConnectError : ' + error)
    console.log('#########################################')
  })

  ioSock.addListener('data', (data) => {
    console.log('data rcv : ' + data)
  })

  ioSock.connect(8000, '127.0.0.1')
}, 15000)

io.on('connection', (client) => {
  console.log('on(connection) called...')
  client.on('stdin', (data) => {
    if (vm.stdin) {
      vm.stdin.write(data + '\n')
    }
  })
  client.on('input', (data) => {
    console.log('input data' + data)
    if (ioSock && !ioSock.pending) {
      ioSock.write(data, () => {
        console.log('Value ' + data + ' written to vm')
      })
    } else {
      console.log('socket not ready yet')
    }
  })
})
