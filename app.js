const express = require('express')

const app = express()
const server = require('http').Server(app)
const io = require('socket.io')(server)
const spawn = require('child_process').spawn

const Websocket = require('ws')

const qemuExecName = '"c:\\Program Files\\qemu\\qemu-system-arm.exe"'
const params = [
  '-M', 'versatilepb',
  '-m', '256M',
  '-kernel', 'C:\\VM\\share\\simu\\data\\qt\\zImage',
  '-dtb', 'C:\\VM\\share\\simu\\data\\qt\\versatile-pb.dtb',
  '-drive', 'file=c:\\vm\\share\\simu\\data\\qt\\rootfs.ext2,if=scsi,format=raw',
  '-append', '"root=/dev/sda console=ttyAMA0,115200 video=320x240 vt.global_cursor_default=0"',
  '-serial', 'stdio',
  '-netdev', 'tap,id=net0,ifname=EtherTAP',
  '-net', 'nic,model=rtl8139,netdev=net0',
  '-display', 'vnc=:0,websocket',
  '-device', 'qemu-xhci',
  '-device', 'usb-tablet',
  '-monitor', 'telnet::45454,server,nowait',
  '-serial', 'websocket:127.0.0.1:8000,server,nowait'
]

const subProc = spawn(qemuExecName, params, { shell: true })

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

subProc.stdout.on('data', (data) => {
  //process.stdout.write(data)
  io.emit('stdout', data)
})

subProc.stderr.on('data', (data) => {
  process.stderr.write(data)
  io.emit('stderr', data)
})

subProc.on('exit', (code) => {
  io.emit('exit', '*** ' + qemuExecName + ' exited ***')
})

subProc.on('error', (code, signal) => {
  console.log('code : ' + code)
  console.log('signal : ' + signal)
  // stderr is not really correct, but we use it here
  // as error reporting for our error of the subProcess
  io.emit('stderr', { code: code, signal: signal })
})

io.on('connection', (client) => {
  console.log('on(connection) called...')
  client.on('stdin', (data) => {
    subProc.stdin.write(data + '\n')
  })
  client.on('input', (data) => {
    console.log('input data' + data)
  })
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
// const simuSerialSocket = ioClient('ws://localhost:8000', {
//   reconnection: true,
//   transports: ['websocket'],
//   protocols: ['binary'],
//   port: 8000
// })
// //simuSerialSocket.connect()

// simuSerialSocket.on('connect', () => {
//   console.log('*****************************************')
//   console.log('Connected to serial port of simulation...')
//   console.log('*****************************************')
// })

// simuSerialSocket.on('connect_error', (error) => {
//   console.log('#########################################')
//   console.log('ConnectError : ' + error)
//   console.log('#########################################')
// })

// simuSerialSocket.on('error', (error) => {
//   console.log('#########################################')
//   console.log('Error : ' + error)
//   console.log('#########################################')
// })

// simuSerialSocket.on('reconnect_attempt', (attemptNumber) => {
//   console.log('Trying again (' + attemptNumber + ')')
// })

// // setInterval(() => {
// //   if (simuSerialSocket.connected) {
// //     console.log('sending value...')
// //     simuSerialSocket.emit('input', '123.23')
// //   }
// // }, 1000)
