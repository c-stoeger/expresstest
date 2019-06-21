'use strict'

const { Socket } = require('net')
const split = require('split2')

class QMP extends Socket {
  constructor () {
    super()
    this.commands = []
  }

  execute (command, args, callback) {
    if (typeof args === 'function') {
      callback = args
      args = null
    }

    this.commands.push(callback)

    if (args) {
      this.write(JSON.stringify({ execute: command, arguments: args }))
    } else {
      this.write(JSON.stringify({ execute: command }))
    }
  }

  connect (port, host, callback) {
    if (typeof host === 'function') {
      callback = host
      host = null
    }

    if (typeof port !== 'number') {
      super.connect(port)
    } else {
      super.connect(port, host)
    }

    this.once('connect', () => {
      this.removeAllListeners('error')
    })

    this.once('error', (error) => {
      if (callback) {
        callback(error)
      }
    })

    this.once('data', (data) => {
      Object.assign(this, JSON.parse(data).QMP)
      this.execute('qmp_capabilities')

      this.pipe(split()).on('data', (line) => {
        if (!line) {
          return this.end()
        }
        const json = JSON.parse(line)
        if (json.return || json.error) {
          const callback = this.commands.shift()
          const error = json.error ? new Error(json.error.desc) : null

          if (callback) {
            callback.apply(this, [ error, json.return ])
          }

          if (error && !callback) {
            this.emit('error', error)
          }
        } else if (json.event) {
          this.emit(json.event.toLowerCase(), json.event)
        }
      })

      if (callback) {
        callback.apply(this, [ null, this ])
      }
    })

    this.once('close', () => {
      this.end()
    })
  }
}

module.exports = QMP
