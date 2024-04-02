import dotenv from 'dotenv';
dotenv.config();
import winston from 'winston'
import WinstonCloudWatch from 'winston-cloudwatch'

const logger = new winston.createLogger({
  format: winston.format.combine(
    winston.format.json(),
    winston.format.errors({ stack: true })
  ),
  transports: [
    new winston.transports.Console({
      timestamp: true,
      colorize: true,
      level: 'error',
      handleExceptions: true,
    }),
  ],
  levels: {
    trace: 0,
    input: 1,
    verbose: 2,
    prompt: 3,
    debug: 4,
    info: 5,
    data: 6,
    help: 7,
    warn: 8,
    error: 9,
  },
})

if (process.env.NODE_ENV === 'PROD') {
  try {
    const cloudwatchConfig = {
      logGroupName: process.env.CLOUDWATCH_GROUP_NAME,
      logStreamName: `${process.env.CLOUDWATCH_GROUP_NAME}-${process.env.NODE_ENV}`,
      awsAccessKeyId: process.env.CLOUDWATCH_ACCESS_KEY,
      awsSecretKey: process.env.CLOUDWATCH_SECRET_ACCESS_KEY,
      awsRegion: process.env.CLOUDWATCH_REGION,
      messageFormatter: ({ level, message, additionalInfo }) =>
        `[${level}] : ${message} \nMore: ${JSON.stringify(additionalInfo)}}`,
    }
    logger.add(
      new WinstonCloudWatch({
        ...cloudwatchConfig,
        prettyPrint: true,
        level: 'error',
      })
    )
  } catch (e) {
    logger.error(`Error Setting Up Winston with Cloudwatch`, e)
  }
}

export default logger