const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true // Ensures no two users can register with the same email
    },
    password: {
        type: String,
        required: true // NEW: Required for logging in!
    },
    skills: {
        type: [String],
        default: [] // UPDATED: Now optional at registration
    }
});

module.exports = mongoose.model('User', userSchema);