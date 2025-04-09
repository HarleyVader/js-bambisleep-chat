import express from 'express';
import { ApiController } from '../controllers/apiController.js';

const router = express.Router();
const apiController = new ApiController();

export const setApiRoutes = (app) => {
  router.get('/users', apiController.getUsers);
  router.post('/users', apiController.createUser);

  app.use('/api', router);
};