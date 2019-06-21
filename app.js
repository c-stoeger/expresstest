const express = require('express')
const app = express()
const server = require('http').Server(app)
const io = require('socket.io')(server)
const Websocket = require('ws')
const VirtualMachine = require('./models/virtual_machine')
const QMP = require('./models/qmp')

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

io.on('connection', (client) => {
  console.log('on(connection) called...')
  client.on('stdin', (data) => {
    if (vm.stdin) {
      vm.stdin.write(data + '\n')
    }
  })
  client.on('input', (data) => {
    console.log('input data' + data)
  })
})

vm.on('status', (state) => {
  console.log('Virtual machine state: ' + state)
  io.emit('vm_state', state)
})

// fire up the machine...
vm.start()

// // setting up qemu monitor
// const qmp = new QMP()
// qmp.connect(45454, 'localhost', function (error) {
//   if (error) {
//     console.log('QMP Error : ' + error)
//   } else {
//     console.info('QEMU version %d.%d.%d',
//       qmp.version.qemu.major, qmp.version.qemu.minor, qmp.version.qemu.micro)

//     qmp.execute('query-status', (error, status) => {
//       if (error) {
//         console.log('QMP ERROR : ' + error)
//       } else {
//         console.info('Current VM Status : %s', status.status)
//       }
//       this.end()
//     })
//   }
// })

vm.executeCommand('query-status', (error, status) => {
  if (error) {
    console.log('QMP ERROR : ' + error)
  } else {
    console.info('Current VM Status : %s', status.status)
  }
})

setTimeout(() => {
  console.log('creating io socket...')
  const ioWs = new Websocket('ws://localhost:8000', 'binary')

  ioWs.addEventListener('open', () => {
    console.log('*****************************************')
    console.log('Connected to serial port of simulation...')
    console.log('*****************************************')
  })

  ioWs.addEventListener('close', (code, reason) => {
    console.log('*****************************************')
    console.log('Connection to simulation closed')
    console.log('Code:   ' + code)
    console.log('Reason: ' + reason)
    console.log('*****************************************')
  })

  ioWs.addEventListener('error', (error) => {
    console.log('#########################################')
    console.log('ConnectError : ' + error)
    console.log('#########################################')
  })

  ioWs.addEventListener('message', (data) => {
    console.log('m: ' + String.fromCharCode(data.data[0]) + ', Raw: ' + data.data[0])
  })

  let data = {
    channel: 1,
    value: 42.0
  }

  setInterval(() => {
    if (ioWs.readyState === ioWs.OPEN) {
      const jData = JSON.stringify(data)
      ioWs.send(jData, { binary: true }, () => {
        console.log('Value ' + jData + ' written')
      })
      data.value += 1.234
    } else {
      console.log('websocket not ready yet...')
    }
  }, 2000)
}, 15000)
