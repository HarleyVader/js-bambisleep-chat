export class ApiController {
  async getUsers(req, res) {
    try {
      // Logic to retrieve users from the database
      const users = await User.find(); // Assuming User is imported from models
      res.status(200).json(users);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async createUser(req, res) {
    try {
      const newUser = new User(req.body); // Assuming User is imported from models
      await newUser.save();
      res.status(201).json(newUser);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
}