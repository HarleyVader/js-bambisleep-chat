# BambiSleep Profile

BambiSleep Profile is a web application that allows users to create and manage customizable profiles. Each profile includes an avatar, header, about section, and description. The application utilizes real-time updates through Socket.IO and stores profile data in a MongoDB database.

## Features

- Customizable user profiles with avatar, header, about, and description.
- Real-time updates using Socket.IO for seamless user experience.
- CRUD operations for managing profiles.
- Responsive design with CSS styling.

## Technologies Used

- **Node.js**: JavaScript runtime for building the server.
- **Express**: Web framework for Node.js to handle routing and middleware.
- **EJS**: Templating engine for rendering dynamic HTML pages.
- **Socket.IO**: Library for real-time web applications to enable bi-directional communication.
- **MongoDB**: NoSQL database for storing user profiles.
- **Mongoose**: ODM library for MongoDB and Node.js.

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/bambisleep-profile.git
   ```

2. Navigate to the project directory:
   ```
   cd bambisleep-profile
   ```

3. Install the dependencies:
   ```
   npm install
   ```

4. Create a `.env` file in the root directory and add your MongoDB connection string:
   ```
   MONGODB_URI=your_mongodb_connection_string
   ```

5. Start the application:
   ```
   npm start
   ```

## Usage

- Visit `http://localhost:3000` to access the application.
- Create a new profile or edit an existing one.
- Use the system controls to save changes and see real-time updates.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.