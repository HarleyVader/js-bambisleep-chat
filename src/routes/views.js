import express from 'express';
import { ViewController } from '../controllers/viewController.js';

const router = express.Router();
const viewController = new ViewController();

// Set up routes for rendering views
export const setViewRoutes = (app) => {
  router.get('/', viewController.renderHome);
  router.get('/dashboard', viewController.renderDashboard);

  app.use('/', router);
};