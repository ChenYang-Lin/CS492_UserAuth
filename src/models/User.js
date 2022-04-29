const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    username: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    otp: {
        type: String,
        default: 0000,
        required: true,
    },
    expiresAt: {
        type: Date,
        default: Date.now,
        required: true,
    },
}, { timestamps: false });

const User = mongoose.model("User", userSchema);

module.exports = User;