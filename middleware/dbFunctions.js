const mongoose = require("mongoose");
const { patterns } = require('./bambisleepChalk');
const PatreonAuth = require("../schemas/PatreonAuthSchema");
const axios = require("axios");

class DatabaseManager {
  constructor() {
    this.connections = new Map();
    this.models = new Map([
      ["PatreonAuth", PatreonAuth]
    ]);
  }

  async connect(dbType) {
    console.log(patterns.server.info(`Attempting to connect to ${dbType}`));
    if (this.connections.has(dbType)) {
      console.log(patterns.server.info(`Already connected to ${dbType}`));
      return this.connections.get(dbType);
    }

    const dbUri = this.getDbUri(dbType);
    if (!dbUri) {
      const errorMsg = `Database URI for ${dbType} is not defined`;
      console.error(patterns.server.error(`Database connection error: ${errorMsg}`));
      throw new Error(errorMsg);
    }

    try {
      let connection;
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          connection = await mongoose.createConnection(dbUri, {
            serverSelectionTimeoutMS: 30000,
            connectTimeoutMS: 30000,
            socketTimeoutMS: 45000
          }).asPromise();
          break;
        } catch (error) {
          console.error(patterns.server.error(`Attempt ${attempt} to connect to ${dbType} failed: ${error.message}`));
          if (attempt === 5) { throw error; }
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      this.connections.set(dbType, connection);
      console.log(patterns.server.success(`Connected to ${dbType}`));
      return connection;
    } catch (error) {
      console.error(patterns.server.error(`Database connection error: ${error.message}`));
      throw error;
    }
  }

  getDbUri(dbType) {
    const uriMap = {
      AUTH_DB: process.env.AUTH_DB
    };
    return uriMap[dbType];
  }

  async savePatreonAuth(authData) {
    const patreonAuth = new PatreonAuth({
      ...authData,
      password: authData.password || 'defaultPassword',
      email: authData.email || 'defaultemail',
      socketId: authData.socketId // Ensure socketId is saved
    });
    await patreonAuth.save();
    console.log(patterns.server.success("Patreon auth data saved to database"));
  }

  async validatePatreonToken(token) {
    try {
      const response = await axios.get("https://www.patreon.com/api/oauth2/v2/identity", {
        headers: {
          "Authorization": `Bearer ${token}`
        },
        params: {
          "include": "memberships,address,tiers",
          "fields[user]": "email,first_name,last_name,full_name,vanity,url,image_url,thumb_url,created,about"
        }
      });

      const userData = response.data.data;
      const memberships = response.data.included.filter(item => item.type === 'member').map(item => item.attributes);
      const addresses = response.data.included.filter(item => item.type === 'address').map(item => item.attributes);
      const tiers = response.data.included.filter(item => item.type === 'tier').map(item => item.attributes);

      console.log(patterns.server.info("Patreon user data:", userData));

      await this.savePatreonAuth({
        patreonId: userData.id,
        email: userData.attributes.email,
        firstName: userData.attributes.first_name,
        lastName: userData.attributes.last_name,
        fullName: userData.attributes.full_name,
        vanity: userData.attributes.vanity,
        url: userData.attributes.url,
        imageUrl: userData.attributes.image_url,
        thumbUrl: userData.attributes.thumb_url,
        created: userData.attributes.created,
        memberships: memberships,
        addresses: addresses,
        tiers: tiers,
      });

      return userData;
    } catch (error) {
      console.error(patterns.server.error("Error validating Patreon token:", error));
      throw error;
    }
  }

  async fetchChatReplies() {
    try {
      const replies = await PatreonAuth.find().exec();
      return replies;
    } catch (error) {
      console.error(patterns.server.error("Error fetching chat replies:", error));
      throw error;
    }
  }

