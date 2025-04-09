import { handleMessage } from './handlers/messageHandler.js';
import { socketAuth } from './middleware/socketAuth.js';

export const setupSocketRoutes = (io) => {
  io.use(socketAuth);

  io.on('connection', (socket) => {
    console.log('New socket connection:', socket.id);

    socket.on('message', (data) => {
      handleMessage(socket, data);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
    });
  });
};