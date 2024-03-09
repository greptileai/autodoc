import SmeeClient from 'smee-client';

const smee = new SmeeClient({
  source: 'https://smee.io/dAuEmtnj9tNNCK6f',
  target: 'http://localhost:3000/webhook',
  logger: console
})

const events = smee.start()
