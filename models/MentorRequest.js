const mongoose = require('mongoose');

const mentorRequestSchema = new mongoose.Schema({
    mentorName: { type: String, required: true },
    userEmail: { type: String, required: true }, 
    status: { type: String, default: 'Pending' },
    requestDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MentorRequest', mentorRequestSchema);