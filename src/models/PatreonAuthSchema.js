const mongoose = require("mongoose");

const MembershipSchema = new mongoose.Schema({
  fullName: String,
  isFollower: Boolean,
  lastChargeDate: Date,
  lifetimeSupportCents: Number,
  currentlyEntitledAmountCents: Number,
  patronStatus: String
}, { _id: false });

const AddressSchema = new mongoose.Schema({
  addressee: String,
  city: String,
  line1: String,
  line2: String,
  phoneNumber: String,
  postalCode: String,
  state: String
}, { _id: false });

const TierSchema = new mongoose.Schema({
  amountCents: Number,
  createdAt: Date,
  description: String,
  discordRoleIds: [String],
  editedAt: Date,
  patronCount: Number,
  published: Boolean,
  publishedAt: Date,
  requiresShipping: Boolean,
  title: String,
  url: String
}, { _id: false });

const SessionHistorySchema = new mongoose.Schema({
  socketId: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    required: true
  },
  history: {
    type: String,
    required: true
  }
}, { _id: false });

const PatreonAuthSchema = new mongoose.Schema({
  patreonId: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  fullName: {
    type: String,
    required: true
  },
  vanity: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String,
    required: true
  },
  thumbUrl: {
    type: String,
    required: true
  },
  created: {
    type: Date,
    required: true
  },
  memberships: {
    type: [MembershipSchema],
    required: true
  },
  addresses: {
    type: [AddressSchema],
    required: true
  },
  tiers: {
    type: [TierSchema],
    required: true
  },
  sessionHistories: {
    type: [SessionHistorySchema],
    default: []
  },
  socketId: { 
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

export default mongoose.model("PatreonAuth", PatreonAuthSchema);