  async saveUserProfile(patreonId, profile) {
    if (!patreonId || !profile.about) {
      throw new Error('Missing required fields: patreonId or about');
    }

    const userProfile = new PatreonAuth({
      patreonId,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      fullName: profile.fullName,
      vanity: profile.vanity,
      url: profile.url,
      imageUrl: profile.imageUrl,
      thumbUrl: profile.thumbUrl,
      created: profile.created,
      memberships: profile.memberships,
      addresses: profile.addresses,
      tiers: profile.tiers,
      sessionHistories: profile.sessionHistories || [],
    });

    await userProfile.save();
  }

  async getUserProfile(email, req, res) {
    if (!req.session.accessToken) {
      return res.redirect('/login');
    }
    return await PatreonAuth.findOne({ email });
  }

  async saveSessionHistory(email, sessionHistory) {
    try {
      const user = await this.getUserProfile(email);
      if (!user) {
        throw new Error('User not found');
      }

      user.sessionHistories.push({
        timestamp: new Date(),
        history: sessionHistory
      });

      await user.save();
      console.log(patterns.server.success("Session history saved to database"));
    } catch (error) {
      console.error(patterns.server.error('Error saving session history:', error));
      throw error;
    }
  }

  async getSessionHistories(email) {
    try {
      const user = await this.getUserProfile(email);
      if (!user) {
        throw new Error('User not found');
      }
      return user.sessionHistories;
    } catch (error) {
      console.error(patterns.server.error('Error fetching session histories:', error));
      throw error;
    }
  }

  async getUserDataByEmail(email) {
    try {
      const user = await PatreonAuth.findOne({ email });
      if (!user) {
        throw new Error('User not found');
      }
      return user;
    } catch (error) {
      console.error('Error fetching user by email:', error);
      throw error;
    }
  }

  async getUserStatus(email) {
    try {
      const user = await PatreonAuth.findOne({ email });
      if (!user) {
        throw new Error('User not found');
      }
      return {
        email: user.email,
        username: user.username,
        memberships: user.memberships,
        hasMembership: user.memberships.some(membership => membership.patronStatus === 'active_patron')
      };
    } catch (error) {
      console.error('Error fetching user status:', error);
      throw error;
    }
  }

  async storeUser(userData) {
    const requiredFields = [
      'email', 'username', 'firstName', 'lastName', 'vanity', 
      'url', 'imageUrl', 'thumbUrl', 'created', 'memberships', 
      'addresses', 'tiers', 'patreonId', 'socketId', 'password'
    ];
    for (const field of requiredFields) {
      if (!userData[field]) {
        console.error(`Missing required field: ${field}`);
        throw new Error(`Missing required field: ${field}`);
      }
    }

    const user = new PatreonAuth({
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      fullName: userData.fullName,
      vanity: userData.vanity,
      url: userData.url,
      imageUrl: userData.imageUrl,
      thumbUrl: userData.thumbUrl,
      created: userData.created,
      memberships: userData.memberships,
      addresses: userData.addresses,
      tiers: userData.tiers,
      sessionHistories: userData.sessionHistories || [],
      patreonId: userData.patreonId,
      socketId: userData.socketId,
      password: userData.password
    });
    await user.save();
    console.log(patterns.server.success("User data saved to database"));
  }

  async getUserByEmail(email) {
    try {
      const user = await PatreonAuth.findOne({ email });
      if (!user) {
        return null; // Return null if user is not found
      }
      return user;
    } catch (error) {
      console.error('Error fetching user by email:', error);
      throw error;
    }
  }
}

const dbFunctions = new DatabaseManager();
console.log(patterns.server.success("Database initialized"));
module.exports = {
  ...dbFunctions,
  saveSessionHistory: dbFunctions.saveSessionHistory,
  getUserByEmail: dbFunctions.getUserByEmail, // Ensure this function is exported
  getUserDataByEmail: dbFunctions.getUserDataByEmail,
  storeUser: dbFunctions.storeUser,
  getUserProfile: dbFunctions.getUserProfile
};