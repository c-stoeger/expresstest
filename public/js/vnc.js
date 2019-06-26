const RFB = require('novnc-core').default

let rfb = null

const disconnect = (reconnect) => {
  if (!rfb) return

  console.debug(`Disconnecting from ${rfb._url}`)
  rfb.disconnect()

  rfb = null
  if (reconnect === true) {
    setTimeout(() => {
      connect('127.0.0.1:5700')
    }, 1000)
  }
}

const onConnected = () => {
  console.debug(`Connected to ${rfb._url}`)
}

const onPasswordPrompt = () => {
  console.log('Password is needed ;)')
}

const connect = (address, password) => {
  if (rfb) {
    return
  }
  try {
    rfb = new RFB(document.getElementById('noVNC-canvas'), `ws://${address}`)
    rfb.addEventListener('connect', onConnected)
    rfb.addEventListener('disconnect', disconnect)
    rfb.addEventListener('credentialsrequired', onPasswordPrompt)
    rfb.scaleViewport = rfb.resizeSession = true
  } catch (err) {
    console.error('Unable to create RFB client:', err)
  }
}

window.addEventListener('DOMContentLoaded', e => {
  document.getElementById('vm-start-btn').addEventListener('click', () => {
    setTimeout(() => {
      connect('127.0.0.1:5700')
    }, 2000)
  })
  document.getElementById('vm-stop-btn').addEventListener('click', () => {
    disconnect(false)
  })
})
