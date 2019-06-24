'use strict'

const { spawn } = require('child_process')
const EventEmitter = require('events')
const QMP = require('./qmp')

const VM_STATE = {
  RUN: 0,
  STOP: 1
}

class VirtualMachine extends EventEmitter {
  constructor (config = null) {
    super()
    if (!config) {
      this.config = [
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
        '-qmp', 'tcp::45454,server,nowait',
        '-serial', 'tcp:127.0.0.1:8000,server,nowait'
      ]
    } else {
      this.config = config
    }

    this.qemuExecName = '"c:\\Program Files\\qemu\\qemu-system-arm.exe"'
    this.subProc = null
    this.machine_state = VM_STATE.STOP
    this.qmp = new QMP()
    this.qmpConnectionPromise = null
  }

  start () {
    console.log('Starting the virtual machine')
    this.subProc = spawn(this.qemuExecName, this.config, { shell: true })
    // install exit handler
    this.subProc.on('exit', (code) => {
      console.log('VM : ' + this.qemuExecName + ' exited (Code ' + code + ')')
      this.emit('exit', code)
      this.subProc = null
    })
    // install error handler
    this.subProc.on('error', (code, signal) => {
      console.log('code   : ' + code)
      console.log('signal : ' + signal)
      this.emit('error', code, signal)
    })
    // install handlers for the std streams
    // these are the streams of qemu, NOT linux and its programs!
    this.subProc.stderr.on('data', (data) => {
      this.emit('stderr_data', data)
    })
    this.subProc.stdout.on('data', (data) => {
      this.emit('stdout_data', data)
    })
    this.machine_state = VM_STATE.RUN
    this.emit('status', this.machine_state)
    this.qmpConnectionPromise = new Promise((resolve, reject) => {
      this.qmp.connect(45454, 'localhost', (error) => {
        if (error) {
          reject(new Error('QMP connect error : ' + error))
        } else {
          resolve()
        }
      })
    })
  }

  stop () {
    if (this.subProc) {
      console.log('Stopping the virtual machine')
      this.qmp.end()
    }
    this.machine_state = VM_STATE.STOP
    this.emit('status', this.machine_state)
  }

  get status () {
    return this.machine_state
  }

  get stdin () {
    return this.subProc ? this.subProc.stdin : null
  }

  executeCommand (command, callback) {
    if (this.qmpConnectionPromise) {
      this.qmpConnectionPromise.then(() => {
        this.qmp.execute(command, callback)
      })
    }
  }
}

module.exports = VirtualMachine
