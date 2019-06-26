const express = require('express')
const app = express()
const server = require('http').Server(app)
const vmCtrlComm = require('socket.io')(server)
const { Socket } = require('net')
const JSONStream = require('JSONStream')
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
  vmCtrlComm.emit('stdout', data)
})

vm.on('stderr_data', (data) => {
  vmCtrlComm.emit('stderr', data)
})

vm.on('exit', (code, signal) => {
  vmCtrlComm.emit('exit', '*** VM exited (Code ' + code + ', Signal ' + signal + ')')
})

vm.on('error', (code, signal) => {
  vmCtrlComm.emit('stderr', { code: code, signal: signal })
})

vm.on('status', (state) => {
  console.log('Virtual machine state: ' + state)
  // dirty here, because this is not an answer to a query,
  // but we only have a concept here... ;)
  vmCtrlComm.emit('vmc-status', JSON.stringify({ return: 'ok', status: state }))
})

let vmIOBus = null

vmCtrlComm.on('connection', (client) => {
  console.log('Control connection with Browser established')
  client.on('stdin', (data) => {
    if (vm.stdin) {
      vm.stdin.write(data + '\n')
    }
  })
  client.on('vmcontrol', (data) => {
    if (data) {
      const obj = JSON.parse(data)
      console.log(obj)
      if (obj.command === 'stop') {
        vmIOBus.end()
        vm.stop()
      } else if (obj.command === 'start') {
        vm.start()
        setTimeout(() => {
          console.log('connecting to IO-Bus of the virtual machine')
          vmIOBus = new Socket()
          vmIOBus.pipe(JSONStream.parse()).on('data', (data) => {
            console.log('piped data : ')
            console.log('type : ' + data.type)
            console.log('channel : ' + data.channel)
            console.log('value : ' + data.value)
            vmCtrlComm.emit('output', JSON.stringify(data))
          })

          vmIOBus.addListener('error', (error) => {
            console.log('#########################################')
            console.log('IO-Bus connection error : ' + error)
            console.log('#########################################')
          })

          vmIOBus.addListener('connect', (client) => {
            console.log('IO-Bus connection to virtual machine established')
          })

          vmIOBus.connect(8000, '127.0.0.1')
        }, 3000)
      } else if (obj.command === 'get-status') {
        console.log('returning status: ' + vm.status)
        vmCtrlComm.emit('vmc-status', JSON.stringify({ return: 'ok', status: vm.status }))
      }
    }
  })
  client.on('input', (data) => {
    //console.log('input data' + data)
    if (vmIOBus && !vmIOBus.pending) {
      vmIOBus.write(data, () => {
        //console.log('Value ' + data + ' written to vm')
      })
    } else {
      console.log('IO-Bus to virtual machine not ready yet')
    }
  })
})
