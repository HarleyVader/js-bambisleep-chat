import { Server } from 'socket.io';

export const setupSocket = (httpServer) => {
  const io = new Server(httpServer);

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Event listeners can be set up here
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  return io;
};