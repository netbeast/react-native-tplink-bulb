import dgram from 'react-native-udp'
import EventEmitter from 'events'

module.exports = class Bulb {
  constructor ({ip, timeout}) {
    this.ip = ip
    this.timeout = timeout || 3500
    this.socket = dgram.createSocket('udp4')
    this.isSocketBound = false
  }

  /**
   * Scan for lightbulbs on your network
   * @module scan
   * @param {string} filter Only return devices with this class, (ie 'IOT.SMARTBULB')
   * @return {EventEmitter} Emit `light` events when lightbulbs are found
   * @example
  /**
   * Get info about the Bulb
   * @module info
   * @return {Promise} Resolves to info
   * @example
   */
  info () {
    return this.send({system: {get_sysinfo: {}}})
      .then(info => info.system.get_sysinfo)
  }

  destroy () {
    if (this.isSocketBound) {
      this.isSocketBound = false
      this.socket.close()
    }
  }

  /**
   * Send a message to a lightbulb (for RAW JS message objects)
   * @module send
   * @param  {Object} msg Message to send to bulb
   * @return {Promise}    Resolves with answer
   * @example
   */
   send (msg) {
     return new Promise((resolve, reject) => {
       if (!this.ip) {
         return reject(new Error('IP not set.'))
       }
       if (this.isSocketBound) return
       this.socket.bind(undefined, undefined, () => {
         this.isSocketBound = true
         const message = this.encrypt(Buffer.from(JSON.stringify(msg)))
         setTimeout(() => {
           this.destroy()
           return reject(new Error('TP-Link Bulb connection timeout'))
         }, this.timeout)
         this.socket.send(message, 0, message.length, 9999, this.ip, (err, bytes) => {
           if (err) {
             this.destroy()
             return reject(err)
           }
           this.socket.on('message', msg => {
             this.destroy()
             resolve(JSON.parse(this.decrypt(msg).toString()))
           })
         })
       })
     })
   }

  /**
   * Change state of lightbulb
   * @module set
   * @param {Boolean} power     On or off
   * @param {Number}  transition Transition to new state in this time
   * @param {Object}  options    Object containing `mode`, `hue`, `saturation`, `color_temp`, `brightness`
   * @returns {Promise}          Resolves to output of command
   * @example
   * ```js
// turn a light on
   */
  set (power = true, transition = 0, options = {}) {
    let state = {color_temp: 0, ...options}
    const msg = {
      'smartlife.iot.smartbulb.lightingservice': {
        'transition_light_state': {
          'ignore_default': 1,
          'on_off': power ? 1 : 0,
          'transition_period': transition,
          ...state
        }
      }
    }
    return this.send(msg)
      .then(r => r['smartlife.iot.smartbulb.lightingservice']['transition_light_state'])
  }

  /**
   * Get schedule info
   * @module daystat
   * @param  {Number} month Month to check: 1-12
   * @param  {Number} year  Full year to check: ie 2017
   * @return {Promise}      Resolves to schedule info
   * @example
   */
  daystat (month, year) {
    const now = new Date()
    month = month || now.getMonth() + 1
    year = year || now.getFullYear()
    return this.send({'smartlife.iot.common.schedule': {'get_daystat': {'month': month, 'year': year}}})
      .then(r => r['smartlife.iot.common.schedule']['get_daystat'])
  }

  /**
   * Get cloud info from bulb
   * @module cloud
   * @return {Promise} Resolves to cloud info
   * @example
   */
  cloud () {
    return this.send({'smartlife.iot.common.cloud': {'get_info': {}}})
      .then(r => r['smartlife.iot.common.cloud']['get_info'])
  }

  /**
   * Get schedule from bulb
   * @module schedule
   * @return {Promise} Resolves to schedule info
   * @example
   */
  schedule () {
    return this.send({'smartlife.iot.common.schedule': {'get_rules': {}}})
      .then(r => r['smartlife.iot.common.schedule']['get_rules'])
  }

  /**
   * Get operational details from bulb
   * @module details
   * @return {Promise} Resolves to operational details
   * @example
   */
  details () {
    return this.send({'smartlife.iot.smartbulb.lightingservice': {'get_light_details': {}}})
      .then(r => r['smartlife.iot.smartbulb.lightingservice']['get_light_details'])
  }

  /**
   * Badly encrypt message in format bulbs use
   * @module encrypt
   * @param  {Buffer} buffer Buffer of data to encrypt
   * @param  {Number} key    Encryption key (default is generally correct)
   * @return {Buffer}        Encrypted data
   * @example
```js
const encrypted = Bulb.encrypt(Buffer.from('super secret text'))
```
   */
  static encrypt (buffer, key = 0xAB) {
    for (let i = 0; i < buffer.length; i++) {
      const c = buffer[i]
      buffer[i] = c ^ key
      key = buffer[i]
    }
    return buffer
  }

  encrypt (buffer, key) {
    return Bulb.encrypt(buffer, key)
  }

  /**
   * Badly decrypt message from format bulbs use
   * @module decrypt
   * @param  {Buffer} buffer Buffer of data to decrypt
   * @param  {Number} key    Encryption key (default is generally correct)
   * @return {Buffer}        Decrypted data
   *  @example
```js
const decrypted = Bulb.decrypt(encrypted)
```
   */
  static decrypt (buffer, key = 0xAB) {
    for (let i = 0; i < buffer.length; i++) {
      const c = buffer[i]
      buffer[i] = c ^ key
      key = c
    }
    return buffer
  }

  decrypt (buffer, key) {
    return Bulb.decrypt(buffer, key)
  }
}
