export const handleMessage = (socket, message) => {
  // Process the incoming message
  console.log(`Received message: ${message}`);

  // Emit the message to all connected clients
  socket.broadcast.emit('message', message);
};