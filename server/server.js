const express = require('express');
const { initRoutes } = require('./configuration/routes')
const cors = require('cors')

async function startServer() {
  const app = express();
  const port = 3001;

  const corsOptions = {
    origin: ['http://localhost:3000']
  }
  app.use(cors(corsOptions));

  await initRoutes({ app })
    .catch(error => {
      const message = `App start. Error during routes initialization: ${error}`
      console.log(message)
      throw error(message)
    })

  app.listen(port, () => {
    console.log(`Express server: Successful connection on port ${port}`)
  });
}

startServer();