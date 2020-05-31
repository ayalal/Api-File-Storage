const amqp = require('amqplib');

const rabbitmqHost = process.env.RABBITMQ_HOST || 'rabbitmq-server';
const rabbitmqUrl = `amqp://guest:guest@${rabbitmqHost}:5672`;

let connection = null;
let channel = null;

exports.connectToRabbitMQ = async function (queue) {
  connection = await amqp.connect(rabbitmqUrl);
  channel = await connection.createChannel();
  await channel.assertQueue(queue);
};

exports.getChannel = function () {
  return channel;
};