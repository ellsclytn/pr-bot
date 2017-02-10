import axios from 'axios'
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

const scanPrs = (messages) => {
  const prMessages = messages.filter((message) => (message.text.startsWith(':pr:') && !message.parent_user_id))
  .map((message) => {
    const { replies = [] } = message

    message.replies = replies.map((reply) => messages.find(
      (m) => (m.ts === reply.ts)
    )).filter(r => r)
    .filter((reply) => (
      reply.text.startsWith(':merged:') || reply.text.startsWith(':closed:')
    ))

    return message
  })

  const unresponded = prMessages.filter(({replies}) => !replies.length).length

  return unresponded
}

app.post('/', (req, res) => {
  if (req.body.token !== process.env.SLACK_TOKEN) {
    console.warn('Token mismatch, sent', req.body.token)
    return res.sendStatus(403)
  }

  axios.get('https://slack.com/api/channels.history', { params: {
    token: process.env.SLACK_API_TOKEN,
    channel: process.env.SLACK_CHANNEL,
    count: 50
  }}).then((response) => (response.data.messages))
  .then((messages) => (scanPrs(messages)))
  .then((unresponded) => {
    if (unresponded && req.body.text === ':pr:') {
      // New PR
      client.publish('pr', '1', () => res.sendStatus(200))
      return res.sendStatus(200)
    } else if (!unresponded) {
      // Cleared PRs
      client.publish('pr', '0', () => res.sendStatus(200))
      return res.sendStatus(200)
    } else {
      // No change
      return res.sendStatus(200)
    }
  }).catch((err) => (console.error('Failed to fetch messages', err)))
})

app.listen(port)
