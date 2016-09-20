import express from 'express'
import bodyParser from 'body-parser'
import mqtt from 'mqtt'

const app = express()
const port = process.env.PORT || 8080

app.use(bodyParser.urlencoded({
  extended: true
}))

const mqOptions = {
  port: process.env.MQTT_PORT,
  clientId: `mqttjs_${Math.random().toString(16).substr(2, 8)}`,
  username: process.env.MQTT_USER,
  password: process.env.MQTT_PASS
}

const client = mqtt.connect(process.env.MQTT_URL, mqOptions)

client.on('connect', () => {
  client.publish('connection', 'connected')
})

app.post('/', (req, res) => {
  if (req.body.token !== process.env.SLACK_TOKEN) {
    console.warn('Token mismatch, sent', req.body.token)
    return res.sendStatus(403)
  }

  client.publish('pr', '1', () => res.sendStatus(200))
})

app.listen(port)

